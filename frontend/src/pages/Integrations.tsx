import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { client } from '../api/client'
import { SyncJob, Entity } from '../types'

interface AppContextType {
  entityId: string
}

export default function Integrations() {
  const { entityId } = useOutletContext<AppContextType>()

  // Tally inputs
  const [tallyHost, setTallyHost] = useState('localhost:9000')
  const [tallyCompany, setTallyCompany] = useState('')
  const [tallyFrom, setTallyFrom] = useState('')
  const [tallyTo, setTallyTo] = useState('')
  const [tallySyncing, setTallySyncing] = useState(false)

  // Zoho inputs
  const [zohoOrgId, setZohoOrgId] = useState('')
  const [zohoRefreshToken, setZohoRefreshToken] = useState('')
  const [zohoFrom, setZohoFrom] = useState('')
  const [zohoTo, setZohoTo] = useState('')
  const [zohoConnecting, setZohoConnecting] = useState(false)
  const [zohoSyncing, setZohoSyncing] = useState(false)

  // Jobs history list
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Load details of the entity (like current company name / connected state)
  const fetchEntityDetails = async () => {
    if (!entityId) return
    try {
      const ent: Entity = await client.get(`/entities/${entityId}/`)
      setTallyCompany(ent.tally_company_name || '')
      setZohoOrgId(ent.zoho_org_id || '')
      // Don't pre-populate refresh token for safety, but we can set placeholder if present
      if (ent.zoho_refresh_token) {
        setZohoRefreshToken('••••••••••••••••••••••••••••••••')
      } else {
        setZohoRefreshToken('')
      }
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

  // Save Zoho credentials & Connect
  const handleZohoConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entityId || !zohoOrgId || !zohoRefreshToken) {
      alert('Organization ID and Refresh Token are required.')
      return
    }

    setZohoConnecting(true)
    try {
      const res = await client.post('/integrations/zoho/connect/', {
        entity_id: entityId,
        zoho_org_id: zohoOrgId,
        zoho_refresh_token: zohoRefreshToken === '••••••••••••••••••••••••••••••••' ? undefined : zohoRefreshToken
      })
      alert(res.message || 'Zoho Books connection successful!')
      fetchEntityDetails()
    } catch (err: any) {
      alert(`Zoho Connection Failed: ${err.message || err}`)
    } finally {
      setZohoConnecting(false)
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

          {/* Zoho Connect Form */}
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>Connection Settings</h3>
            <form onSubmit={handleZohoConnect} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="grid-2" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Organization ID</label>
                  <input
                    type="text"
                    value={zohoOrgId}
                    onChange={(e) => setZohoOrgId(e.target.value)}
                    placeholder="e.g. 6007501..."
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">OAuth Refresh Token</label>
                  <input
                    type="password"
                    value={zohoRefreshToken}
                    onChange={(e) => setZohoRefreshToken(e.target.value)}
                    placeholder="Zoho OAuth Refresh Token"
                    className="form-input"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={zohoConnecting}
              >
                {zohoConnecting ? 'Verifying & Saving credentials...' : '🔗 Save & Test Connection'}
              </button>
            </form>
          </div>

          {/* Zoho Sync Form */}
          <div>
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
    </div>
  )
}
