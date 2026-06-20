import { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { client } from '../api/client'
import { MonthEndPeriod, CloseChecklistItem } from '../types'

interface AppContextType {
  entityId: string
}

export default function MonthEndClose() {
  const { entityId } = useOutletContext<AppContextType>()
  
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${month}`
  })
  
  const [periodData, setPeriodData] = useState<MonthEndPeriod | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [closing, setClosing] = useState(false)

  // Fetch checklist for this period
  const fetchChecklist = async () => {
    if (!entityId || !period) return
    setLoading(true)
    try {
      const res = await client.get(`/close/?entity=${entityId}&period=${period}`)
      if (res && res.results && res.results.length > 0) {
        // Fetch full detail of period including checklist items
        const detail = await client.get(`/close/${res.results[0].id}/`)
        setPeriodData(detail)
      } else {
        setPeriodData(null)
      }
    } catch (err) {
      setPeriodData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChecklist()
  }, [entityId, period])

  // Generate new period close checklist
  const handleGenerateChecklist = async () => {
    if (!entityId || !period) return
    setGenerating(true)
    try {
      const res = await client.post('/close/generate/', {
        entity_id: entityId,
        period: period
      })
      alert(`Close checklist generated successfully for period ${period}!`)
      setPeriodData(res)
    } catch (err: any) {
      alert(`Generation failed: ${err.message || err}`)
    } finally {
      setGenerating(false)
    }
  }

  // Toggle item complete status
  const handleToggleItemComplete = async (item: CloseChecklistItem) => {
    if (!periodData) return
    
    // Optimistic local state update
    const nextState = !item.is_complete
    const updatedItems = periodData.items?.map(it => {
      if (it.id === item.id) {
        return { ...it, is_complete: nextState }
      }
      return it
    }) || []
    
    setPeriodData({ ...periodData, items: updatedItems })

    try {
      const res = await client.patch(`/close/${periodData.id}/items/${item.id}/complete/`, {
        is_complete: nextState
      })
      // Fetch full period detail to get updated assigned users / completed by info
      const detail = await client.get(`/close/${periodData.id}/`)
      setPeriodData(detail)
    } catch (err: any) {
      alert(`Failed to update item: ${err.message || err}`)
      fetchChecklist() // Revert local state on error
    }
  }

  // Close Month-End Period
  const handleClosePeriod = async () => {
    if (!periodData) return
    
    setClosing(true)
    try {
      const res = await client.post(`/close/${periodData.id}/close/`, {})
      alert(`Congratulations! Period ${periodData.period} has been successfully closed!`)
      setPeriodData(res)
    } catch (err: any) {
      alert(`Failed to close period: ${err.message || err}`)
    } finally {
      setClosing(false)
    }
  }

  // Calculate metrics
  const items = periodData?.items || []
  const totalItems = items.length
  const completedItems = items.filter(it => it.is_complete).length
  const criticalRemaining = items.filter(it => it.is_critical && !it.is_complete).length
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'bank': return '#3b82f6'
      case 'gst': return '#10b981'
      case 'tds': return '#f59e0b'
      case 'vendor': return '#ef4444'
      case 'payroll': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>Month-End Close Compliance Checklist</h1>
          <p>Orchestrate monthly closing steps, track checklist progress, and execute formal period closures.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label className="form-label" style={{ margin: 0, fontWeight: 500 }}>Target Period:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="form-input"
            style={{ width: '160px', margin: 0 }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading Close Period details...</div>
      ) : periodData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Progress Bar Card */}
          <div className="card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Closing Progress: {progressPercent}%
                  {periodData.status === 'closed' && (
                    <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>🔒 CLOSED</span>
                  )}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {completedItems} of {totalItems} items completed — {criticalRemaining} critical items remaining
                </p>
              </div>

              {periodData.status !== 'closed' && (
                <button
                  onClick={handleClosePeriod}
                  className="btn btn-primary"
                  style={{ background: criticalRemaining > 0 ? '#94a3b8' : '#059669', borderColor: criticalRemaining > 0 ? '#94a3b8' : '#059669' }}
                  disabled={closing}
                >
                  {closing ? 'Closing Period...' : '🔒 Close Period'}
                </button>
              )}
            </div>

            <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: '#4F46E5', transition: 'width 0.4s ease' }} />
            </div>
            
            {periodData.status === 'closed' && (
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Closed by <b>{periodData.closed_by?.username}</b> on <b>{new Date(periodData.closed_at || '').toLocaleString()}</b>
              </div>
            )}
          </div>

          {/* Checklist Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '60px' }}>Done</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '120px' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Task Detail</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '90px' }}>Critical</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '120px' }}>Assigned To</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '120px' }}>Due Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      opacity: item.is_complete ? 0.7 : 1,
                      background: item.is_complete ? '#fcfdfd' : '#fff'
                    }}
                  >
                    {/* Checkbox toggler */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.is_complete}
                        onChange={() => handleToggleItemComplete(item)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        disabled={periodData.status === 'closed'}
                      />
                    </td>
                    
                    {/* Category */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: getCategoryColor(item.category),
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {item.category}
                      </span>
                    </td>

                    {/* Task Title / Desc */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', textDecoration: item.is_complete ? 'line-through' : 'none' }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {item.description}
                        </div>
                      )}
                    </td>

                    {/* Critical Indicator */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {item.is_critical ? (
                        <span style={{ color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>CRITICAL</span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '11px' }}>-</span>
                      )}
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                      {item.is_complete ? (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          Completed by {item.completed_by?.username || 'System'}
                        </span>
                      ) : (
                        item.assigned_to?.username || 'Auto Queue'
                      )}
                    </td>

                    {/* Due date */}
                    <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                      {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Deep link link */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {item.linked_url ? (
                        <Link to={item.linked_url} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          🔗 Go to View
                        </Link>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>No link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            No checklist generated for period <b>{period}</b> yet.
          </p>
          <button
            onClick={handleGenerateChecklist}
            className="btn btn-primary"
            disabled={generating}
          >
            {generating ? 'Generating close checklist...' : '✨ Generate Month-End Close Checklist'}
          </button>
        </div>
      )}
    </div>
  )
}
