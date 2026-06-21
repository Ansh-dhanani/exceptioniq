import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, MonthEndPeriod } from '../../types'
import StatusChip from '../../components/StatusChip'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function ViewerDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [latestClosePeriod, setLatestClosePeriod] = useState<MonthEndPeriod | null>(null)

  const fetchData = async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const data = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(data) ? data : data.results || [])

      const closePeriods = await client.get(`/close/?entity=${entityId}`)
      const periodsList = Array.isArray(closePeriods) ? closePeriods : closePeriods.results || []
      if (periodsList.length > 0) {
        const detail = await client.get(`/close/${periodsList[0].id}/`)
        setLatestClosePeriod(detail)
      } else {
        setLatestClosePeriod(null)
      }
    } catch (err) {
      console.error('Failed to load viewer dashboard', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [entityId])

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>
  }

  const openExceptions = exceptions.filter(e => e.status !== 'closed' && e.status !== 'approved')
  const closedExceptions = exceptions.filter(e => e.status === 'closed' || e.status === 'approved')
  const now = new Date().getTime()
  const breachedExceptions = openExceptions.filter(e => e.sla_deadline && new Date(e.sla_deadline).getTime() < now)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1>Viewer Dashboard</h1>

      {latestClosePeriod && (
        <div style={{
          background: latestClosePeriod.status === 'closed' ? '#f0fdf4' : '#eff6ff',
          border: `1px solid ${latestClosePeriod.status === 'closed' ? '#bbf7d0' : '#bfdbfe'}`,
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: latestClosePeriod.status === 'closed' ? '#166534' : '#1e40af' }}>
              Month-End Close ({latestClosePeriod.period}): {latestClosePeriod.status === 'closed' ? 'Period Closed' : latestClosePeriod.status === 'in_progress' ? 'In Progress' : 'Open'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {latestClosePeriod.status === 'closed'
                ? `Closed by ${latestClosePeriod.closed_by?.username || 'System'} on ${new Date(latestClosePeriod.closed_at || '').toLocaleDateString()}`
                : `${latestClosePeriod.items?.filter(it => it.is_complete).length || 0} of ${latestClosePeriod.items?.length || 0} items completed`
              }
            </div>
          </div>

          {latestClosePeriod.status !== 'closed' && latestClosePeriod.items && latestClosePeriod.items.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
              <div style={{ flex: 1, height: '6px', background: '#cbd5e1', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100}%`,
                  height: '100%',
                  background: '#3b82f6',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' }}>
                {Math.round((latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Active Exceptions</div>
          <div className="stat-value">{openExceptions.length}</div>
          <div className="stat-sub">Outstanding issues</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Resolved & Closed</div>
          <div className="stat-value">{closedExceptions.length}</div>
          <div className="stat-sub">Fully matched</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">SLA Breached</div>
          <div className="stat-value">{breachedExceptions.length}</div>
          <div className="stat-sub">Overdue exceptions</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Exceptions</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Severity</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Difference</th>
                <th>Assignee</th>
                <th style={{ textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.slice(0, 15).map(exc => (
                <tr key={exc.id}>
                  <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600 }}>
                    {exc.exception_code}
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <SeverityBadge severity={exc.severity} />
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <StatusChip status={exc.status} />
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                    ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {exc.assigned_to ? `@${exc.assigned_to.username}` : '-'}
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                    <Link to={`/app/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', textDecoration: 'none' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
