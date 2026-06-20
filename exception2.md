# ExceptionIQ — Implementation Spec: RBAC, Role Dashboards & PDF Bank Statement Ingestion

> **Document:** `exception2_rbac_pdf_ingestion.md`
> **Version:** 1.0
> **Status:** Implementation Ready
> **Builds on:** `exception1_revised.md`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Role-Based Access Matrix](#2-role-based-access-matrix)
3. [Backend Permission Enforcement](#3-backend-permission-enforcement)
4. [Role-Aware Dashboard Design](#4-role-aware-dashboard-design)
5. [Frontend Role Routing](#5-frontend-role-routing)
6. [PDF Bank Statement Ingestion Pipeline](#6-pdf-bank-statement-ingestion-pipeline)
7. [AI Service: PDF Parser Endpoint](#7-ai-service-pdf-parser-endpoint)
8. [Frontend: Ingestion Page Changes](#8-frontend-ingestion-page-changes)
9. [Backend: Upload Endpoint Extension](#9-backend-upload-endpoint-extension)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Overview

This document specifies three interconnected features:

1. **Role-Based Access Control (RBAC)** — a formal access matrix enforced at the API level via a `RolePermission` class, ensuring each role can only perform actions appropriate to their function.
2. **Role-Specific Dashboards** — when a user logs in, they land on a dashboard personalised for their role showing only the data and actions they need immediately.
3. **PDF Bank Statement Ingestion** — since real bank statements arrive as PDFs (HDFC, SBI, ICICI, Axis, Kotak), the ingestion pipeline must accept PDFs, extract structured rows via the FastAPI AI service, allow preview and correction, then feed confirmed rows into the existing reconciliation engine.

---

## 2. Role-Based Access Matrix

### 2.1 Feature-Level Permissions

| Feature | Admin | Manager | Approver | Analyst | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| View exception list | ✅ | ✅ | ✅ | ✅ | ✅ |
| View exception detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment on exception | ✅ | ✅ | ✅ | ✅ | ❌ |
| Resolve exception | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve resolution | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reject resolution | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reassign exception | ✅ | ✅ | ❌ | ❌ | ❌ |
| Request AI summary | ✅ | ✅ | ❌ | ✅ | ❌ |
| Upload bank statement (PDF/CSV) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Trigger reconciliation run | ✅ | ✅ | ❌ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export audit log | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create / edit routing rules | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage entities | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clear / reset data (debug only) | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.2 API Action Permissions

| ViewSet Action | Minimum Roles Allowed |
|---|---|
| `ExceptionViewSet.list` | All roles |
| `ExceptionViewSet.retrieve` | All roles |
| `ExceptionViewSet.comment` | admin, manager, approver, analyst |
| `ExceptionViewSet.resolve` | admin, manager, analyst |
| `ExceptionViewSet.approve` | admin, manager, approver |
| `ExceptionViewSet.reject` | admin, manager, approver |
| `ExceptionViewSet.reassign` | admin, manager |
| `ExceptionViewSet.ai_summary` | admin, manager, analyst |
| `ReconciliationViewSet.bank_upload` | admin, manager, analyst |
| `ReconciliationViewSet.bank_run` | admin, manager, analyst |
| `ReconciliationViewSet.bank_clear` | admin (+ DEBUG=True) |
| `RoutingRuleViewSet.*` write | admin only |
| `EntityViewSet.*` write | admin only |
| `UserViewSet.*` | admin only |

---

## 3. Backend Permission Enforcement

### 3.1 New file: `backend/apps/api/permissions.py`

```python
from rest_framework.permissions import BasePermission

ROLE_ACTION_MAP = {
    'comment':        {'admin', 'manager', 'approver', 'analyst'},
    'resolve':        {'admin', 'manager', 'analyst'},
    'approve':        {'admin', 'manager', 'approver'},
    'reject':         {'admin', 'manager', 'approver'},
    'reassign':       {'admin', 'manager'},
    'ai_summary':     {'admin', 'manager', 'analyst'},
    'bank_upload':    {'admin', 'manager', 'analyst'},
    'bank_run':       {'admin', 'manager', 'analyst'},
    'bank_clear':     {'admin'},
    'create':         {'admin'},
    'update':         {'admin'},
    'partial_update': {'admin'},
    'destroy':        {'admin'},
}

class RolePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', 'viewer')
        action = getattr(view, 'action', None)
        if action in ('list', 'retrieve', None):
            return True
        allowed = ROLE_ACTION_MAP.get(action, {'admin'})
        return role in allowed
```

### 3.2 `/api/v1/auth/me/` endpoint (add to `views.py`)

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        'id': str(request.user.id),
        'username': request.user.username,
        'email': request.user.email,
        'role': request.user.role,
        'first_name': request.user.first_name,
        'last_name': request.user.last_name,
    })
```

---

## 4. Role-Aware Dashboard Design

### Analyst Dashboard
- **SLA Urgent band** — exceptions in my queue breaching SLA within 8 hours (red)
- **My Queue** — assigned to me, `status IN (routed, investigating)`, ordered by `sla_deadline ASC`
- **Quick Stats** — My Open | Resolved Today | SLA Breached
- **Inline actions** — Resolve, Comment, AI Summary per row
- API: `GET /exceptions/?assigned_to={me}&status=routed,investigating&ordering=sla_deadline`

### Approver Dashboard
- **Pending Approval Queue** — `status=resolved`, oldest first
- **Escalated to Me** — `assigned_to=me`, `status=investigating`
- **Recent Activity** — last 10 audit entries where I approved/rejected

### Manager Dashboard
- **Exception Aging Bar Chart** — open exceptions by age bucket (0–3d, 4–7d, 8–14d, 15–30d, 30+d)
- **SLA Breach Rate** — this week % vs last week %
- **Team Workload Table** — analyst | open | resolved today | SLA breached
- **Escalated Exceptions** — with quick-reassign button

### Admin Dashboard
All manager sections plus:
- **Entity Health Cards** — per entity: open / closed / breach
- **Routing Rules Status** — active count, last triggered
- **User Activity** — last login, exceptions resolved this week
- **System Health** — Django API ping, FastAPI ping, DB status

### Viewer Dashboard
- Read-only exception list with summary cards
- No action buttons, no ingestion, no routing links in navbar

---

## 5. Frontend Role Routing

### `frontend/src/context/AuthContext.tsx` (new file)

```tsx
import { createContext, useContext, useEffect, useState } from 'react'

type User = { id: string; username: string; role: string }
type AuthCtx = { user: User | null; loading: boolean }

const AuthContext = createContext<AuthCtx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/auth/me/', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

### Role-based routing in `App.tsx`

```tsx
function RoleDashboard() {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />
  switch (user.role) {
    case 'analyst':  return <AnalystDashboard />
    case 'approver': return <ApproverDashboard />
    case 'manager':  return <ManagerDashboard />
    case 'admin':    return <AdminDashboard />
    default:         return <ViewerDashboard />
  }
}
```

### Role-aware Navbar items

```tsx
const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/',          roles: ['admin','manager','approver','analyst','viewer'] },
  { label: 'Exceptions',    path: '/exceptions', roles: ['admin','manager','approver','analyst','viewer'] },
  { label: 'Ingestion',     path: '/ingestion',  roles: ['admin','manager','analyst'] },
  { label: 'Routing Rules', path: '/routing',    roles: ['admin'] },
  { label: 'Users',         path: '/users',      roles: ['admin'] },
]
```

---

## 6. PDF Bank Statement Ingestion Pipeline
User uploads PDF
↓
Frontend detects .pdf extension
↓
POST file to FastAPI /parse-bank-pdf
→ PyMuPDF extracts text
→ Regex parser extracts rows: date, amount, Dr/Cr, reference, narration
→ Returns { rows: [...], unparsed_count: N }
↓
Frontend shows editable preview table
→ needs_review=true rows highlighted amber
→ user corrects any cells inline
↓
User clicks "Confirm & Upload"
↓
POST confirmed rows to /api/v1/recon/bank/upload/ as JSON rows array
↓
Normal reconciliation pipeline runs


### Supported bank formats

| Bank | Key columns |
|---|---|
| HDFC | Date, Narration, Chq/Ref No, Withdrawal Amt, Deposit Amt, Closing Balance |
| SBI | Date, Description, Ref No, Debit, Credit, Balance |
| ICICI | Value Date, Txn Date, Cheque No, Remarks, Amount (Dr/Cr), Balance |
| Axis | Tran Date, Chq No, Particulars, Debit, Credit, Balance |
| Kotak | Date, Description, Chq/Ref No, Debit, Credit, Balance |

Rows that cannot be confidently parsed return `needs_review: true` for manual correction.

---

## 7. AI Service: PDF Parser Endpoint

Add to `ai_service/main.py`:

```python
import re
from pydantic import BaseModel

class ParsedRow(BaseModel):
    txn_date: str
    amount: float
    debit_credit: str   # "debit" or "credit"
    reference: str
    narration: str
    counterparty: str
    needs_review: bool

DATE_PATTERN = re.compile(
    r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2}-[A-Za-z]{3}-\d{4})\b'
)
AMOUNT_PATTERN = re.compile(r'[\d,]+\.\d{2}(?:\s*(?:Dr|Cr|dr|cr))?')

def _parse_amount(raw: str) -> tuple[float, str]:
    raw = raw.replace(',', '').strip()
    if raw.lower().endswith('dr'):
        return float(re.sub(r'[^\d.]', '', raw)), 'debit'
    if raw.lower().endswith('cr'):
        return float(re.sub(r'[^\d.]', '', raw)), 'credit'
    try:
        return float(re.sub(r'[^\d.]', '', raw)), 'credit'
    except ValueError:
        return 0.0, 'unknown'

def _extract_rows(text: str) -> list[ParsedRow]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 10:
            continue
        date_match = DATE_PATTERN.search(line)
        amount_matches = AMOUNT_PATTERN.findall(line)
        if not date_match or not amount_matches:
            continue
        raw_amount = amount_matches[-2] if len(amount_matches) >= 2 else amount_matches
        amount, dc = _parse_amount(raw_amount)
        narration = line[date_match.end():].strip()
        for amt in amount_matches:
            narration = narration.replace(amt, '').strip()
        rows.append(ParsedRow(
            txn_date=date_match.group(0),
            amount=amount,
            debit_credit=dc,
            reference='',
            narration=narration[:200],
            counterparty='',
            needs_review=(amount == 0.0 or dc == 'unknown'),
        ))
    return rows

@app.post('/parse-bank-pdf')
async def parse_bank_pdf(file: UploadFile = File(...)):
    content = await file.read()
    doc = fitz.open(stream=content, filetype='pdf')
    full_text = '\n'.join(page.get_text('text') for page in doc)
    rows = _extract_rows(full_text)
    return {
        'rows': [r.model_dump() for r in rows],
        'total': len(rows),
        'unparsed_count': sum(1 for r in rows if r.needs_review),
    }
```

---

## 8. Frontend: Ingestion Page Changes

```tsx
// File type detection
const handleFileDrop = async (file: File) => {
  file.name.endsWith('.pdf')
    ? await handlePdfUpload(file)
    : await handleCsvUpload(file)
}

// PDF → preview
const handlePdfUpload = async (file: File) => {
  setParsing(true)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('http://localhost:8001/parse-bank-pdf', { method: 'POST', body: form })
  const data = await res.json()
  setPreviewRows(data.rows)
  setParsing(false)
}

// Confirm → backend
const handleConfirmUpload = async () => {
  const rows = previewRows.map(r => ({
    txn_date: r.txn_date,
    amount: r.debit_credit === 'debit' ? -Math.abs(r.amount) : Math.abs(r.amount),
    reference: r.reference,
    counterparty: r.counterparty,
    narration: r.narration,
  }))
  await fetch(`${API}/recon/bank/upload/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: selectedEntity, rows, source_type: 'bank' }),
  })
}
```

**Preview table:** editable cells per row, amber background for `needs_review=true` rows, ✅/⚠️ indicator column.

---

## 9. Backend: Upload Endpoint Extension

Extend `bank_upload` in `views.py` to accept `rows` JSON array in addition to `csv_text`:

```python
rows_json = request.data.get('rows', None)
reader = rows_json if rows_json else list(csv.DictReader(io.StringIO(csv_text)))
```

All downstream logic stays the same — the change is a single two-line extension at the top of the handler.

---

## 10. Implementation Checklist

### Phase A — RBAC (Backend)
- [ ] Create `backend/apps/api/permissions.py` with `RolePermission` and `ROLE_ACTION_MAP`
- [ ] Add `permission_classes = [IsAuthenticated, RolePermission]` to all ViewSets
- [ ] Add `/api/v1/auth/me/` endpoint
- [ ] Add `/api/v1/auth/login/` endpoint

### Phase B — Role Dashboards (Frontend)
- [ ] Create `frontend/src/context/AuthContext.tsx`
- [ ] Wrap `App.tsx` in `<AuthProvider>`
- [ ] Create `pages/dashboards/AnalystDashboard.tsx`
- [ ] Create `pages/dashboards/ApproverDashboard.tsx`
- [ ] Create `pages/dashboards/ManagerDashboard.tsx`
- [ ] Create `pages/dashboards/AdminDashboard.tsx`
- [ ] Create `pages/dashboards/ViewerDashboard.tsx`
- [ ] Add `RoleDashboard` router in `App.tsx`
- [ ] Add `Login.tsx` page
- [ ] Update `Navbar.tsx` to filter items by role
- [ ] Hide Resolve / Approve / Reassign buttons by role in `ExceptionDetail.tsx`

### Phase C — PDF Ingestion (AI Service)
- [ ] Add `ParsedRow`, `_parse_amount()`, `_extract_rows()` to `ai_service/main.py`
- [ ] Add `POST /parse-bank-pdf` endpoint
- [ ] Test against HDFC, SBI, ICICI, Axis sample PDFs

### Phase D — PDF Ingestion (Frontend)
- [ ] Extend drop zone in `Ingestion.tsx` to accept `.pdf`
- [ ] Add `handlePdfUpload()` calling `/parse-bank-pdf`
- [ ] Build editable `PreviewTable` component
- [ ] Amber highlight for `needs_review=true` rows
- [ ] "Confirm & Upload" button posting `rows` JSON to backend

### Phase E — Backend Extension
- [ ] Extend `bank_upload` to accept `rows` JSON array
- [ ] Row-level validation before insert
- [ ] Return partial errors without aborting full batch

---

## File Change Summary

| File | Change | Description |
|---|---|---|
| `backend/apps/api/permissions.py` | **New** | RolePermission + ROLE_ACTION_MAP |
| `backend/apps/api/views.py` | **Modified** | permission_classes, /me endpoint, rows JSON in upload |
| `backend/apps/api/urls.py` | **Modified** | auth/me/ and auth/login/ routes |
| `frontend/src/context/AuthContext.tsx` | **New** | useAuth hook |
| `frontend/src/pages/dashboards/*.tsx` | **New ×5** | One dashboard per role |
| `frontend/src/pages/Login.tsx` | **New** | Login form |
| `frontend/src/pages/Ingestion.tsx` | **Modified** | PDF drop + preview table |
| `frontend/src/App.tsx` | **Modified** | AuthProvider + RoleDashboard router |
| `frontend/src/components/Navbar.tsx` | **Modified** | Role-aware nav filtering |
| `ai_service/main.py` | **Modified** | /parse-bank-pdf + parser logic |