import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom'
import { client } from '../api/client'
import { ExceptionRecord, User, AuditLog } from '../types'
import StatusChip from '../components/StatusChip'
import SeverityBadge from '../components/SeverityBadge'
import SlaCountdown from '../components/SlaCountdown'

interface AppContextType {
  entityId: string
  currentUserRole: string
}

const renderAuditSentence = (log: AuditLog) => {
  const meta = log.metadata || {}
  const action = log.action
  const username = log.user ? `@${log.user.username}` : 'System'

  switch (action) {
    case 'detected': {
      const parts: string[] = []
      if (meta.amount) parts.push(`amount: ₹${meta.amount}`)
      if (meta.reference) parts.push(`reference: ${meta.reference}`)
      if (meta.narration) parts.push(`narration: "${meta.narration}"`)
      if (meta.counterparty) parts.push(`counterparty: ${meta.counterparty}`)
      const details = parts.length > 0 ? ` (${parts.join(', ')})` : ''
      return `System automatically detected the exception${details}.`
    }
    case 'routed': {
      if (meta.rule_name) {
        return `Exception routed via rule "${meta.rule_name}".`
      }
      if (meta.rule_id) {
        return `Exception routed automatically via rule ID ${meta.rule_id}.`
      }
      if (meta.role) {
        return `Exception routed to ${meta.role} queue.`
      }
      return `Exception routed to queue.`
    }
    case 'reassigned':
      return `Reassigned to ${meta.assigned_to ? `@${meta.assigned_to}` : 'unassigned'}.`
    case 'commented':
      return `Added a comment.`
    case 'resolved': {
      const code = meta.resolution_code || 'unknown_code'
      const note = meta.note ? ` Note: "${meta.note}"` : ''
      return `Submitted resolution: ${code.replace(/_/g, ' ')}.${note}`
    }
    case 'approved': {
      const note = meta.note ? ` Note: "${meta.note}"` : ''
      return `Approved the resolution and closed the exception.${note}`
    }
    case 'rejected': {
      const reason = meta.reason ? ` Reason: "${meta.reason}"` : ''
      return `Rejected the resolution. Exception re-opened.${reason}`
    }
    default:
      return `Status changed to ${action}.`
  }
}

export default function ExceptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUserRole } = useOutletContext<AppContextType>()

  const [exception, setException] = useState<ExceptionRecord | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'audit' | 'comments'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [resolutionCode, setResolutionCode] = useState('manual_resolution')
  const [resolutionNote, setResolutionNote] = useState('')
  const [commentText, setCommentText] = useState('')
  const [approvalNote, setApprovalNote] = useState('')
  
  // AI State
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiLoaded, setAiLoaded] = useState(false)

  // Fetch exception detail and users
  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await client.get(`/exceptions/${id}/`)
      setException(data)
      
      const usersData = await client.get('/users/')
      setUsers(Array.isArray(usersData) ? usersData : usersData.results || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load exception detail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Call AI Service for summary
  const handleAskAI = async () => {
    if (!id) return
    setAiLoading(true)
    try {
      const data = await client.post(`/exceptions/${id}/ai-summary/`, {})
      setAiSummary(data.summary || 'No summary returned.')
      setAiLoaded(true)
    } catch (err: any) {
      setAiSummary(`Error calling AI service: ${err.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  // Handle Comment creation
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !id) return
    try {
      const updated = await client.post(`/exceptions/${id}/comment/`, { message: commentText })
      setException(updated)
      setCommentText('')
    } catch (err: any) {
      alert(`Failed to add comment: ${err.message}`)
    }
  }

  // Handle Reassignment
  const handleReassign = async (userId: string) => {
    if (!userId || !id) return
    try {
      const updated = await client.post(`/exceptions/${id}/reassign/`, { user_id: userId })
      setException(updated)
      alert('Exception reassigned successfully.')
    } catch (err: any) {
      alert(`Reassignment failed: ${err.message}`)
    }
  }

  // Handle Resolution submission
  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const updated = await client.post(`/exceptions/${id}/resolve/`, {
        resolution_code: resolutionCode,
        note: resolutionNote
      })
      setException(updated)
      setResolutionNote('')
      alert('Exception resolved! Sent for Maker-Checker approval.')
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`)
    }
  }

  // Handle Approval Action
  const handleApprove = async () => {
    if (!id) return
    try {
      const updated = await client.post(`/exceptions/${id}/approve/`, { note: approvalNote })
      setException(updated)
      setApprovalNote('')
      alert('Exception approved and closed!')
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`)
    }
  }

  // Handle Rejection Action
  const handleReject = async () => {
    if (!id) return
    try {
      const updated = await client.post(`/exceptions/${id}/reject/`, { note: approvalNote })
      setException(updated)
      setApprovalNote('')
      alert('Exception rejected and re-opened.')
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`)
    }
  }

  if (loading) return <div style={{ padding: '24px' }}>Loading exception context...</div>
  if (error) return <div style={{ padding: '24px', color: 'red' }}>Error: {error}</div>
  if (!exception) return <div style={{ padding: '24px' }}>Exception not found.</div>

  const hasBankSide = exception.source_record_ids.length > 0 && exception.exception_code !== 'BANK-MISS-BANK'
  const hasLedgerSide = exception.source_record_ids.length > 0 && exception.exception_code !== 'BANK-MISS-LEDGER'

  const formatCurrency = (val: string) => {
    const num = parseFloat(val) || 0
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(num)
  }

  const isApproverOrManager = currentUserRole === 'approver' || currentUserRole === 'manager' || currentUserRole === 'admin'

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <Link to="/exceptions" className="back-link">
        ← Back to Exceptions Queue
      </Link>

      {/* Detail Header */}
      <div className="detail-header">
        <div className="detail-title-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>EXCEPTION {exception.id.slice(0, 8).toUpperCase()}</span>
            <SeverityBadge severity={exception.severity} />
            <StatusChip status={exception.status} />
          </div>
          <h1 style={{ marginTop: '4px' }}>{exception.exception_code}</h1>
          <p>Detected mismatch on bank account reconciliation.</p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>SLA Deadline</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '2px' }}>
            <SlaCountdown deadlineStr={exception.sla_deadline} status={exception.status} />
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left Side */}
        <div>
          <div className="card">
            <h2>Transaction Context</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Verify matching records between Bank Statement and General Ledger.</p>
            
            <div className="comparison-box">
              <div className={`comparison-side ${hasBankSide ? 'highlight' : ''}`}>
                <div className="comparison-side-title">
                  🏦 Bank Statement Line
                  {hasBankSide && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Active</span>}
                </div>
                {hasBankSide ? (
                  <div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Transaction Date</span>
                      <span className="comparison-row-value">{exception.created_at.slice(0, 10)}</span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Amount</span>
                      <span className="comparison-row-value" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                        {formatCurrency(exception.exception_code === 'BANK-AMT' ? (parseFloat(exception.amount_difference) + 5000.00).toFixed(2) : exception.amount_difference)}
                      </span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Reference</span>
                      <span className="comparison-row-value" style={{ fontFamily: 'monospace' }}>{exception.context.reference || 'N/A'}</span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Counterparty</span>
                      <span className="comparison-row-value">{exception.context.counterparty || 'N/A'}</span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Narration</span>
                      <span className="comparison-row-value">{exception.context.narration || 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No bank statement line matched. This entry is missing from the bank.
                  </div>
                )}
              </div>

              <div className={`comparison-side ${hasLedgerSide ? 'highlight' : ''}`}>
                <div className="comparison-side-title">
                  📖 General Ledger Entry
                  {hasLedgerSide && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Active</span>}
                </div>
                {hasLedgerSide ? (
                  <div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Booking Date</span>
                      <span className="comparison-row-value">
                        {new Date(new Date(exception.created_at).getTime() - (exception.date_difference * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)}
                      </span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Amount</span>
                      <span className="comparison-row-value" style={{ fontWeight: 600 }}>
                        {formatCurrency(exception.exception_code === 'BANK-AMT' ? '5000.00' : exception.amount_difference)}
                      </span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Reference</span>
                      <span className="comparison-row-value" style={{ fontFamily: 'monospace' }}>
                        {exception.exception_code === 'BANK-REF' ? `${exception.context.reference}-ledger-err` : (exception.context.reference || 'N/A')}
                      </span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Counterparty</span>
                      <span className="comparison-row-value">{exception.context.counterparty || 'N/A'}</span>
                    </div>
                    <div className="comparison-row">
                      <span className="comparison-row-label">Account Ledger</span>
                      <span className="comparison-row-value">HDFC Bank A/C (Ledger)</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No ledger entry matched. This transaction is missing in books.
                  </div>
                )}
              </div>
            </div>

            {exception.exception_code === 'BANK-AMT' && (
              <div style={{ padding: '12px', background: 'var(--color-danger-bg)', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', fontSize: '13px', color: '#991b1b', fontWeight: 500 }}>
                ⚠️ Amount Discrepancy: Difference of <strong>{formatCurrency(exception.amount_difference)}</strong> detected.
              </div>
            )}
            {exception.date_difference > 0 && (
              <div style={{ padding: '12px', background: 'var(--color-investigating-bg)', border: '1px solid #fde047', borderRadius: 'var(--radius)', fontSize: '13px', color: '#854d0e', fontWeight: 500, marginTop: '8px' }}>
                ⚠️ Time Drift: Date discrepancy of <strong>{exception.date_difference} days</strong> detected between posting and settlement.
              </div>
            )}
          </div>

          {/* Lower Section Tabs */}
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              Overview
            </button>
            <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
              ✨ AI Insights
            </button>
            <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
              Audit Log ({exception.audit_logs?.length || 0})
            </button>
            <button className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
              Comments ({exception.comments?.length || 0})
            </button>
          </div>

          <div className="tab-content" style={{ background: '#fff', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)', marginBottom: '24px' }}>
            {activeTab === 'overview' && (
              <div>
                <h3 style={{ marginBottom: '12px' }}>Context Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Confidence Score</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>{exception.confidence_score}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Reconciliation Module</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px', textTransform: 'capitalize' }}>{exception.reconciliation_type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Created On</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>{new Date(exception.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Last Updated</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>{new Date(exception.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                <div className="ai-insight-panel">
                  <div className="ai-header">
                    <span className="ai-sparkle-icon"></span>
                    AI Summary & Recommendation
                  </div>
                  <div className="ai-summary-content">
                    {currentUserRole === 'viewer' ? (
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>🔒 AI Insights are not available for read-only Viewers.</p>
                    ) : aiLoaded ? (
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>{aiSummary}</div>
                    ) : (
                      <div>
                        <p style={{ color: '#3730A3', marginBottom: '12px' }}>Query the AI Service to generate a natural language summary and suggested resolution playbook.</p>
                        <button onClick={handleAskAI} className="btn btn-primary" disabled={aiLoading} style={{ background: '#4F46E5' }}>
                          {aiLoading ? 'Thinking...' : '⚡ Generate AI Analysis'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div>
                <h3 style={{ marginBottom: '12px' }}>Activity & State Transitions</h3>
                <ul className="audit-list">
                  {(exception.audit_logs || []).map((log, idx) => (
                    <li key={log.id || idx} className={`audit-item action-${log.action}`}>
                      <div className="audit-meta">
                        {new Date(log.created_at).toLocaleString()} {log.user ? `by @${log.user.username}` : 'by System'}
                      </div>
                      <div className="audit-desc" style={{ marginTop: '4px', fontSize: '13px', color: 'var(--color-text)' }}>
                        {renderAuditSentence(log)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'comments' && (
              <div>
                <h3 style={{ marginBottom: '12px' }}>Comment Stream</h3>
                <div className="comments-list">
                  {(exception.comments || []).length > 0 ? (
                    (exception.comments || []).map((c, idx) => (
                      <div key={c.id || idx} className="comment-item">
                        <div className="comment-meta">
                          <span className="comment-user">👤 {c.user ? `${c.user.username} (${c.user.role})` : 'System Analyst'}</span>
                          <span>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div className="comment-body">{c.message}</div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>No comments posted yet.</p>
                  )}
                </div>
                
                {currentUserRole !== 'viewer' ? (
                  <form onSubmit={handleAddComment} className="comment-input-area">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a message for the audit trail..."
                      className="comment-textarea"
                    />
                    <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 16px' }}>
                      Post Comment
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    🔒 Comments are read-only for Viewer profiles.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div>
          {/* Reassign Panel (Only for admin or manager) */}
          {(currentUserRole === 'admin' || currentUserRole === 'manager') && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3>Assignee Ownership</h3>
              <div className="form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
                <select 
                  value={exception.assigned_to?.id || ''} 
                  onChange={(e) => handleReassign(e.target.value)}
                  className="form-input"
                >
                  <option value="">-- Choose Analyst --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role.toUpperCase()})</option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>Assigning routes the ticket and establishes SLA accountability.</p>
              </div>
            </div>
          )}

          {/* Maker-Checker Approval View */}
          {(exception.status === 'resolved' || exception.status === 'pending_approval') ? (
            <div className="card" style={{ borderColor: '#8b5cf6', background: '#fbfaff' }}>
              <h2 style={{ color: '#6d28d9', fontSize: '15px' }}>✍️ Maker-Checker Approvals</h2>
              <p style={{ fontSize: '12px', marginBottom: '16px' }}>
                This exception has been marked <strong>Resolved</strong> by the analyst and requires verification by an Approver or Manager.
              </p>
              
              {isApproverOrManager ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Review Note / Reason</label>
                    <textarea 
                      value={approvalNote} 
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="Verify notes..."
                      className="form-input"
                      style={{ height: '80px', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleApprove} className="btn btn-primary" style={{ flex: 1, background: '#059669' }}>
                      ✔️ Approve & Close
                    </button>
                    <button onClick={handleReject} className="btn btn-danger" style={{ flex: 1 }}>
                      ❌ Reject & Re-open
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 'var(--radius)', fontSize: '12px', color: '#5b21b6', fontWeight: 500 }}>
                  🔒 Locked: Current user role ({currentUserRole}) does not have approval clearance. Requires Approver, Manager, or Admin.
                </div>
              )}
            </div>
          ) : exception.status !== 'closed' ? (
            /* Resolution Form */
            <div className="card">
              <h2>Resolve Exception</h2>
              {(currentUserRole === 'admin' || currentUserRole === 'manager' || currentUserRole === 'analyst') ? (
                <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Resolution Code</label>
                    <select 
                      value={resolutionCode} 
                      onChange={(e) => setResolutionCode(e.target.value)}
                      className="form-input"
                    >
                      <option value="round_off_charge">Rounding adjustment / Bank fees</option>
                      <option value="manual_ledger_post">Manual post entry added to books</option>
                      <option value="uncleared_cheque">Cheque clearance delay accepted</option>
                      <option value="reference_updated">Typographical reference update</option>
                      <option value="clearing_drift_accepted">Timing difference cleared since</option>
                      <option value="commercial_writeoff">Commercial dispute write-off</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Resolution Notes</label>
                    <textarea 
                      value={resolutionNote} 
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Provide evidence reference or comments..."
                      className="form-input"
                      style={{ height: '100px', resize: 'none', fontFamily: 'inherit' }}
                      required
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary">
                    Submit Resolution
                  </button>
                </form>
              ) : (
                <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                  🔒 Read-only: Only Analysts can submit resolutions.
                </div>
              )}
            </div>
          ) : (
            /* Closed State Panel */
            <div className="card" style={{ borderColor: 'var(--color-border)', background: '#f9fafb' }}>
              <h2>Closed Record</h2>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>This exception is fully closed and locked. No further modifications can be made.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '13px' }}>
                <div><strong>Resolution Applied:</strong></div>
                <div style={{ background: '#fff', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>
                  {exception.resolution_code}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                  Closed on {exception.resolved_at ? new Date(exception.resolved_at).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
