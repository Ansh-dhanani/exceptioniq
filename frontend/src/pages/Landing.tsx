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
        fontWeight: 600,
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
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>ExceptionIQ</span>
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

      <section style={{ padding: '104px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-1.2px', marginBottom: 20 }}>
            Automate exception reconciliation across bank, GST, and TDS
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#6B7280', marginBottom: 40, maxWidth: 580 }}>
            ExceptionIQ ingests statements, returns, and ledgers, runs three reconciliation engines, and routes every discrepancy through a maker-checker workflow — so your books stay clean without manual effort.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={() => navigate('/login')}>Launch app</Btn>
            <Btn variant="secondary" onClick={() => { const el = document.getElementById('exception-codes'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>
              View exception codes
            </Btn>
          </div>
        </div>
      </section>

      <section style={{ background: '#F9FAFB', padding: '64px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 32 }}>
          {[
            { value: '12', label: 'Exception types detected' },
            { value: '3', label: 'Reconciliation engines' },
            { value: '5', label: 'User roles with granular permissions' },
            { value: '4', label: 'Demo accounts to explore' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#111827', letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" style={{ padding: '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 48, letterSpacing: '-0.5px' }}>Three reconciliation engines under one roof</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              title: 'Bank reconciliation',
              body: 'Matches bank statements against ledger entries using reference-first matching with amount fallback. Flags amount mismatches, missing entries, and duplicates.',
            },
            {
              title: 'GST reconciliation',
              body: 'Cross-references GSTR-2B returns against purchase registers by supplier GSTIN and invoice number. Flags missing entries and tax differences above 1.00.',
            },
            {
              title: 'TDS reconciliation',
              body: 'Cross-references Form 26AS against TDS ledgers by deductor PAN and section code. Validates deduction rates against statutory section rates.',
            },
          ].map((e) => (
            <div key={e.title} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 28,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{e.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0 }}>{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="exception-codes" style={{ background: '#F9FAFB', padding: '88px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>12 exception codes the engine detects</h2>
          <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 36, maxWidth: 540 }}>
            Each exception carries a severity level, SLA deadline, and is routed automatically based on configured rules.
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
        </div>
      </section>

      <section id="workflow" style={{ padding: '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 48, letterSpacing: '-0.5px' }}>How the pipeline works</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {[
            { num: '01', title: 'Ingest data', body: 'Upload bank PDFs, CSV files, or JSON. Import GSTR-2B returns and Form 26AS records. Or sync directly from TallyPrime or Zoho Books via OAuth.' },
            { num: '02', title: 'Reconcile', body: 'Each engine runs its matching algorithm. Bank matches on reference then amount. GST compares returns against purchase registers. TDS validates ledgers against Form 26AS and statutory rates.' },
            { num: '03', title: 'Route exceptions', body: 'Active routing rules assign discrepancies by type and amount. Low-value items go to analysts with standard SLAs. High-value items escalate to managers with tighter deadlines.' },
            { num: '04', title: 'Resolve and approve', body: 'An analyst resolves the exception. A different user — an approver or manager — reviews and signs off. If rejected, the item reopens. The same person cannot perform both steps.' },
            { num: '05', title: 'Close the period', body: 'A month-end checklist auto-generates items. The period stays open until all critical tasks — bank recon, GST review, TDS verification — are completed and approved.' },
          ].map((s) => (
            <div key={s.num} style={{ display: 'flex', gap: 20 }}>
              <div style={{ width: 36, fontSize: 14, fontWeight: 600, color: '#9CA3AF', flexShrink: 0 }}>{s.num}</div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0, maxWidth: 640 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#F9FAFB', padding: '88px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.5px' }}>Maker-checker state machine</h2>
          <p style={{ fontSize: 15, color: '#6B7280', marginBottom: 36 }}>Seven states. Two roles required to close. Full audit trail on every exception.</p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32,
            padding: '20px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
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
              { role: 'Analyst (maker)', action: 'Resolve exceptions with resolution code and supporting notes' },
              { role: 'Approver (checker)', action: 'Approve or reject resolutions — must be different from the resolver' },
              { role: 'Manager / Admin', action: 'Override assignments, reassign work, and close periods' },
            ].map((r) => (
              <div key={r.role} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fff' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.role}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{r.action}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="integrations" style={{ padding: '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 48, letterSpacing: '-0.5px' }}>Connect your existing tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { title: 'TallyPrime', body: 'Connects via XML-over-HTTP on port 9000. Sends TDL requests, parses voucher responses, and creates ledger entries automatically.' },
            { title: 'Zoho Books', body: 'OAuth 2.0 integration with automatic token refresh. Fetches bank transactions via API and maps them to statement lines.' },
            { title: 'File upload', body: 'CSV upload, JSON paste, or drag-and-drop PDF. PDFs are parsed by PyMuPDF with regex and shown as editable tables.' },
          ].map((i) => (
            <div key={i.title} style={{ background: '#F9FAFB', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{i.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#6B7280', margin: 0 }}>{i.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#111827', padding: '80px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: '#fff', letterSpacing: '-0.5px' }}>Ready to get started?</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
          Pre-seeded with 30 synthetic exceptions and 4 demo users. Sign in instantly with any role to explore.
        </p>
        <Btn onClick={() => navigate('/login')}>Launch app</Btn>
        <div style={{ marginTop: 20, fontSize: 13, color: '#6B7280', display: 'flex', justifyContent: 'center', gap: 24 }}>
          <span>admin / admin</span>
          <span>manager / manager</span>
          <span>approver / approver</span>
          <span>analyst / analyst</span>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '24px 32px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
        ExceptionIQ
      </footer>
    </div>
  )
}
