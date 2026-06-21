import { useNavigate } from 'react-router-dom'

const tags = [
  { code: 'BANK-AMT', desc: 'Amount difference between bank statement and ledger entry' },
  { code: 'BANK-REF', desc: 'Reference number mismatch between bank and ledger' },
  { code: 'BANK-DATE', desc: 'Transaction date difference exceeds tolerance' },
  { code: 'BANK-MISS-LEDGER', desc: 'Bank transaction exists with no matching ledger entry' },
  { code: 'BANK-MISS-BANK', desc: 'Ledger entry exists with no matching bank transaction' },
  { code: 'BANK-DUP', desc: 'Potential duplicate transaction' },
  { code: 'GST-MISS-PR', desc: 'GSTR-2B entry missing from purchase register' },
  { code: 'GST-MISS-GSTR', desc: 'Purchase register entry missing from GSTR-2B' },
  { code: 'GST-AMT', desc: 'Tax amount difference > 1.00 between returns and register' },
  { code: 'TDS-MISS-LEDGER', desc: 'Form 26AS deduction not in TDS ledger' },
  { code: 'TDS-MISS-26AS', desc: 'TDS claimed in ledger missing from Form 26AS' },
  { code: 'TDS-RATE', desc: 'Rate does not match expected section rate (194C, 194J)' },
]

function Btn({ children, variant = 'primary', onClick }: { children: React.ReactNode; variant?: 'primary' | 'secondary'; onClick?: () => void }) {
  const isPrimary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 28px',
        background: isPrimary ? '#111827' : '#fff',
        color: isPrimary ? '#fff' : '#374151',
        border: isPrimary ? 'none' : '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '-0.2px',
      }}
    >
      {children}
    </button>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: '#fff', color: '#111827' }}>
      {/* ─ Nav ─ */}
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
        }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ExceptionIQ</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {['Platform', 'Exception codes', 'Workflow', 'Integrations'].map((link) => (
              <a key={link} href={`#${link.toLowerCase().replace(' ', '-')}`}
                onClick={(e) => { e.preventDefault(); const el = document.getElementById(link.toLowerCase().replace(' ', '-')); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}
                style={{ fontSize: 14, color: '#6B7280', textDecoration: 'none' }}
              >{link}</a>
            ))}
            <button onClick={() => navigate('/login')}
              style={{ padding: '7px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >Sign in</button>
          </div>
        </div>
      </header>

      {/* ─ Hero ─ */}
      <section style={{ padding: '96px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ maxWidth: 700 }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.2px', marginBottom: 20 }}>
            Reconcile bank, GST, and TDS exceptions with maker-checker enforcement
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#6B7280', marginBottom: 36, maxWidth: 580 }}>
            ExceptionIQ ingests bank statements, GSTR-2B returns, and Form 26AS data, runs three reconciliation engines, detects 12 exception types, routes them by amount tier and role, and requires two people to close any exception.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={() => navigate('/login')}>Go to app</Btn>
            <Btn variant="secondary" onClick={() => { const el = document.getElementById('exception-codes'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>
              Exception codes
            </Btn>
          </div>
        </div>
      </section>

      {/* ─ Platform ─ */}
      <section id="platform" style={{ background: '#F9FAFB', padding: '80px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 40, letterSpacing: '-0.5px' }}>Three reconciliation engines</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                title: 'Bank reconciliation',
                sub: 'Reference-first matching with amount fallback. Produces 6 exception codes including amount mismatches, missing entries, and duplicates.',
              },
              {
                title: 'GST reconciliation',
                sub: 'Cross-references GSTR-2B returns against purchase register keyed by (supplier GSTIN, invoice number). Flags missing entries and tax differences above 1.00.',
              },
              {
                title: 'TDS reconciliation',
                sub: 'Cross-references Form 26AS against TDS ledger keyed by (deductor PAN, section code). Also validates TDS rates against expected section rates.',
              },
            ].map((e) => (
              <div key={e.title} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 28,
              }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{e.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0 }}>{e.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─ Exception codes ─ */}
      <section id="exception-codes" style={{ padding: '80px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>12 exception codes the engine detects</h2>
        <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 36, maxWidth: 560 }}>
          Each exception carries a severity level, confidence score, SLA deadline, and is automatically routed based on configured rules.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
        }}>
          {tags.map((t, i) => (
            <div key={t.code} style={{
              padding: '14px 20px',
              background: i % 2 === 0 ? '#fff' : '#F9FAFB',
              borderBottom: i < tags.length - 2 ? '1px solid #e5e7eb' : 'none',
              borderRight: i % 2 === 0 ? '1px solid #e5e7eb' : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <code style={{
                fontSize: 11, fontWeight: 700, color: '#3B4EFF', background: '#EEF2FF',
                padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}>{t.code}</code>
              <span style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.5 }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─ Workflow ─ */}
      <section id="workflow" style={{ background: '#F9FAFB', padding: '80px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 40, letterSpacing: '-0.5px' }}>How the pipeline works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {[
              { num: '01', title: 'Ingest data', body: 'Upload bank PDFs, CSV files, or JSON data. Import GSTR-2B returns and Form 26AS records. Or sync directly from TallyPrime (XML on port 9000) or Zoho Books via OAuth 2.0.' },
              { num: '02', title: 'Run reconciliation', body: 'Each engine runs its matching algorithm. Bank matches on reference then amount. GST compares GSTR-2B vs purchase register. TDS compares Form 26AS vs ledger and validates rates against section constants.' },
              { num: '03', title: 'Route exceptions', body: 'Active routing rules assign exceptions by type and amount. BANK-AMT under 1,000 goes to analyst (24h SLA). Over 1,000 goes to manager (12h SLA).' },
              { num: '04', title: 'Maker resolves, checker approves', body: 'An analyst resolves the exception. A different user (approver or manager) reviews and approves. If rejected, it reopens. The same person cannot do both steps.' },
              { num: '05', title: 'Close the period', body: 'A month-end checklist auto-generates 10 items. Close is blocked until all critical items (bank recon, GST review) are complete.' },
            ].map((s) => (
              <div key={s.num} style={{ display: 'flex', gap: 20 }}>
                <div style={{ width: 40, fontSize: 14, fontWeight: 800, color: '#9CA3AF', flexShrink: 0, letterSpacing: '-0.5px' }}>{s.num}</div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.2px' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0, maxWidth: 640 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─ State machine ─ */}
      <section style={{ padding: '80px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Maker-checker state machine</h2>
        <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 36 }}>Seven states. Two roles required to close. Full audit trail.</p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32,
          padding: '20px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e5e7eb',
        }}>
          {['detected', 'routed', 'investigating', 'pending_approval', 'resolved', 'approved', 'closed'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                color: i < 3 ? '#4B5563' : i < 5 ? '#92400E' : '#065F46',
                background: i < 3 ? '#F3F4F6' : i < 5 ? '#FEF3C7' : '#D1FAE5',
                whiteSpace: 'nowrap',
              }}>{s.replace('_', ' ')}</span>
              {i < 6 && <span style={{ color: '#d1d5db', fontSize: 12 }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { role: 'Analyst (maker)', action: 'Resolve exceptions with resolution code' },
            { role: 'Approver (checker)', action: 'Approve or reject — cannot be same person as resolver' },
            { role: 'Manager / Admin', action: 'Override, reassign, close periods' },
          ].map((r) => (
            <div key={r.role} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.2px' }}>{r.role}</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{r.action}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─ Integrations ─ */}
      <section id="integrations" style={{ background: '#F9FAFB', padding: '80px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 40, letterSpacing: '-0.5px' }}>Integrations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { title: 'TallyPrime', body: 'Connects via XML-over-HTTP on port 9000. Sends TDL requests with company name, parses voucher responses, creates ledger entries.' },
              { title: 'Zoho Books', body: 'OAuth 2.0 flow with auto token refresh. Fetches bank transactions via API, maps to statement lines, triggers discrepancy detection.' },
              { title: 'File upload', body: 'CSV upload, JSON paste, or drag-and-drop PDF. PDFs are parsed by PyMuPDF with regex, shown as editable tables, then confirmed.' },
            ].map((i) => (
              <div key={i.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{i.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0 }}>{i.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─ CTA ─ */}
      <section style={{ padding: '64px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Pre-seeded and ready to explore</h2>
        <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
          30 synthetic exceptions, 4 demo users, 7 routing rules. Sign in with any role to explore the workspace.
        </p>
        <Btn onClick={() => navigate('/login')}>Go to app</Btn>
        <div style={{ marginTop: 16, fontSize: 13, color: '#9CA3AF', display: 'flex', justifyContent: 'center', gap: 20 }}>
          <span>admin / admin</span>
          <span>manager / manager</span>
          <span>approver / approver</span>
          <span>analyst / analyst</span>
        </div>
      </section>

      {/* ─ Footer ─ */}
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '24px 32px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
        ExceptionIQ
      </footer>
    </div>
  )
}
