import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, User } from '../../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function ManagerDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchData = async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const excData = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(excData) ? excData : excData.results || [])
      
      const userData = await client.get('/users/')
      setUsers(Array.isArray(userData) ? userData : userData.results || [])
    } catch (err) {
      console.error('Failed to load manager dashboard data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [entityId])

  const handleReassign = async (exceptionId: string, newUserId: string) => {
    if (!newUserId) return
    setUpdatingId(exceptionId)
    try {
      await client.post(`/exceptions/${exceptionId}/reassign/`, { user_id: newUserId })
      alert('Exception reassigned successfully.')
      // Refresh local data
      const excData = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(excData) ? excData : excData.results || [])
    } catch (err: any) {
      alert(`Reassignment failed: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading Manager Dashboard...</div>
  }

  const now = new Date()
  const nowTime = now.getTime()
  const todayStr = now.toISOString().slice(0, 10)

  // Filter open exceptions (unresolved and not closed)
  const openExceptions = exceptions.filter(e => e.status !== 'closed' && e.status !== 'approved')

  // Calculate Aging Buckets for Open Exceptions
  let age0_3 = 0, age4_7 = 0, age8_14 = 0, age15_30 = 0, age30Plus = 0

  openExceptions.forEach(exc => {
    const createdDate = new Date(exc.created_at)
    const ageDays = Math.floor((nowTime - createdDate.getTime()) / (1000 * 60 * 60 * 24))
    if (ageDays <= 3) age0_3++
    else if (ageDays <= 7) age4_7++
    else if (ageDays <= 14) age8_14++
    else if (ageDays <= 30) age15_30++
    else age30Plus++
  })

  const agingData = [
    { range: '0–3d', count: age0_3 },
    { range: '4–7d', count: age4_7 },
    { range: '8–14d', count: age8_14 },
    { range: '15–30d', count: age15_30 },
    { range: '30d+', count: age30Plus },
  ]

  // SLA breach status
  const breachedCount = openExceptions.filter(e => e.sla_deadline && new Date(e.sla_deadline).getTime() < nowTime).length
  const breachRate = openExceptions.length > 0 ? Math.round((breachedCount / openExceptions.length) * 100) : 0

  // Team Workload calculation
  // Filter for analysts/approvers/managers
  const activeStaff = users.filter(u => u.role === 'analyst' || u.role === 'manager')

  const teamWorkload = activeStaff.map(staffMember => {
    const staffOpen = exceptions.filter(e =>
      e.assigned_to?.id === staffMember.id &&
      e.status !== 'closed' && e.status !== 'approved'
    ).length

    const staffResolvedToday = exceptions.filter(e =>
      e.assigned_to?.id === staffMember.id &&
      e.status === 'resolved' &&
      e.resolved_at?.startsWith(todayStr)
    ).length

    const staffBreached = exceptions.filter(e =>
      e.assigned_to?.id === staffMember.id &&
      e.status !== 'closed' && e.status !== 'approved' &&
      e.sla_deadline && new Date(e.sla_deadline).getTime() < nowTime
    ).length

    return {
      user: staffMember,
      open: staffOpen,
      resolvedToday: staffResolvedToday,
      breached: staffBreached
    }
  }).sort((a, b) => b.open - a.open)

  // Escalated Queue: high or critical severity, status investigating, or status routed
  const escalatedExceptions = openExceptions.filter(e =>
    e.severity === 'high' || e.severity === 'critical'
  ).sort((a, b) => {
    if (!a.sla_deadline) return 1
    if (!b.sla_deadline) return -1
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Operations Manager Dashboard 📈</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Monitor queue health, SLA breaches, and balance team resource allocation.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid-3">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="stat-label">Total Open Exceptions</div>
          <div className="stat-value">{openExceptions.length}</div>
          <div className="stat-sub">Across all staff and queues</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444', background: breachedCount > 0 ? '#fef2f2' : 'none' }}>
          <div className="stat-label" style={{ color: breachedCount > 0 ? '#b91c1c' : 'inherit' }}>Total Breached SLA</div>
          <div className="stat-value" style={{ color: breachedCount > 0 ? '#b91c1c' : 'inherit' }}>{breachedCount}</div>
          <div className="stat-sub">SLA breach rate: {breachRate}% of open queue</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-resolved)' }}>
          <div className="stat-label">Resolutions Today</div>
          <div className="stat-value">
            {exceptions.filter(e => e.status === 'resolved' && e.resolved_at?.startsWith(todayStr)).length}
          </div>
          <div className="stat-sub">Marked resolved since midnight</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Exception Aging Chart */}
        <div className="card">
          <h2>Active Exception Aging (Days)</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            Count of open cases bucketed by duration since detection.
          </p>
          <div className="chart-container" style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => {
                    const isHighAge = index >= 3;
                    return <Cell key={index} fill={isHighAge ? '#dc2626' : 'var(--color-primary)'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Workload Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Team Resource Allocation</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Current workload distribution and breach counts per team member.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Resource</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Open Cases</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Resolved Today</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Breached</th>
                </tr>
              </thead>
              <tbody>
                {teamWorkload.map(item => (
                  <tr key={item.user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 500 }}>
                      @{item.user.username} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>({item.user.role})</span>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                      {item.open}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--color-resolved)', fontWeight: 600 }}>
                      {item.resolvedToday}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '13px', color: item.breached > 0 ? '#b91c1c' : 'inherit', fontWeight: item.breached > 0 ? 600 : 400 }}>
                      {item.breached}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Escalations & Assignment Control */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>High Priority / Escalated Queue ({escalatedExceptions.length})</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Critical items needing resource reassignment or immediate resolution.</p>
        </div>

        {escalatedExceptions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Code</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Severity</th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Assignee</th>
                  <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Amount</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Reassign</th>
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {escalatedExceptions.map(exc => (
                  <tr key={exc.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600 }}>
                      {exc.exception_code}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <SeverityBadge severity={exc.severity} />
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '12px' }}>
                      {exc.assigned_to ? `@${exc.assigned_to.username}` : <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                      ₹{parseFloat(exc.amount_difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <select
                        value={exc.assigned_to?.id || ''}
                        onChange={(e) => handleReassign(exc.id, e.target.value)}
                        disabled={updatingId === exc.id}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          background: '#fff'
                        }}
                      >
                        <option value="">-- Reassign to --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>@{u.username} ({u.role})</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <Link to={`/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }}>
                        Inspect 🔍
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '30px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            No high-priority or escalated exceptions outstanding.
          </div>
        )}
      </div>
    </div>
  )
}
