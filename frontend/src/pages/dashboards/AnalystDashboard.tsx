import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, MonthEndPeriod } from '../../types'
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
  const [latestClosePeriod, setLatestClosePeriod] = useState<MonthEndPeriod | null>(null)

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
      console.error('Failed to load analyst exceptions', err)
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

  const myQueue = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    (e.status === 'routed' || e.status === 'investigating')
  ).sort((a, b) => {
    if (!a.sla_deadline) return 1
    if (!b.sla_deadline) return -1
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
  })

  const now = new Date().getTime()
  const urgentExceptions = myQueue.filter(e => {
    if (!e.sla_deadline) return false
    const deadline = new Date(e.sla_deadline).getTime()
    const diffHours = (deadline - now) / (1000 * 60 * 60)
    return diffHours > 0 && diffHours <= 8
  })

  const myOpenCount = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status !== 'closed' && e.status !== 'approved'
  ).length

  const todayStr = new Date().toISOString().slice(0, 10)
  const resolvedToday = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status === 'resolved' &&
    e.resolved_at?.startsWith(todayStr)
  ).length

  const myBreached = exceptions.filter(e =>
    e.assigned_to?.id === user.id &&
    e.status !== 'closed' && e.status !== 'approved' &&
    e.sla_deadline && new Date(e.sla_deadline).getTime() < now
  ).length

  const myPendingChecklistCount = latestClosePeriod?.items?.filter(
    item => item.assigned_to?.id === user.id && !item.is_complete
  ).length || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1>Analyst Dashboard</h1>

      {urgentExceptions.length > 0 && (
        <div style={{
          background: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#991b1b', fontSize: '14px' }}>
              {urgentExceptions.length} exception(s) breaching SLA within 8 hours
            </div>
          </div>
          <Link
            to={`/app/exceptions/${urgentExceptions[0].id}`}
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

      {myPendingChecklistCount > 0 && (
        <div style={{
          background: '#e0e7ff',
          borderLeft: '4px solid #4F46E5',
          borderRadius: '4px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#312e81', fontSize: '14px' }}>
              {myPendingChecklistCount} pending month-end close task(s)
            </div>
          </div>
          <Link
            to="/app/close"
            className="btn"
            style={{
              background: '#4F46E5',
              color: '#ffffff',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            View My Tasks
          </Link>
        </div>
      )}

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">My Open Tasks</div>
          <div className="stat-value">{myOpenCount}</div>
          <div className="stat-sub">Assigned to you</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value">{resolvedToday}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>

        <div className="stat-card" style={{ background: myBreached > 0 ? '#fef2f2' : 'none' }}>
          <div className="stat-label" style={{ color: myBreached > 0 ? '#b91c1c' : 'inherit' }}>SLA Breached</div>
          <div className="stat-value" style={{ color: myBreached > 0 ? '#b91c1c' : 'inherit' }}>{myBreached}</div>
          <div className="stat-sub">Overdue resolution</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>My Queue ({myQueue.length})</h2>
        </div>

        {myQueue.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Exception Code</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th>SLA Deadline</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myQueue.map(exc => (
                  <tr key={exc.id}>
                    <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600 }}>
                      <div>{exc.exception_code}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: '2px' }}>ID: {exc.id.slice(0, 8).toUpperCase()}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <SeverityBadge severity={exc.severity} />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <StatusChip status={exc.status} />
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                      ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      <SlaCountdown deadlineStr={exc.sla_deadline} status={exc.status} />
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <Link to={`/app/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}>
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Your queue is empty.
          </div>
        )}
      </div>
    </div>
  )
}
