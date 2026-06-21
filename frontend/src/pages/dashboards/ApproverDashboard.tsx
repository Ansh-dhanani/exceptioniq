import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, AuditLog, MonthEndPeriod } from '../../types'
import StatusChip from '../../components/StatusChip'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function ApproverDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [latestClosePeriod, setLatestClosePeriod] = useState<MonthEndPeriod | null>(null)

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const res = await fetch('http://localhost:8000/api/v1/exceptions/export-pdf-report/', {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to generate report')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'exceptioniq_executive_report.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const fetchData = async () => {
    if (!entityId || !user) return
    setLoading(true)
    try {
      const data = await client.get(`/exceptions/?entity=${entityId}`)
      const list = Array.isArray(data) ? data : data.results || []
      setExceptions(list)

      const closePeriods = await client.get(`/close/?entity=${entityId}`)
      const periodsList = Array.isArray(closePeriods) ? closePeriods : closePeriods.results || []
      if (periodsList.length > 0) {
        const detail = await client.get(`/close/${periodsList[0].id}/`)
        setLatestClosePeriod(detail)
      } else {
        setLatestClosePeriod(null)
      }
    } catch (err) {
      console.error('Failed to load approver exceptions', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [entityId, user])

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>
  }

  const pendingApprovals = exceptions.filter(e => e.status === 'resolved')
    .sort((a, b) => new Date(a.resolved_at || a.updated_at).getTime() - new Date(b.resolved_at || b.updated_at).getTime())

  const escalatedQueue = exceptions.filter(e =>
    e.assigned_to?.id === user.id && e.status === 'investigating'
  )

  const myActivities: { exceptionId: string; code: string; action: string; timestamp: string; metadata: any }[] = []
  exceptions.forEach(exc => {
    (exc.audit_logs || []).forEach((log: AuditLog) => {
      if (log.user?.id === user.id && (log.action === 'approved' || log.action === 'rejected')) {
        myActivities.push({
          exceptionId: exc.id,
          code: exc.exception_code,
          action: log.action,
          timestamp: log.created_at,
          metadata: log.metadata
        })
      }
    })
  })
  const sortedActivities = myActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Approver Console</h1>
        <button 
          onClick={handleExportPDF} 
          disabled={exporting}
          className="btn btn-primary"
        >
          {exporting ? 'Generating...' : 'Export Executive Report'}
        </button>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Pending My Approval</div>
          <div className="stat-value">{pendingApprovals.length}</div>
          <div className="stat-sub">Awaiting maker-checker sign-off</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Escalated to Me</div>
          <div className="stat-value">{escalatedQueue.length}</div>
          <div className="stat-sub">Open cases requiring senior review</div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="stat-label">Month-End Close Progress</span>
              <span style={{
                fontSize: '10px',
                background: latestClosePeriod?.status === 'closed' ? '#d1fae5' : '#fef3c7',
                color: latestClosePeriod?.status === 'closed' ? '#065f46' : '#d97706',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {latestClosePeriod ? latestClosePeriod.status.replace('_', ' ') : 'Not Started'}
              </span>
            </div>
            
            {latestClosePeriod ? (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span>Period: <b>{latestClosePeriod.period}</b></span>
                  <span style={{ fontWeight: 700 }}>
                    {latestClosePeriod.items && latestClosePeriod.items.length > 0
                      ? Math.round((latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100)
                      : 0}%
                  </span>
                </div>
                
                <div style={{ width: '100%', height: '4px', background: '#cbd5e1', borderRadius: '2px', overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{
                    width: `${latestClosePeriod.items && latestClosePeriod.items.length > 0
                      ? (latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100
                      : 0}%`,
                    height: '100%',
                    background: '#10b981',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>Completed: <b>{latestClosePeriod.items?.filter(it => it.is_complete).length}</b> / <b>{latestClosePeriod.items?.length}</b></span>
                  {latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length ? (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length} Critical
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                No active checklist.
              </div>
            )}
          </div>
          
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/app/close" style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
              View Checklist →
            </Link>
          </div>
        </div>

        {/* Month-End Close Checklist Status Card */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="stat-label">Month-End Close Progress</span>
              <span style={{
                fontSize: '10px',
                background: latestClosePeriod?.status === 'closed' ? '#d1fae5' : '#fef3c7',
                color: latestClosePeriod?.status === 'closed' ? '#065f46' : '#d97706',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {latestClosePeriod ? latestClosePeriod.status.replace('_', ' ') : 'Not Started'}
              </span>
            </div>
            
            {latestClosePeriod ? (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span>Period: <b>{latestClosePeriod.period}</b></span>
                  <span style={{ fontWeight: 700 }}>
                    {latestClosePeriod.items && latestClosePeriod.items.length > 0
                      ? Math.round((latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100)
                      : 0}%
                  </span>
                </div>
                
                <div style={{ width: '100%', height: '4px', background: '#cbd5e1', borderRadius: '2px', overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{
                    width: `${latestClosePeriod.items && latestClosePeriod.items.length > 0
                      ? (latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100
                      : 0}%`,
                    height: '100%',
                    background: '#10b981',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>Completed: <b>{latestClosePeriod.items?.filter(it => it.is_complete).length}</b> / <b>{latestClosePeriod.items?.length}</b></span>
                  {latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length ? (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      ⚠️ {latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length} Critical
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                No active checklist generated.
              </div>
            )}
          </div>
          
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/close" style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
              View Checklist →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Pending Approval ({pendingApprovals.length})</h3>
          </div>

          {pendingApprovals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Exception</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map(exc => (
                    <tr key={exc.id}>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600 }}>{exc.exception_code}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Resolved: <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>{exc.resolution_code}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                        ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <Link to={`/app/exceptions/${exc.id}`} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px', textDecoration: 'none', display: 'inline-block', background: '#8b5cf6' }}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No exceptions awaiting approval.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Escalated To Me ({escalatedQueue.length})</h3>
            </div>
            {escalatedQueue.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {escalatedQueue.map(exc => (
                      <tr key={exc.id}>
                        <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                          <div style={{ fontWeight: 600 }}>{exc.exception_code}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ID: {exc.id.slice(0, 8)}</div>
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <SeverityBadge severity={exc.severity} />
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          <Link to={`/app/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No active escalations.
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>My Recent Actions</h3>
            </div>
            {sortedActivities.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: '12px 24px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedActivities.map((act, idx) => (
                  <li key={idx} style={{ fontSize: '12px', borderBottom: idx < sortedActivities.length - 1 ? '1px solid var(--color-border)' : 'none', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <Link to={`/app/exceptions/${act.exceptionId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                        {act.code}
                      </Link>
                      <span style={{
                        color: act.action === 'approved' ? '#059669' : '#dc2626',
                        textTransform: 'uppercase',
                        fontSize: '10px'
                      }}>
                        {act.action}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {act.metadata?.note || act.metadata?.reason || '-'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No approval activity yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
