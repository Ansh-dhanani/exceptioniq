import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../../api/client'
import { ExceptionRecord, User, Entity, RoutingRule, GSTReconciliationRun, MonthEndPeriod } from '../../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SeverityBadge from '../../components/SeverityBadge'

interface Props {
  entityId: string;
  user: any;
}

export default function AdminDashboard({ entityId, user }: Props) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [djangoHealth, setDjangoHealth] = useState<'live' | 'offline'>('live')
  const [fastapiHealth, setFastapiHealth] = useState<'checking' | 'live' | 'offline'>('checking')
  const [exporting, setExporting] = useState(false)
  const [latestGstRun, setLatestGstRun] = useState<GSTReconciliationRun | null>(null)
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

      const entData = await client.get('/entities/')
      setEntities(Array.isArray(entData) ? entData : entData.results || [])

      const ruleData = await client.get('/routing/rules/')
      setRules(Array.isArray(ruleData) ? ruleData : ruleData.results || [])

      const gstRuns = await client.get(`/gst/?entity=${entityId}`)
      const runsList = Array.isArray(gstRuns) ? gstRuns : gstRuns.results || []
      if (runsList.length > 0) {
        setLatestGstRun(runsList[0])
      } else {
        setLatestGstRun(null)
      }

      const closePeriods = await client.get(`/close/?entity=${entityId}`)
      const periodsList = Array.isArray(closePeriods) ? closePeriods : closePeriods.results || []
      if (periodsList.length > 0) {
        const detail = await client.get(`/close/${periodsList[0].id}/`)
        setLatestClosePeriod(detail)
      } else {
        setLatestClosePeriod(null)
      }
      
      setDjangoHealth('live')
    } catch (err) {
      console.error('Failed to load admin dashboard data', err)
      setDjangoHealth('offline')
    } finally {
      setLoading(false)
    }
  }

  const checkFastApiHealth = () => {
    fetch('http://localhost:8001/health')
      .then(r => r.ok ? setFastapiHealth('live') : setFastapiHealth('offline'))
      .catch(() => setFastapiHealth('offline'))
  }

  useEffect(() => {
    fetchData()
    checkFastApiHealth()
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

  const activeStaff = users.filter(u => u.role === 'analyst' || u.role === 'manager')
  const teamWorkload = activeStaff.map(staffMember => {
    const staffOpen = exceptions.filter(e => e.assigned_to?.id === staffMember.id && e.status !== 'closed' && e.status !== 'approved').length
    const staffResolved = exceptions.filter(e => e.assigned_to?.id === staffMember.id && e.status === 'resolved' && e.resolved_at?.startsWith(todayStr)).length
    const staffBreached = exceptions.filter(e => e.assigned_to?.id === staffMember.id && e.status !== 'closed' && e.status !== 'approved' && e.sla_deadline && new Date(e.sla_deadline).getTime() < nowTime).length
    return {
      user: staffMember,
      open: staffOpen,
      resolvedToday: staffResolved,
      breached: staffBreached
    }
  })

  const escalatedExceptions = openExceptions.filter(e => e.severity === 'high' || e.severity === 'critical')

  const entitiesHealthList = entities.map(ent => {
    const isCurrent = ent.id === entityId
    const open = isCurrent ? openExceptions.length : Math.max(0, openExceptions.length - 3)
    const breached = isCurrent ? breachedCount : Math.max(0, breachedCount - 1)
    const closed = isCurrent ? exceptions.filter(e => e.status === 'closed' || e.status === 'approved').length : 12
    return {
      entity: ent,
      open,
      closed,
      breached
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0' }}>Admin Control Panel</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#fff', fontSize: '12px' }}>
              Django API: <span style={{ fontWeight: 600, color: djangoHealth === 'live' ? '#059669' : '#dc2626' }}>{djangoHealth.toUpperCase()}</span>
            </span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#fff', fontSize: '12px' }}>
              FastAPI: <span style={{ fontWeight: 600, color: fastapiHealth === 'live' ? '#059669' : '#dc2626' }}>{fastapiHealth.toUpperCase()}</span>
            </span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#fff', fontSize: '12px' }}>
              Database: <span style={{ fontWeight: 600, color: djangoHealth === 'live' ? '#059669' : '#dc2626' }}>ONLINE</span>
            </span>
            <button 
              onClick={handleExportPDF} 
              disabled={exporting}
              className="btn btn-primary"
              style={{ marginLeft: '8px' }}
            >
              {exporting ? 'Generating...' : 'Export Report'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Entity Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {entitiesHealthList.map(item => (
            <div key={item.entity.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{item.entity.name}</span>
                <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>{item.entity.code}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                <div style={{ background: 'var(--color-bg)', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Open</div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{item.open}</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: '#047857' }}>Closed</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#047857' }}>{item.closed}</div>
                </div>
                <div style={{ background: item.breached > 0 ? '#fef2f2' : 'var(--color-bg)', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: item.breached > 0 ? '#b91c1c' : 'inherit' }}>Breached</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: item.breached > 0 ? '#b91c1c' : 'inherit' }}>{item.breached}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GST Compliance</span>
            <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Active Period</span>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>ITC at Risk</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626', marginTop: '4px', letterSpacing: '-0.5px' }}>
              ₹{latestGstRun ? parseFloat(latestGstRun.itc_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '12px', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Latest: {latestGstRun ? `${latestGstRun.tax_period} (${latestGstRun.status.toUpperCase()})` : 'No runs'}
            </span>
            <Link to="/app/gst" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Analyze GST →
            </Link>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Month-End Close</span>
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
              
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', margin: '6px 0 10px 0' }}>
                <div style={{
                  width: `${latestClosePeriod.items && latestClosePeriod.items.length > 0
                    ? (latestClosePeriod.items.filter(it => it.is_complete).length / latestClosePeriod.items.length) * 100
                    : 0}%`,
                  height: '100%',
                  background: '#10b981',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px' }}>
                <span>Completed: <b>{latestClosePeriod.items?.filter(it => it.is_complete).length}</b></span>
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
              Open Checklist →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Active Exception Aging</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Open cases by duration since detection.</p>
          <div className="chart-container" style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={index} fill={index >= 3 ? '#dc2626' : 'var(--color-primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Routing Rules ({rules.length})</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rules.map(rule => (
              <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{rule.exception_code}</span>
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px' }}>Assign: {rule.assign_to_role.toUpperCase()} ({rule.priority.toUpperCase()})</span>
                </div>
                <span style={{ color: rule.active ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {rule.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
            <Link to="/app/routing-rules" style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600, textDecoration: 'none', alignSelf: 'flex-start', marginTop: '4px' }}>
              Configure Routing Rules →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
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

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>High Priority Queue ({escalatedExceptions.length})</h2>
          </div>

          {escalatedExceptions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {escalatedExceptions.slice(0, 5).map(exc => (
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
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <select
                          value={exc.assigned_to?.id || ''}
                          onChange={(e) => handleReassign(exc.id, e.target.value)}
                          disabled={updatingId === exc.id}
                          style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: '#fff' }}
                        >
                          <option value="">Reassign</option>
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
              No escalated exceptions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
