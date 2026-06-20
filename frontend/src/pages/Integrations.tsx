import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { client } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { SyncJob, Entity } from '../types'

interface AppContextType {
  entityId: string
}

export default function Integrations() {
  const { entityId } = useOutletContext<AppContextType>()
  const { user } = useAuth()

  const [entity, setEntity] = useState<Entity | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const toast = {
    success: (msg: string) => setNotification({ message: msg, type: 'success' }),
    error: (msg: string) => setNotification({ message: msg, type: 'error' })
  }

  // Tally inputs
  const [tallyHost, setTallyHost] = useState('localhost:9000')
  const [tallyCompany, setTallyCompany] = useState('')
  const [tallyFrom, setTallyFrom] = useState('')
  const [tallyTo, setTallyTo] = useState('')
  const [tallySyncing, setTallySyncing] = useState(false)

  // Zoho sync date range
  const [zohoFrom, setZohoFrom] = useState('')
  const [zohoTo, setZohoTo] = useState('')
  const [zohoSyncing, setZohoSyncing] = useState(false)
  const [zohoConnecting, setZohoConnecting] = useState(false)

  // Jobs history list
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Handle Zoho callback parameters from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const zohoParam = params.get('zoho')
    const reason = params.get('reason')
    
    if (zohoParam) {
      if (zohoParam === 'connected') {
        toast.success('Zoho Books connected successfully!')
        fetchEntityDetails()
      } else if (zohoParam === 'denied') {
        toast.error('Zoho connection cancelled.')
      } else if (zohoParam === 'error') {
        let errorMsg = 'Zoho connection failed. Please try again.'
        if (reason === 'no_refresh_token') {
          errorMsg = 'Zoho connection failed: No refresh token returned.'
        } else if (reason === 'entity_not_found') {
          errorMsg = 'Zoho connection failed: Entity not found.'
        } else if (reason === 'token_exchange_failed') {
          errorMsg = 'Zoho connection failed: Token exchange failed.'
        }
        toast.error(errorMsg)
      }
      
      // Clean query params
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [entityId])

  // Load details of the entity (like current company name / connected state)
  const fetchEntityDetails = async () => {
    if (!entityId) return
    try {
      const ent: Entity = await client.get(`/entities/${entityId}/`)
      setEntity(ent)
      setTallyCompany(ent.tally_company_name || '')
    } catch (err) {
      console.error(err)
    }
  }

  // Fetch sync jobs history
  const fetchJobs = async () => {
    if (!entityId) return
    setLoadingJobs(true)
    try {
      const res = await client.get(`/integrations/jobs/?entity=${entityId}`)
      if (res && res.results) {
        setJobs(res.results)
      } else {
        setJobs(res)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingJobs(false)
    }
  }

  useEffect(() => {
    fetchEntityDetails()
    fetchJobs()
  }, [entityId])

  // Save Tally details & Pull
  const handleTallySync = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entityId || !tallyFrom || !tallyTo) {
      alert('Please fill out Tally sync date range fields.')
      return
    }

    setTallySyncing(true)
    try {
      // 1. Update company name on Entity first
      await client.patch(`/entities/${entityId}/`, {
        tally_company_name: tallyCompany
      })

      // 2. Trigger Tally sync
      const res = await client.post('/integrations/tally/sync/', {
        entity_id: entityId,
        from_date: tallyFrom,
        to_date: tallyTo,
        tally_host: tallyHost
      })
      alert(`Tally Sync Success! Pulled ${res.rows_pulled} ledger entries and triggered reconciliation.`)
      fetchJobs()
    } catch (err: any) {
      alert(`Tally Sync Failed: ${err.message || err}`)
    } finally {
      setTallySyncing(false)
    }
  }

  const isZohoConnected = !!entity?.zoho_refresh_token

  // Connect Zoho Books via OAuth flow (fetch auth URL with session cookie, then redirect)
  const handleConnectZoho = async () => {
    if (!entityId) {
      toast.error('Select an active entity before connecting Zoho Books.')
      return
    }
    if (user?.role !== 'admin' && user?.role !== 'manager') {
      toast.error('Only Admin or Manager roles can connect Zoho Books.')
      return
    }

    setZohoConnecting(true)
    try {
      const data = await client.get(
        `/integrations/zoho/connect/?entity_id=${entityId}&format=json`
      )
      if (!data.auth_url) {
        throw new Error('No authorization URL returned from server.')
      }
      window.location.assign(data.auth_url)
    } catch (err: any) {
      const msg = err.message || String(err)
      if (msg.includes('Unauthorized') || msg.includes('403')) {
        toast.error('Permission denied. Switch to Admin or Manager role and try again.')
      } else {
        toast.error(`Failed to start Zoho connection: ${msg}`)
      }
    } finally {
      setZohoConnecting(false)
    }
  }

  // Disconnect Zoho Books connection
  const handleDisconnectZoho = async () => {
    if (!entityId) return
    try {
      await client.post('/integrations/zoho/disconnect/', { entity_id: entityId })
      toast.success('Zoho Books disconnected.')
      fetchEntityDetails()
    } catch (err: any) {
      toast.error(`Failed to disconnect Zoho: ${err.message || err}`)
    }
  }

  // Zoho sync transactions pull
  const handleZohoSync = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entityId || !zohoFrom || !zohoTo) {
      alert('Please fill out Zoho sync date range fields.')
      return
    }

    setZohoSyncing(true)
    try {
      const res = await client.post('/integrations/zoho/sync/', {
        entity_id: entityId,
        from_date: zohoFrom,
        to_date: zohoTo
      })
      alert(`Zoho Sync Success! Pulled ${res.rows_pulled} bank transactions and triggered reconciliation.`)
      fetchJobs()
    } catch (err: any) {
      alert(`Zoho Sync Failed: ${err.message || err}`)
    } finally {
      setZohoSyncing(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>ERP Integrations</h1>
          <p>Automate transaction syncs by connecting local Tally Prime servers or Zoho Books Cloud APIs.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Tallyprime Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '28px' }}>🏢</span>
            <div>
              <h2 style={{ margin: 0 }}>TallyPrime SOAP Bridge</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Syncs internal voucher ledger registers.</p>
            </div>
          </div>

          <form onSubmit={handleTallySync} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tally Host / Address</label>
              <input
                type="text"
                value={tallyHost}
                onChange={(e) => setTallyHost(e.target.value)}
                placeholder="e.g. localhost:9000"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Company Name (Exact name in Tally)</label>
              <input
                type="text"
                value={tallyCompany}
                onChange={(e) => setTallyCompany(e.target.value)}
                placeholder="e.g. Acme Industries Ltd."
                className="form-input"
              />
            </div>

            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  value={tallyFrom}
                  onChange={(e) => setTallyFrom(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  value={tallyTo}
                  onChange={(e) => setTallyTo(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={tallySyncing}
            >
              {tallySyncing ? 'Pulling vouchers from TallyPrime...' : '📥 Pull & Match Tally Ledger'}
            </button>
          </form>
        </div>

        {/* Zoho Books Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>☁️</span>
            <div>
              <h2 style={{ margin: 0 }}>Zoho Books OAuth API</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Syncs bank statement transaction feeds.</p>
            </div>
          </div>

          {/* Zoho Connection Status Block */}
          {isZohoConnected ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  background: '#d1fae5',
                  color: '#065f46',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  ✅ Connected
                </span>
                <button
                  onClick={handleDisconnectZoho}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    color: '#dc2626',
                    borderColor: '#fca5a5',
                    background: 'none',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Disconnect
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#1e293b' }}>
                <span>Organization ID: </span>
                <strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>{entity?.zoho_org_id || 'Not Available'}</strong>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  Not Connected
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Connect your Zoho Books cloud organization using secure OAuth 2.0 protocol to auto-fetch transaction bank statements.
              </p>
              <button
                type="button"
                onClick={handleConnectZoho}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '4px' }}
                disabled={zohoConnecting}
              >
                {zohoConnecting ? 'Redirecting to Zoho...' : '🔗 Connect Zoho Books'}
              </button>
            </div>
          )}

          {/* Zoho Sync Form */}
          {isZohoConnected && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>Sync Dates range</h3>
              <form onSubmit={handleZohoSync} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="grid-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">From Date</label>
                    <input
                      type="date"
                      value={zohoFrom}
                      onChange={(e) => setZohoFrom(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">To Date</label>
                    <input
                      type="date"
                      value={zohoTo}
                      onChange={(e) => setZohoTo(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={zohoSyncing}
                >
                  {zohoSyncing ? 'Syncing Zoho Books transactions...' : '⚡ Pull Zoho Bank Transactions'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Sync Jobs history table */}
      <div className="card" style={{ marginTop: '24px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Sync History Logs</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>History of Tally and Zoho Books sync jobs executed.</p>
          </div>
          <button
            onClick={fetchJobs}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            disabled={loadingJobs}
          >
            {loadingJobs ? 'Refreshing Logs...' : '🔄 Refresh Log'}
          </button>
        </div>

        {jobs.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            No sync logs recorded yet. Run a sync above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Source ERP</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Sync Range</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Rows Synced</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Error Details</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Executed At</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                      {job.source === 'tally' ? '🏢 TallyPrime' : '☁️ Zoho Books'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px' }}>
                      {job.from_date} to {job.to_date}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {job.status === 'success' ? (
                        <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Success</span>
                      ) : job.status === 'failed' ? (
                        <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Failed</span>
                      ) : (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Running</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>
                      {job.status === 'success' ? job.rows_pulled : '-'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '11px', color: '#ef4444', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error_msg}>
                      {job.error_msg || '-'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {new Date(job.completed_at || job.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: notification.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'slideIn 0.3s ease',
          transition: 'all 0.3s ease'
        }}>
          <span>{notification.type === 'success' ? '✅' : '❌'}</span>
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)} 
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              marginLeft: '12px'
            }}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
