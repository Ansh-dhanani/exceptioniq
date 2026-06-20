import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord } from '../../types'
import StatusChip from '../../components/StatusChip'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function ViewerDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const data = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(data) ? data : data.results || [])
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
    return <div style={{ padding: '24px' }}>Loading Viewer Dashboard...</div>
  }

  const openExceptions = exceptions.filter(e => e.status !== 'closed' && e.status !== 'approved')
  const closedExceptions = exceptions.filter(e => e.status === 'closed' || e.status === 'approved')
  const now = new Date().getTime()
  const breachedExceptions = openExceptions.filter(e => e.sla_deadline && new Date(e.sla_deadline).getTime() < now)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Welcome, {user.first_name || user.username} 👁️</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Read-only reconciliation viewer workspace.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Active Exceptions</div>
          <div className="stat-value">{openExceptions.length}</div>
          <div className="stat-sub">Outstanding issues in progress</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-resolved)' }}>
          <div className="stat-label">Resolved & Closed</div>
          <div className="stat-value">{closedExceptions.length}</div>
          <div className="stat-sub">Fully matched transactions</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-label">SLA Breached</div>
          <div className="stat-value">{breachedExceptions.length}</div>
          <div className="stat-sub">Overdue exceptions</div>
        </div>
      </div>

      {/* List of Exceptions */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Exceptions List</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Browse exception statuses and transaction details (Read-Only).</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Code</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Severity</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Difference</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Assignee</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.slice(0, 15).map(exc => (
                <tr key={exc.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="table-row">
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
                    {exc.assigned_to ? `@${exc.assigned_to.username}` : 'Unassigned'}
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                    <Link to={`/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', textDecoration: 'none' }}>
                      View Details
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
