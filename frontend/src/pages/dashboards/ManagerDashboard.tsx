import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, User, Vendor, MonthEndPeriod } from '../../types'
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
  const [exporting, setExporting] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
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
    if (!entityId) return
    setLoading(true)
    try {
      const excData = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(excData) ? excData : excData.results || [])

      const userData = await client.get('/users/')
      setUsers(Array.isArray(userData) ? userData : userData.results || [])

      const vendorData = await client.get(`/vendors/?entity=${entityId}`)
      setVendors(Array.isArray(vendorData) ? vendorData : vendorData.results || [])

      const closePeriods = await client.get(`/close/?entity=${entityId}`)
      const periodsList = Array.isArray(closePeriods) ? closePeriods : closePeriods.results || []
      if (periodsList.length > 0) {
        const detail = await client.get(`/close/${periodsList[0].id}/`)
        setLatestClosePeriod(detail)
      } else {
        setLatestClosePeriod(null)
      }
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
      const excData = await client.get(`/exceptions/?entity=${entityId}`)
      setExceptions(Array.isArray(excData) ? excData : excData.results || [])
    } catch (err: any) {
      alert(`Reassignment failed: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>
  }

  const now = new Date()
  const nowTime = now.getTime()
  const todayStr = now.toISOString().slice(0, 10)

  const openExceptions = exceptions.filter(e => e.status !== 'closed' && e.status !== 'approved')

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
    { range: '0-3d', count: age0_3 },
    { range: '4-7d', count: age4_7 },
    { range: '8-14d', count: age8_14 },
    { range: '15-30d', count: age15_30 },
    { range: '30d+', count: age30Plus },
  ]

  const breachedCount = openExceptions.filter(e => e.sla_deadline && new Date(e.sla_deadline).getTime() < nowTime).length
  const breachRate = openExceptions.length > 0 ? Math.round((breachedCount / openExceptions.length) * 100) : 0

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

  const escalatedExceptions = openExceptions.filter(e =>
    e.severity === 'high' || e.severity === 'critical'
  ).sort((a, b) => {
    if (!a.sla_deadline) return 1
    if (!b.sla_deadline) return -1
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
  })

  const redVendors = vendors.filter(v => v.risk_score?.risk_level === 'red').length
  const amberVendors = vendors.filter(v => v.risk_score?.risk_level === 'amber').length
  const greenVendors = vendors.filter(v => v.risk_score?.risk_level === 'green').length
  const totalVendorAmountAtRisk = vendors.reduce((sum, v) => sum + parseFloat(v.risk_score?.amount_at_risk || '0'), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Operations Manager Dashboard</h1>
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
          <div className="stat-label">Total Open Exceptions</div>
          <div className="stat-value">{openExceptions.length}</div>
          <div className="stat-sub">Across all queues</div>
        </div>

        <div className="stat-card" style={{ background: breachedCount > 0 ? '#fef2f2' : 'none' }}>
          <div className="stat-label" style={{ color: breachedCount > 0 ? '#b91c1c' : 'inherit' }}>SLA Breached</div>
          <div className="stat-value" style={{ color: breachedCount > 0 ? '#b91c1c' : 'inherit' }}>{breachedCount}</div>
          <div className="stat-sub">Breach rate: {breachRate}% of open queue</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value">
            {exceptions.filter(e => e.status === 'resolved' && e.resolved_at?.startsWith(todayStr)).length}
          </div>
          <div className="stat-sub">Since midnight</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Month-End Close Progress</span>
            <span style={{
              fontSize: '11px',
              background: latestClosePeriod?.status === 'closed' ? '#d1fae5' : '#fef3c7',
              color: latestClosePeriod?.status === 'closed' ? '#065f46' : '#d97706',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {latestClosePeriod ? latestClosePeriod.status.replace('_', ' ') : 'Not Started'}
            </span>
          </div>

          {latestClosePeriod ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Period: <b>{latestClosePeriod.period}</b></span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {latestClosePeriod.items && latestClosePeriod.items.length > 0
                    ? Math.round((latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100)
                    : 0}%
                </span>
              </div>
              
              <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden', margin: '8px 0 12px 0' }}>
                <div style={{
                  width: `${latestClosePeriod.items && latestClosePeriod.items.length > 0
                    ? (latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100
                    : 0}%`,
                  height: '100%',
                  background: '#4F46E5',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', gap: '12px' }}>
                <span>Completed: <b>{latestClosePeriod.items?.filter(it => it.is_complete).length}</b> of <b>{latestClosePeriod.items?.length}</b></span>
                <span>Critical Remaining: <b style={{ color: latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length ? '#dc2626' : 'inherit' }}>
                  {latestClosePeriod.items?.filter(it => it.is_critical && !it.is_complete).length}
                </b></span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
              No active checklist.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '12px', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{latestClosePeriod?.items?.length || 0} checklist items</span>
            <Link to="/app/close" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Orchestrate Close →
            </Link>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Counterparty Risk</span>
            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>90-Day Rolling</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Amount at Risk</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', letterSpacing: '-0.5px' }}>
                ₹{totalVendorAmountAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '2px 6px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px' }}>
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>Red:</span>
                <span style={{ fontWeight: 700, color: '#b91c1c' }}>{redVendors}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '2px 6px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '4px' }}>
                <span style={{ color: '#d97706', fontWeight: 600 }}>Amber:</span>
                <span style={{ fontWeight: 700, color: '#d97706' }}>{amberVendors}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '2px 6px', background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: '4px' }}>
                <span style={{ color: '#15803d', fontWeight: 600 }}>Green:</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>{greenVendors}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '12px', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{vendors.length} vendors monitored</span>
            <Link to="/app/vendors" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Manage Vendor Risk →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Active Exception Aging (Days)</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            Open cases by duration since detection.
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

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Team Resource Allocation</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th style={{ textAlign: 'center' }}>Open Cases</th>
                  <th style={{ textAlign: 'center' }}>Resolved Today</th>
                  <th style={{ textAlign: 'center' }}>Breached</th>
                </tr>
              </thead>
              <tbody>
                {teamWorkload.map(item => (
                  <tr key={item.user.id}>
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

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>High Priority Queue ({escalatedExceptions.length})</h2>
        </div>

        {escalatedExceptions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Severity</th>
                  <th>Assignee</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Reassign</th>
                  <th style={{ textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {escalatedExceptions.map(exc => (
                  <tr key={exc.id}>
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
                        <option value="">Reassign to...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>@{u.username} ({u.role})</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <Link to={`/app/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }}>
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
            No high-priority exceptions.
          </div>
        )}
      </div>
    </div>
  )
}
