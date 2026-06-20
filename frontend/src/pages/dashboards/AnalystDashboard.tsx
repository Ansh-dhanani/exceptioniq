import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord } from '../../types'
import StatusChip from '../../components/StatusChip'
import SeverityBadge from '../../components/SeverityBadge'
import SlaCountdown from '../../components/SlaCountdown'

interface Props {
  entityId: string;
  user: any;
}

export default function AnalystDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!entityId || !user) return
    setLoading(true)
    try {
      // Fetch open exceptions for this entity
      const data = await client.get(`/exceptions/?entity=${entityId}`)
      const list = Array.isArray(data) ? data : data.results || []
      setExceptions(list)
    } catch (err) {
      console.error('Failed to load analyst exceptions', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [entityId, user])

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading Analyst Dashboard...</div>
  }

  // Filter My Queue: assigned to me, status IN (routed, investigating)
  const myQueue = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    (e.status === 'routed' || e.status === 'investigating')
  ).sort((a, b) => {
    if (!a.sla_deadline) return 1
    if (!b.sla_deadline) return -1
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
  })

  // Compute SLA Urgent: breaching within 8 hours
  const now = new Date().getTime()
  const urgentExceptions = myQueue.filter(e => {
    if (!e.sla_deadline) return false
    const deadline = new Date(e.sla_deadline).getTime()
    const diffHours = (deadline - now) / (1000 * 60 * 60)
    return diffHours > 0 && diffHours <= 8
  })

  // Stats
  const myOpenCount = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status !== 'closed' && e.status !== 'approved'
  ).length

  // Resolved Today: resolved state, resolved_at is today
  const todayStr = new Date().toISOString().slice(0, 10)
  const resolvedToday = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status === 'resolved' &&
    e.resolved_at?.startsWith(todayStr)
  ).length

  // My SLA Breached
  const myBreached = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status !== 'closed' && e.status !== 'approved' &&
    e.sla_deadline && new Date(e.sla_deadline).getTime() < now
  ).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Welcome, {user.first_name || user.username} 💼</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Here is your reconciliation task queue and SLA health summary.</p>
      </div>

      {/* SLA Urgent Alert Band */}
      {urgentExceptions.length > 0 && (
        <div style={{
          background: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#991b1b', fontSize: '14px' }}>
                SLA Breach Risk: {urgentExceptions.length} exception(s) require immediate action
              </div>
              <div style={{ color: '#7f1d1d', fontSize: '12px', marginTop: '2px' }}>
                These tasks will breach their resolution window within the next 8 hours.
              </div>
            </div>
          </div>
          <Link
            to={`/exceptions/${urgentExceptions[0].id}`}
            className="btn"
            style={{
              background: '#ef4444',
              color: '#ffffff',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Investigate Next
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid-3">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="stat-label">My Open Tasks</div>
          <div className="stat-value">{myOpenCount}</div>
          <div className="stat-sub">Assigned to you, unresolved</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-resolved)' }}>
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value">{resolvedToday}</div>
          <div className="stat-sub">Pending maker-checker review</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444', background: myBreached > 0 ? '#fef2f2' : 'none' }}>
          <div className="stat-label" style={{ color: myBreached > 0 ? '#b91c1c' : 'inherit' }}>My SLA Breached</div>
          <div className="stat-value" style={{ color: myBreached > 0 ? '#b91c1c' : 'inherit' }}>{myBreached}</div>
          <div className="stat-sub">Overdue resolution window</div>
        </div>
      </div>

      {/* Analyst Queue Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>My Queue ({myQueue.length})</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Open exceptions assigned to your profile, sorted by oldest SLA deadline.</p>
        </div>

        {myQueue.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Exception Code</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Severity</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Variance</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>SLA Deadline</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myQueue.map(exc => (
                  <tr key={exc.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="table-row">
                    <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                      <div>{exc.exception_code}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: '2px' }}>ID: {exc.id.slice(0, 8).toUpperCase()}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <SeverityBadge severity={exc.severity} />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <StatusChip status={exc.status} />
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: parseFloat(exc.amount_difference) > 0 ? 'var(--color-text)' : 'inherit' }}>
                      ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      <SlaCountdown deadlineStr={exc.sla_deadline} status={exc.status} />
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <Link to={`/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}>
                        Investigate 🔍
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            🎉 Excellent work! Your assigned queue is currently empty.
          </div>
        )}
      </div>
    </div>
  )
}
