import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Building2, FileText, FileSpreadsheet, Download, Cog, ArrowLeftRight, CheckCircle, BarChart3, Link as LinkIcon, FolderOpen, ShieldCheck, Settings } from 'lucide-react'

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

const comparisonData = [
  { feature: 'Bank reconciliation', us: true, others: 'Manual in Excel' },
  { feature: 'GST (GSTR-2B vs Purchase Register)', us: true, others: 'Not supported' },
  { feature: 'TDS (Form 26AS vs Ledger)', us: true, others: 'Not supported' },
  { feature: 'Auto-routing by amount & role', us: true, others: 'No routing' },
  { feature: 'Maker-checker workflow', us: true, others: 'No approval flow' },
  { feature: 'Multi-tenant organizations', us: true, others: 'Single tenant' },
  { feature: 'TallyPrime XML sync', us: true, others: 'Requires middleware' },
  { feature: 'Zoho Books OAuth', us: true, others: 'Requires middleware' },
  { feature: 'SLA tracking & breach alerts', us: true, others: 'No SLA' },
  { feature: 'Exportable PDF reports', us: true, others: 'No reports' },
]

function Btn({ children, variant = 'primary', onClick }: { children: React.ReactNode; variant?: 'primary' | 'secondary'; onClick?: () => void }) {
  const [h, s] = useState(false)
  const isPrimary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => s(true)}
      onMouseLeave={() => s(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 28px',
        background: isPrimary ? (h ? '#1f2937' : '#111827') : (h ? '#F3F4F6' : '#fff'),
        color: isPrimary ? '#fff' : (h ? '#111827' : '#374151'),
        border: isPrimary ? 'none' : `1px solid ${h ? '#9CA3AF' : '#d1d5db'}`,
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        letterSpacing: '-0.2px',
        transform: h ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: h ? '0 4px 16px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </button>
  )
}

function Check() {
  return <span style={{ color: '#059669', fontWeight: 700, fontSize: 16 }}>✓</span>
}

function Cross() {
  return <span style={{ color: '#dc2626', fontSize: 16 }}>✗</span>
}

export default function Landing() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const navLinks = ['Platform', 'Comparison', 'Workflow', 'Integrations']
  const [hoverRow, setHoverRow] = useState(-1)
  const [navHover, setNavHover] = useState(-1)

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: '#fff', color: '#111827' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        background: 'rgba(255,255,255,0.85)',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>ExceptionIQ</span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ display: mobile ? 'flex' : 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexDirection: 'column', gap: 4 }}
          >
            <span style={{ display: 'block', width: 20, height: 2, background: '#111827', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 20, height: 2, background: '#111827', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 20, height: 2, background: '#111827', borderRadius: 1 }} />
          </button>
          <div style={{
            display: mobile ? (menuOpen ? 'flex' : 'none') : 'flex',
            position: mobile ? 'absolute' : 'static',
            top: 60, right: 0, left: 0,
            flexDirection: mobile ? 'column' : 'row',
            alignItems: mobile ? 'stretch' : 'center',
            gap: mobile ? 0 : 24,
            background: mobile ? '#fff' : 'none',
            borderBottom: mobile ? '1px solid #e5e7eb' : 'none',
            padding: mobile ? '8px 0' : 0,
          }}>
            {navLinks.map((link, li) => (
              <a key={link} href={`#${link.toLowerCase()}`}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); const el = document.getElementById(link.toLowerCase()); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}
                onMouseEnter={() => setNavHover(li)}
                onMouseLeave={() => setNavHover(-1)}
                style={{ fontSize: 14, color: navHover === li ? '#111827' : '#6B7280', textDecoration: 'none', padding: mobile ? '10px 24px' : 0, borderBottom: mobile ? '1px solid #f3f4f6' : 'none', transition: 'color 0.15s' }}
              >{link}</a>
            ))}
            <button onClick={() => navigate('/login')}
              style={{
                margin: mobile ? '10px 24px' : 0,
                padding: '7px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#1f2937'; (e.target as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#111827'; (e.target as HTMLElement).style.boxShadow = 'none' }}
            >Sign in</button>
          </div>
        </div>
      </header>

      <section style={{ background: 'linear-gradient(180deg, #F9FAFB 0%, #fff 100%)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ padding: mobile ? '64px 24px' : '104px 32px', maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 64 }}>
          <div style={{ flex: '1 1 500px', maxWidth: 720 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20,
              background: '#EEF2FF', color: '#3B4EFF', fontSize: 12, fontWeight: 600,
              marginBottom: 20, letterSpacing: '0.3px',
              boxShadow: '0 1px 2px rgba(59,78,255,0.08)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B4EFF', display: 'inline-block' }} />
              Bank · GST · TDS — one platform
            </div>
          <h1 style={{ fontSize: mobile ? 32 : 48, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-1.2px', marginBottom: 20 }}>
            Automate exception reconciliation across bank, GST, and TDS
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#4B5563', marginBottom: 40, maxWidth: 580 }}>
            ExceptionIQ ingests statements, returns, and ledgers, runs three reconciliation engines, and routes every discrepancy through a maker-checker workflow — so your books stay clean without manual effort.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => navigate('/login')}>Launch app</Btn>
            <Btn variant="secondary" onClick={() => { const el = document.getElementById('comparison'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>
              See comparison
            </Btn>
          </div>
        </div>
        {!mobile && (
          <div style={{ flex: '0 0 420px' }}>
            <svg viewBox="0 0 400 340" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
              <rect x="10" y="10" width="380" height="320" rx="12" fill="#fff" stroke="#e5e7eb" strokeWidth="1" filter="url(#shadow)" />
              <defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="8" flood-opacity="0.06" /></filter></defs>
              <rect x="10" y="10" width="380" height="44" rx="12" fill="#F9FAFB" stroke="#e5e7eb" strokeWidth="1" />
              <circle cx="32" cy="32" r="6" fill="#dc2626" />
              <circle cx="48" cy="32" r="6" fill="#f59e0b" />
              <circle cx="64" cy="32" r="6" fill="#10b981" />
              <rect x="100" y="24" width="120" height="16" rx="4" fill="#111827" opacity="0.15" />
              <rect x="340" y="24" width="40" height="16" rx="4" fill="#3B4EFF" />
              <text x="350" y="35" fill="#fff" fontSize="8" fontWeight="600" fontFamily="Inter">LIVE</text>
              <rect x="30" y="70" width="160" height="100" rx="8" fill="#F9FAFB" stroke="#e5e7eb" strokeWidth="1" />
              <rect x="42" y="82" width="60" height="10" rx="3" fill="#111827" opacity="0.1" />
              <rect x="42" y="98" width="80" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="42" y="112" width="70" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="42" y="126" width="90" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="42" y="144" width="100" height="18" rx="4" fill="#3B4EFF" />
              <text x="92" y="156" fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter">View All</text>
              <rect x="210" y="70" width="160" height="100" rx="8" fill="#F9FAFB" stroke="#e5e7eb" strokeWidth="1" />
              <rect x="222" y="82" width="60" height="10" rx="3" fill="#111827" opacity="0.1" />
              <rect x="222" y="98" width="135" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="222" y="112" width="120" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="222" y="126" width="100" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="222" y="144" width="135" height="18" rx="4" fill="#059669" />
              <text x="289" y="156" fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter">Resolve Exception</text>
              <rect x="30" y="190" width="340" height="50" rx="8" fill="#F9FAFB" stroke="#e5e7eb" strokeWidth="1" />
              <rect x="42" y="202" width="80" height="10" rx="3" fill="#111827" opacity="0.1" />
              <rect x="42" y="218" width="140" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="290" y="200" width="68" height="28" rx="6" fill="#FEF3C7" stroke="#f59e0b" strokeWidth="1" />
              <text x="324" y="218" fill="#92400E" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter">Pending</text>
              <rect x="30" y="252" width="340" height="50" rx="8" fill="#F9FAFB" stroke="#e5e7eb" strokeWidth="1" />
              <rect x="42" y="264" width="80" height="10" rx="3" fill="#111827" opacity="0.1" />
              <rect x="42" y="280" width="140" height="8" rx="3" fill="#111827" opacity="0.06" />
              <rect x="290" y="262" width="68" height="28" rx="6" fill="#D1FAE5" stroke="#10b981" strokeWidth="1" />
              <text x="324" y="280" fill="#065F46" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter">Resolved</text>
              <rect x="30" y="314" width="120" height="4" rx="2" fill="#e5e7eb" />
              <rect x="30" y="314" width="72" height="4" rx="2" fill="#3B4EFF" />
            </svg>
          </div>
        )}
        </div>
      </section>

      <section style={{ background: '#F9FAFB', padding: mobile ? '48px 24px' : '64px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          {[
            { value: '12', label: 'Exception types detected' },
            { value: '3', label: 'Reconciliation engines' },
            { value: '5', label: 'User roles' },
            { value: '10+', label: 'Integrations & imports' },
          ].map((s, si) => (
            <div key={s.label} style={{ textAlign: 'center', flex: '1 1 120px', position: 'relative' }}>
              {si > 0 && <div style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', width: 1, height: 40, background: '#e5e7eb', display: mobile ? 'none' : 'block' }} />}
              <div style={{ fontSize: 36, fontWeight: 700, color: '#111827', letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#4B5563', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" style={{ padding: mobile ? '64px 24px' : '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>Three reconciliation engines under one roof</h2>
        <p style={{ fontSize: 15, color: '#4B5563', marginBottom: 48, maxWidth: 540 }}>
          Instead of juggling three separate tools, run all your reconciliations in one place with a unified workflow.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              icon: Building2, title: 'Bank reconciliation',
              body: 'Matches bank statements against ledger entries using reference-first matching with amount fallback. Flags amount mismatches, missing entries, and potential duplicates.',
            },
            {
              icon: FileText, title: 'GST reconciliation',
              body: 'Cross-references GSTR-2B returns against purchase registers by supplier GSTIN and invoice number. Flags missing entries and tax differences above your configured tolerance.',
            },
            {
              icon: FileSpreadsheet, title: 'TDS reconciliation',
              body: 'Cross-references Form 26AS against TDS ledgers by deductor PAN and section code. Validates deduction rates against statutory section rates (194C, 194J, etc.).',
            },
          ].map((e) => (
            <div key={e.title} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 28,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.02)',
            }}>
              <e.icon size={28} strokeWidth={1.5} style={{ marginBottom: 14, color: '#3B4EFF' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' }}>{e.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#4B5563', margin: 0 }}>{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="comparison" style={{ background: '#F9FAFB', padding: mobile ? '64px 24px' : '88px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>What ExceptionIQ does that others don't</h2>
          <p style={{ fontSize: 15, color: '#4B5563', marginBottom: 36, maxWidth: 540 }}>
            Most teams piece together Excel sheets, Tally reports, and manual emails. ExceptionIQ replaces all of that with one automated pipeline.
          </p>
          <div style={{
            border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
            background: '#fff',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: mobile ? '1.5fr 0.8fr 1fr' : '2fr 0.8fr 1.5fr',
              background: '#111827', color: '#fff', padding: '12px 20px',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase',
            }}>
              <div>Feature</div>
              <div style={{ textAlign: 'center' }}>ExceptionIQ</div>
              <div style={{ textAlign: 'center' }}>Spreadsheets / Other tools</div>
            </div>
            {comparisonData.map((row, i) => (
              <div key={row.feature}
                onMouseEnter={() => setHoverRow(i)}
                onMouseLeave={() => setHoverRow(-1)}
                style={{
                display: 'grid', gridTemplateColumns: mobile ? '1.5fr 0.8fr 1fr' : '2fr 0.8fr 1.5fr',
                padding: '12px 20px',
                borderBottom: i < comparisonData.length - 1 ? '1px solid #e5e7eb' : 'none',
                background: hoverRow === i ? '#F3F4F6' : (i % 2 === 0 ? '#fff' : '#F9FAFB'),
                fontSize: 14,
                transition: 'background 0.15s',
                cursor: 'default',
              }}>
                <div style={{ color: '#111827', fontWeight: 600 }}>{row.feature}</div>
                <div style={{ textAlign: 'center' }}>{row.us ? <Check /> : <Cross />}</div>
                <div style={{ textAlign: 'center', color: '#4B5563', fontSize: 13 }}>{row.others}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" style={{ padding: mobile ? '64px 24px' : '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>How the pipeline works</h2>
        <p style={{ fontSize: 15, color: '#4B5563', marginBottom: 48, maxWidth: 540 }}>
          From raw data to a signed-off period close — the platform handles every step.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {[
            { num: '01', icon: Download, title: 'Ingest data', body: 'Upload bank PDFs, CSV files, or JSON. Import GSTR-2B returns and Form 26AS records. Or sync directly from TallyPrime or Zoho Books via OAuth.' },
            { num: '02', icon: Cog, title: 'Reconcile', body: 'Each engine runs its matching algorithm. Bank matches on reference then amount. GST compares returns against purchase registers. TDS validates ledgers against Form 26AS and statutory rates.' },
            { num: '03', icon: ArrowLeftRight, title: 'Route exceptions', body: 'Active routing rules assign discrepancies by type and amount. Low-value items go to analysts with standard SLAs. High-value items escalate to managers with tighter deadlines.' },
            { num: '04', icon: CheckCircle, title: 'Two-person approval', body: 'An analyst resolves the exception. A different user reviews and signs off. If rejected, the item reopens. The same person cannot perform both steps.' },
            { num: '05', icon: BarChart3, title: 'Close the period', body: 'A month-end checklist auto-generates items. The period stays open until all critical tasks are completed and approved.' },
          ].map((s) => (
            <div key={s.num} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#F3F4F6', border: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <s.icon size={18} strokeWidth={1.5} style={{ color: '#3B4EFF' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>{s.num}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#4B5563', margin: 0, maxWidth: 640 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#F9FAFB', padding: mobile ? '64px 24px' : '88px 32px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>Maker-checker state machine</h2>
          <p style={{ fontSize: 15, color: '#4B5563', marginBottom: 36, maxWidth: 540 }}>
            Seven states. Two roles required to close. Every action logged to audit trail.
          </p>
          <div style={{
            padding: mobile ? '20px' : '28px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.02)',
          }}>
            {mobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { name: 'Detected', desc: 'Engine flags the mismatch', color: '#3B4EFF', bg: '#EEF2FF' },
                  { name: 'Routed', desc: 'Rules assign to the right team', color: '#3B4EFF', bg: '#EEF2FF' },
                  { name: 'Investigating', desc: 'Analyst reviews the discrepancy', color: '#D97706', bg: '#FEF3C7' },
                  { name: 'Pending Approval', desc: 'Checker must approve the fix', color: '#D97706', bg: '#FEF3C7' },
                  { name: 'Resolved', desc: 'Resolution approved and applied', color: '#059669', bg: '#D1FAE5' },
                  { name: 'Approved', desc: 'Manager confirms period close', color: '#059669', bg: '#D1FAE5' },
                  { name: 'Closed', desc: 'Archived to immutable log', color: '#6B7280', bg: '#F3F4F6' },
                ].map((s, i) => (
                  <div key={s.name}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.name}</span>
                        <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>{s.desc}</span>
                      </div>
                    </div>
                    {i < 6 && <div style={{ marginLeft: 4, paddingLeft: 4, paddingTop: 4 }}><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9L3 6h6l-3 3z" fill="#d1d5db"/></svg></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0 }}>
                {[
                  { name: 'Detected', desc: 'Engine flags mismatch', color: '#3B4EFF', bg: '#EEF2FF' },
                  { name: 'Routed', desc: 'Rules assign team', color: '#3B4EFF', bg: '#EEF2FF' },
                  { name: 'Investigating', desc: 'Analyst reviews', color: '#D97706', bg: '#FEF3C7' },
                  { name: 'Pending Approval', desc: 'Checker approves', color: '#D97706', bg: '#FEF3C7' },
                  { name: 'Resolved', desc: 'Fix applied', color: '#059669', bg: '#D1FAE5' },
                  { name: 'Approved', desc: 'Manager confirms', color: '#059669', bg: '#D1FAE5' },
                  { name: 'Closed', desc: 'Audit archived', color: '#6B7280', bg: '#F3F4F6' },
                ].map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <div style={{ textAlign: 'center', width: 110 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, margin: '0 auto 8px', boxShadow: `0 0 0 3px ${s.bg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, lineHeight: 1.3 }}>{s.desc}</div>
                    </div>
                    {i < 6 && (
                      <svg width="20" height="20" viewBox="0 0 20 20" style={{ color: '#d1d5db', flexShrink: 0 }}>
                        <path d="M8 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginTop: 28 }}>
            {[
              { role: 'Analyst (maker)', action: 'Resolve exceptions with a resolution code and supporting notes', icon: CheckCircle },
              { role: 'Approver (checker)', action: 'Approve or reject resolutions — must be different from the resolver', icon: ShieldCheck },
              { role: 'Manager / Admin', action: 'Override assignments, reassign work, and close periods', icon: Settings },
            ].map((r) => (
              <div key={r.role} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.02)' }}>
                <r.icon size={18} strokeWidth={1.5} style={{ color: '#3B4EFF', marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#111827' }}>{r.role}</div>
                <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>{r.action}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="integrations" style={{ padding: mobile ? '64px 24px' : '88px 32px', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>Connect your existing tools</h2>
        <p style={{ fontSize: 15, color: '#4B5563', marginBottom: 48, maxWidth: 540 }}>
          Import data the way it already lives — no manual reformatting required.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: LinkIcon, title: 'TallyPrime', body: 'Connects via XML-over-HTTP on port 9000. Sends TDL requests, parses voucher responses, and creates ledger entries automatically.' },
            { icon: LinkIcon, title: 'Zoho Books', body: 'OAuth 2.0 integration with automatic token refresh. Fetches bank transactions via API and maps them to statement lines.' },
            { icon: FolderOpen, title: 'File upload', body: 'CSV upload, JSON paste, or drag-and-drop PDF. PDFs are parsed by PyMuPDF with regex and shown as editable tables before confirmation.' },
          ].map((i) => (
            <div key={i.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.02)' }}>
              <i.icon size={24} strokeWidth={1.5} style={{ marginBottom: 14, color: '#3B4EFF' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#111827' }}>{i.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#4B5563', margin: 0 }}>{i.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#111827', padding: mobile ? '56px 24px' : '80px 32px', textAlign: 'center', borderTop: '1px solid #1f2937', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: '#fff', letterSpacing: '-0.5px' }}>Ready to get started?</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
          Pre-seeded with 30 synthetic exceptions and 4 demo accounts. No setup required — sign in instantly.
        </p>
        <Btn onClick={() => navigate('/login')}>Launch app</Btn>
        <div style={{ marginTop: 20, fontSize: 13, color: '#6B7280', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <span>admin / admin</span>
          <span>manager / manager</span>
          <span>approver / approver</span>
          <span>analyst / analyst</span>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #e5e7eb', background: '#F9FAFB', padding: mobile ? '40px 24px' : '48px 32px 32px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: mobile ? 'column' : 'row', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px', marginBottom: 8 }}>ExceptionIQ</div>
            <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
              Automate exception reconciliation across bank, GST, and TDS with a maker-checker workflow.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Navigate</div>
            {navLinks.map(link => {
              const id = link.toLowerCase()
              return (
                <a key={link} href={`#${id}`}
                  onClick={(e) => { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}
                  style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = '#111827'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = '#6B7280'}
                >{link}</a>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Account</div>
            <a onClick={() => navigate('/login')} style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#111827'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#6B7280'}>Sign in</a>
            <a onClick={() => navigate('/register')} style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#111827'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#6B7280'}>Create account</a>
          </div>
        </div>
        <div style={{ maxWidth: 1120, margin: '32px auto 0', borderTop: '1px solid #e5e7eb', paddingTop: 20, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
          &copy; {new Date().getFullYear()} ExceptionIQ. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
