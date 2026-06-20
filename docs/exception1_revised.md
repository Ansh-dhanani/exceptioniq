# Implementation Plan — ExceptionIQ MVP Build (Revised)

> **Supersedes:** `exception1` (original plan)
> **Status:** Ready to implement
> **Changes from original:** 10 issues identified and resolved — see each `[FIX]` annotation below.

---

## Confirmed Decisions (Unchanged from Original)

- Modular monolith: Django + React (Vite + TypeScript) + FastAPI + PostgreSQL
- Docker Compose for local orchestration
- Groq for LLM inference with a rule-based local fallback when no API key is present
- Database auto-seeding for default entity, users, and routing rules
- Maker-Checker resolution flow (analyst resolves → approver closes)
- Notifications deferred — in-app notification count badge only (not full email system)

---

## Fixes Applied

---

### [FIX 1] `makemigrations` removed from container startup

**Problem:** Running `makemigrations` inside `docker-compose.yml` startup generates migration files dynamically inside a running container. Those files are never committed to git. In any multi-container scenario, two containers starting simultaneously will produce conflicting migrations. `makemigrations` is a developer command, not a runtime command.

**Fix:** Developers run `makemigrations` locally and commit the resulting files. The container startup command only runs `migrate`.

**Revised `docker-compose.yml` backend startup command:**
```yaml
command: >
  sh -c "python manage.py migrate &&
         python manage.py seed_db &&
         python manage.py runserver 0.0.0.0:8000"
```

**Developer workflow (run once when models change, then commit):**
```bash
docker compose exec backend python manage.py makemigrations
# Commit the generated migration files to git
```

---

### [FIX 2] `CORS_ALLOW_ALL_ORIGINS` gated behind DEBUG

**Problem:** `CORS_ALLOW_ALL_ORIGINS = True` in `settings.py` with no environment guard means any origin can call the API if this file is used in staging or production.

**Fix:** CORS configuration reads from environment. In development (DEBUG=True), all origins are allowed for convenience. In all other environments, only the frontend origin is allowed.

**Revised `settings.py` CORS block:**
```python
CORS_ALLOW_ALL_ORIGINS = DEBUG  # True only in local dev

if not DEBUG:
    CORS_ALLOWED_ORIGINS = [
        os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173"),
    ]
```

**`.env` additions:**
```
DEBUG=True
FRONTEND_ORIGIN=http://localhost:5173
```

In staging and production, `DEBUG=False` and `FRONTEND_ORIGIN` is set to the actual deployed frontend URL. No code change needed when deploying.

---

### [FIX 3] User Switcher is dev-only, hidden in non-debug environments

**Problem:** A User Switcher dropdown visible in the navbar during a pilot demo signals to enterprise buyers that access controls are cosmetic. A CFO seeing "Switch to: analyst / approver / admin" in the top bar will immediately question whether RBAC is real.

**Fix:** The User Switcher component renders only when the `VITE_DEV_TOOLS=true` environment variable is set. This variable is set in `.env.local` (developer machines) and is absent in staging and production builds.

**`App.tsx` (or `Navbar.tsx`) guard:**
```tsx
const showDevTools = import.meta.env.VITE_DEV_TOOLS === 'true';

// In JSX:
{showDevTools && <UserSwitcher />}
```

**`.env.local` (developer machines only, gitignored):**
```
VITE_DEV_TOOLS=true
```

**`.env.production` (staging and production):**
```
VITE_DEV_TOOLS=false
```

The `UserSwitcher` component itself remains in the codebase — it is simply not rendered when the flag is off.

---

### [FIX 4] Reset Database is a dev-only action, not a navbar button

**Problem:** A "Reset Database" button in the top navbar is a one-click data wipe that will be visible during every client demo and pilot. This is never acceptable in a product being shown to enterprise buyers, regardless of how clearly it is labeled.

**Fix:**
- The `bank/clear` API endpoint is kept for testing purposes but is guarded server-side: it returns `HTTP 403` if `DEBUG=False`.
- The frontend Reset button renders only when `VITE_DEV_TOOLS=true` (same flag as Fix 3).
- In demo and pilot environments, this button is completely absent from the UI.

**`views.py` guard on the clear endpoint:**
```python
@action(detail=False, methods=['post'], url_path='clear')
def clear(self, request):
    if not settings.DEBUG:
        return Response(
            {"error": "This action is only available in debug mode."},
            status=status.HTTP_403_FORBIDDEN
        )
    # ... clear logic
```

---

### [FIX 5] Design system replaced — clean enterprise UI, not glassmorphism

**Problem:** Glassmorphism (blurred glass panels, translucent cards, dark-mode-first) is the aesthetic of consumer apps and cryptocurrency dashboards. ExceptionIQ is being sold to AP analysts, finance controllers, and CFOs who evaluate software on whether it looks serious and reliable. A bank reconciliation tool that looks like a music streaming app will damage sales before the feature demo starts. The Outfit font, while fine aesthetically, is not the concern — the overall design philosophy is.

**Fix:** Replace the glassmorphic dark design system with a clean, professional, light-mode-first design.

**Design direction:**
- **Background:** White (`#FFFFFF`) page, light gray (`#F8F9FA`) sidebar and table headers
- **Primary accent:** Deep blue-indigo (`#3B4EFF` or similar) for buttons, active states, and status chips
- **Typography:** Inter (system-friendly, widely used in B2B SaaS) or keep Outfit if preferred — the font is not the issue, only the glass/dark aesthetic
- **Cards:** Flat white cards with a single 1px border (`#E5E7EB`) and subtle shadow (`0 1px 3px rgba(0,0,0,0.06)`)
- **Tables:** White background, alternating row tint (`#F9FAFB` on odd rows), clear column headers in medium-weight gray text
- **Status chips:** Solid fill with matching text — detected (blue), investigating (amber), resolved (teal), closed (gray), breached (red)
- **SLA countdown:** Color-coded number (green → amber → red as deadline approaches)
- **No gradients, no blur, no dark backgrounds as default**

**`index.css` replaces glassmorphism with:**
```css
:root {
  --color-bg: #FFFFFF;
  --color-surface: #F8F9FA;
  --color-border: #E5E7EB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-accent: #3B4EFF;
  --color-accent-hover: #2D3FD3;
  --color-success: #059669;
  --color-warning: #D97706;
  --color-danger: #DC2626;
  --color-info: #2563EB;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06);
  --radius: 8px;
  --font-body: 'Inter', system-ui, sans-serif;
}

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
}
```

Dark mode is deferred to Phase 2 (post-enterprise launch, if user demand exists).

---

### [FIX 6] `App.tsx` split into a proper component structure

**Problem:** Describing the entire application — navbar, sidebar, dashboard, queue view, detail view, upload view, routing rules — as a single `App.tsx` creates a 1,500–2,000 line unmaintainable file, makes testing impossible, and causes merge conflicts on every feature worked on in parallel.

**Fix:** Enforce a component-per-screen architecture from day one.

**Required file structure:**

```
frontend/src/
├── main.tsx                    # Entry point, router setup
├── App.tsx                     # Shell: Navbar + Sidebar + <Outlet />
├── index.css                   # Global design tokens (fixed in FIX 5)
├── api/
│   └── client.ts               # Axios instance, base URL, auth header
├── components/
│   ├── Navbar.tsx              # Top bar (entity selector, dev tools if enabled)
│   ├── Sidebar.tsx             # Navigation links
│   ├── StatusChip.tsx          # Reusable status badge
│   ├── SeverityBadge.tsx       # Reusable severity badge
│   ├── SlaCountdown.tsx        # Live SLA timer with color coding
│   └── ExceptionTable.tsx      # Reusable sortable/filterable table
├── pages/
│   ├── Dashboard.tsx           # Stats cards + distribution chart (Recharts)
│   ├── ExceptionQueue.tsx      # List view with filters and search
│   ├── ExceptionDetail.tsx     # Full-page exception investigation (NOT a modal)
│   ├── Ingestion.tsx           # File upload + matching trigger
│   └── RoutingRules.tsx        # Rules list + add rule form
└── types/
    └── index.ts                # TypeScript interfaces (Exception, User, Rule, etc.)
```

`App.tsx` becomes a shell only:
```tsx
// App.tsx — shell only, no business logic
export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <Outlet />   {/* React Router v6 */}
        </main>
      </div>
    </div>
  );
}
```

**React Router setup in `main.tsx`:**
```tsx
createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'exceptions', element: <ExceptionQueue /> },
      { path: 'exceptions/:id', element: <ExceptionDetail /> },  // FIX 7
      { path: 'ingestion', element: <Ingestion /> },
      { path: 'routing-rules', element: <RoutingRules /> },
    ],
  },
])
```

---

### [FIX 7] Exception Detail is a dedicated route, not a modal

**Problem:** An exception investigation involves multiple tabs (AI insights, audit log, comments, attachments), a side-by-side transaction comparison, a resolution panel, and a maker-checker approval panel. A modal is designed for quick confirmations. Forcing this workflow into a modal creates broken scroll behaviour, no deep-linkable URL, poor mobile behaviour, and a cramped experience that signals the product was not designed for real investigation work.

**Fix:** Exception detail is a full-page route at `/exceptions/:id`.

**Benefits:**
- Deep-linkable: a manager can send a colleague a direct link to an exception
- Back button works naturally (browser history)
- Full vertical and horizontal space for the investigation layout
- Tab navigation inside the page (Overview | AI Insights | Audit Log | Comments)
- Consistent with how every enterprise SaaS (Jira, ServiceNow, Freshdesk) handles item detail

**`ExceptionDetail.tsx` layout:**
```
/exceptions/:id
┌─────────────────────────────────────────────────────────┐
│ ← Back to Queue   [Exception ID]   [Severity]   [SLA]  │
├──────────────────────────┬──────────────────────────────┤
│  Transaction Context     │  Action Panel                │
│  Bank Entry vs Ledger    │  (Analyst: Resolve form)     │
│  side-by-side            │  (Approver: Approve/Reject)  │
├──────────────────────────┴──────────────────────────────┤
│  Tabs: [Overview] [AI Insights] [Audit Log] [Comments]  │
│  Tab content renders below                              │
└─────────────────────────────────────────────────────────┘
```

Clicking an exception in the queue navigates to this route. The browser back button returns to the queue with filters preserved (via URL search params or sessionStorage).

---

### [FIX 8] Seed script generates 30 exceptions across all statuses

**Problem:** Three exceptions test the workflow but cannot test the queue UI, pagination, filtering, SLA aging visual states, or status distribution charts. The Dashboard will show flat zeros everywhere except three cards, making it look like a broken product during demos.

**Fix:** `seed_db.py` generates 30 synthetic bank reconciliation exceptions spread across:
- 8 `detected` (unrouted, just created)
- 7 `investigating` (assigned to analyst, various SLA states)
- 4 `pending_approval` (resolved by analyst, awaiting approver)
- 6 `closed` (fully approved and closed)
- 3 `breached` (past SLA deadline — important for the SLA breach metric card)
- 2 high-severity `BANK-DUP` exceptions (tests critical severity path)

**Exception codes covered in seed data:**
- `BANK-AMT` (5 records, varying difference amounts)
- `BANK-MISS-LEDGER` (5 records)
- `BANK-MISS-BANK` (5 records)
- `BANK-DUP` (5 records)
- `BANK-DATE` (5 records)
- `BANK-REF` (5 records)

This gives the Dashboard meaningful numbers, the queue a realistic appearance, and allows testing of all filter combinations (by status, severity, exception code).

**`seed_db.py` structure:**
```python
class Command(BaseCommand):
    help = 'Seeds the database with default entity, users, routing rules, and 30 synthetic exceptions'

    def handle(self, *args, **options):
        entity = self._create_entity()
        users = self._create_users(entity)
        self._create_routing_rules(entity, users)
        self._create_exceptions(entity, users)
        self.stdout.write(self.style.SUCCESS('Database seeded successfully'))

    def _create_entity(self): ...
    def _create_users(self, entity): ...       # admin, analyst, approver, manager
    def _create_routing_rules(self, entity, users): ...
    def _create_exceptions(self, entity, users): ...   # 30 records
```

Seed is idempotent: calling `seed_db` on an already-seeded database is safe (uses `get_or_create` throughout).

---

### [FIX 9] `.env` is gitignored — `.env.example` is committed instead

**Problem:** The original plan creates `.env` containing `SECRET_KEY`, `DATABASE_URL`, and `GROQ_API_KEY`. Committing this file to git exposes secrets in the repository history even if the file is later deleted. `SECRET_KEY` in particular is a Django security-critical value.

**Fix:** `.env` is added to `.gitignore`. A `.env.example` file with placeholder values and setup instructions is committed instead.

**`.gitignore` additions:**
```
.env
.env.local
*.pyc
__pycache__/
node_modules/
dist/
```

**`.env.example` (committed to git):**
```bash
# Copy this file to .env and fill in the values
# Never commit .env to git

# Django
DEBUG=True
SECRET_KEY=replace-this-with-a-random-50-char-string
DATABASE_URL=postgresql://postgres:postgres@db:5432/exceptioniq

# Frontend origin (used for CORS in non-debug mode)
FRONTEND_ORIGIN=http://localhost:5173

# AI Service
AI_SERVICE_URL=http://ai_service:8001

# Groq (optional — if not set, rule-based fallback activates)
GROQ_API_KEY=

# Dev Tools (set to true on developer machines only)
VITE_DEV_TOOLS=true
```

**Developer setup instruction (in `README.md`):**
```bash
cp .env.example .env
# Edit .env and set your SECRET_KEY and optionally GROQ_API_KEY
docker compose up --build
```

---

### [FIX 10] Dashboard chart uses Recharts, not CSS

**Problem:** A CSS-only bar chart (using `div` widths as bar heights) is not accessible (no ARIA, no tooltip, no responsive scaling), is brittle to rerender when data changes, and signals to any technical reviewer that the team reached for the wrong tool. React is already in the stack and Recharts requires zero additional setup.

**Fix:** Dashboard distribution chart uses `BarChart` from Recharts.

**`Dashboard.tsx` chart (exception distribution by code):**
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS: Record<string, string> = {
  'BANK-AMT':         '#3B4EFF',
  'BANK-MISS-LEDGER': '#D97706',
  'BANK-MISS-BANK':   '#059669',
  'BANK-DUP':         '#DC2626',
  'BANK-DATE':        '#7C3AED',
  'BANK-REF':         '#0891B2',
};

// data shape: [{ code: 'BANK-AMT', count: 8 }, ...]
<ResponsiveContainer width="100%" height={220}>
  <BarChart data={distributionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
    <XAxis dataKey="code" tick={{ fontSize: 12 }} />
    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
    <Tooltip />
    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
      {distributionData.map((entry) => (
        <Cell key={entry.code} fill={COLORS[entry.code] ?? '#6B7280'} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

Add Recharts to `package.json`:
```bash
npm install recharts
```

---

## Full Revised Infrastructure & Configuration

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: exceptioniq
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    command: >
      sh -c "python manage.py migrate &&
             python manage.py seed_db &&
             python manage.py runserver 0.0.0.0:8000"
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db

  ai_service:
    build: ./ai_service
    command: uvicorn main:app --host 0.0.0.0 --port 8001 --reload
    volumes:
      - ./ai_service:/app
    ports:
      - "8001:8001"
    env_file:
      - .env

  frontend:
    build: ./frontend
    command: npm run dev -- --host
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    env_file:
      - .env
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## Unchanged Elements (Proceed As-Is)

The following items from the original plan are correct and require no changes:

- `django-cors-headers==4.4.0` in `requirements.txt` ✅
- FastAPI CORS middleware in `main.py` ✅
- Local rule-based AI fallback when `GROQ_API_KEY` is absent ✅
- `seed_db` as a Django management command (structure is correct; content expanded in FIX 8) ✅
- `ai_summary` action in `ExceptionViewSet` calling FastAPI ✅
- `approve`, `reject`, `reassign` actions in `ExceptionViewSet` ✅
- Routing service improving SLA date calculation ✅
- Maker-Checker panel in Exception Detail (now a page per FIX 7, not a modal) ✅
- Side-by-side Bank vs Ledger transaction comparison in Exception Detail ✅
- AI Insights tab with `Ask AI` button in Exception Detail ✅
- Activity / Audit Log tab in Exception Detail ✅
- Comment box in Exception Detail ✅
- File upload for CSV statement and ledger in Ingestion view ✅
- `Run Reconciliation Matching` button in Ingestion view ✅
- PDF-to-Markdown drag-and-drop in Ingestion view ✅
- Routing Rules list with simplified rule adder ✅

---

## Revised Verification Plan

### Automated Checks (CI gate before demo)
```bash
# Backend
docker compose exec backend python manage.py test

# Frontend
docker compose exec frontend npm run build   # TypeScript compilation check
docker compose exec frontend npm run lint    # ESLint
```

### Manual Verification Checklist

**Environment:**
1. `cp .env.example .env` and set `SECRET_KEY` (any 50-char string for local)
2. `docker compose up --build`
3. Open `http://localhost:5173`
4. Verify health badge shows **Live**, entity shows **Acme Corporation**

**Seed data:**
5. Go to **Exception Queue** — verify 30 exceptions are visible across statuses
6. Go to **Dashboard** — verify metrics cards show meaningful numbers (not all zeros)
7. Verify SLA Breached card shows **3** (the pre-seeded breached exceptions)
8. Verify the Recharts bar chart shows distribution across 6 exception codes

**Ingestion flow:**
9. Go to **Ingestion** — upload `sample_bank_statement.csv` and `sample_bank_ledger.csv`
10. Click **Run Reconciliation Matching**
11. Verify 3 new exceptions are created (BANK-AMT, BANK-MISS-LEDGER, BANK-MISS-BANK) on top of seed data

**Exception investigation flow (as Analyst — only visible if VITE_DEV_TOOLS=true):**
12. Switch to Analyst role via dev user switcher
13. Open the `BANK-AMT` exception — verify it opens at `/exceptions/:id` (full page, not a modal)
14. Verify Bank vs Ledger side-by-side shows ₹2,100 vs ₹2,000
15. Click **Ask AI** in the AI Insights tab — verify summary loads (rule-based if no Groq key)
16. Add a comment
17. Fill resolution details and click **Resolve** — verify status changes to `pending_approval`

**Maker-Checker flow (as Approver):**
18. Switch to Approver role
19. Open the same exception
20. Verify Maker-Checker panel is visible (not the resolution form)
21. Click **Approve & Close** — verify status changes to `closed`
22. Verify the closed exception appears in Dashboard closed count

**Access control:**
23. Switch to Analyst role
24. Open a `pending_approval` exception
25. Verify the Approver panel is NOT visible (analyst cannot approve their own resolution)

**Dev tools hidden in production build:**
26. Set `VITE_DEV_TOOLS=false` in `.env`
27. Restart frontend container
28. Verify: User Switcher is not visible, Reset button is not visible

**Routing rules:**
29. Go to **Routing Rules** — verify default seeded rules appear
30. Add a new rule — verify it appears in the list

---

## Summary of Changes

| # | Issue | Original Plan | Revised Plan |
|---|---|---|---|
| 1 | `makemigrations` in startup | Runs in docker-compose | Developer runs locally, commits files; container runs `migrate` only |
| 2 | CORS all origins | `CORS_ALLOW_ALL_ORIGINS = True` unconditionally | Gated behind `DEBUG`; uses `CORS_ALLOWED_ORIGINS` in production |
| 3 | User Switcher | Always visible in navbar | `VITE_DEV_TOOLS=true` flag, hidden in staging/production |
| 4 | Reset Database button | Always visible in navbar | `VITE_DEV_TOOLS=true` flag + `DEBUG` guard on backend endpoint |
| 5 | Glassmorphism design | Dark-mode, glassmorphic | Clean light-mode enterprise UI with flat cards and accessible colors |
| 6 | `App.tsx` monolithic | Everything in one file | Component-per-screen architecture with `pages/` and `components/` |
| 7 | Exception Detail as modal | Modal overlay | Dedicated route at `/exceptions/:id` |
| 8 | 3 test exceptions only | 3 hard-coded records | 30 synthetic records across all statuses and exception codes |
| 9 | `.env` committed | `.env` listed as new file | `.env` gitignored; `.env.example` committed with placeholder values |
| 10 | CSS-only chart | `div`-width bar chart | Recharts `BarChart` with color coding and tooltips |
