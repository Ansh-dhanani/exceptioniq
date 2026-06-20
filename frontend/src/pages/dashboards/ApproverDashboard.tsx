import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, AuditLog } from '../../types'
import StatusChip from '../../components/StatusChip'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function ApproverDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!entityId || !user) return
    setLoading(true)
    try {
      const data = await client.get(`/exceptions/?entity=${entityId}`)
      const list = Array.isArray(data) ? data : data.results || []
      setExceptions(list)
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
    return <div style={{ padding: '24px' }}>Loading Approver Dashboard...</div>
  }

  // 1. Pending Approval Queue: status == 'resolved', oldest first
  const pendingApprovals = exceptions.filter(e => e.status === 'resolved')
    .sort((a, b) => new Date(a.resolved_at || a.updated_at).getTime() - new Date(b.resolved_at || b.updated_at).getTime())

  // 2. Escalated to Me: assigned_to == me, status == 'investigating'
  const escalatedQueue = exceptions.filter(e =>
    e.assigned_to?.id === user.id && e.status === 'investigating'
  )

  // 3. Recent Activity: last 10 audit logs where I approved/rejected
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
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Approver Console ✍️</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Verify resolved exceptions and review escalated issues.</p>
      </div>

      {/* Stats row */}
      <div className="grid-2">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-resolved)' }}>
          <div className="stat-label">Pending My Approval</div>
          <div className="stat-value">{pendingApprovals.length}</div>
          <div className="stat-sub">Awaiting maker-checker signature</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-investigating)' }}>
          <div className="stat-label">Escalated to Me</div>
          <div className="stat-value">{escalatedQueue.length}</div>
          <div className="stat-sub">Assigned open cases requiring senior review</div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid-2">
        {/* Left Side: Pending Approval Queue */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Pending Approval Queue</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Resolved by analysts. Review and verify to close.</p>
          </div>

          {pendingApprovals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Exception</th>
                    <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Amount</th>
                    <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map(exc => (
                    <tr key={exc.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="table-row">
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600 }}>{exc.exception_code}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Resolved code: <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>{exc.resolution_code}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                        ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <Link to={`/exceptions/${exc.id}`} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px', textDecoration: 'none', display: 'inline-block', background: '#8b5cf6' }}>
                          Review 🔍
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No exceptions awaiting approval. Great!
            </div>
          )}
        </div>

        {/* Right Side: Escalations & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Escalations Queue */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Escalated To Me</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Active investigations routed to your attention.</p>
            </div>
            {escalatedQueue.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {escalatedQueue.map(exc => (
                      <tr key={exc.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="table-row">
                        <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                          <div style={{ fontWeight: 600 }}>{exc.exception_code}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ID: {exc.id.slice(0, 8)}</div>
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <SeverityBadge severity={exc.severity} />
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                          <Link to={`/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>
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

          {/* Recent Activity */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>My Recent Actions</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Your last 10 approved or rejected exceptions.</p>
            </div>
            {sortedActivities.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: '12px 24px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedActivities.map((act, idx) => (
                  <li key={idx} style={{ fontSize: '12px', borderBottom: idx < sortedActivities.length - 1 ? '1px solid var(--color-border)' : 'none', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <Link to={`/exceptions/${act.exceptionId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
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
                      {act.metadata?.note || act.metadata?.reason || 'No comment provided.'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No approval activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
