import { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { client } from '../api/client'
import { Vendor, ExceptionRecord } from '../types'

interface AppContextType {
  entityId: string
}

export default function VendorRisk() {
  const { entityId } = useOutletContext<AppContextType>()
  
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  
  // Selected vendor details drawer state
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [vendorExceptions, setVendorExceptions] = useState<ExceptionRecord[]>([])
  const [loadingExceptions, setLoadingExceptions] = useState(false)
  
  const [recomputing, setRecomputing] = useState(false)

  // Fetch all vendors
  const fetchVendors = async () => {
    if (!entityId) return
    setLoading(true)
    try {
      const res = await client.get(`/vendors/?entity=${entityId}`)
      if (res && res.results) {
        setVendors(res.results)
      } else {
        setVendors(res)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [entityId])

  // Fetch individual vendor details and exception history
  const handleSelectVendor = async (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setLoadingExceptions(true)
    setVendorExceptions([])
    try {
      // Find exception records where context contains counterparty name
      // We can query `/exceptions/?entity=ID` and filter locally or query by counterparty
      // The exceptions API has filterset_fields: ['entity', 'reconciliation_type', 'exception_code', 'status', 'severity']
      // So we can query `/exceptions/?entity=${entityId}` and search locally for matching counterparty.
      const res = await client.get(`/exceptions/?entity=${entityId}`)
      const allExcs = res.results || res || []
      const filtered = allExcs.filter((exc: ExceptionRecord) => {
        const c_party = exc.context?.counterparty || ''
        return c_party.toLowerCase().trim() === vendor.name.toLowerCase().trim()
      })
      setVendorExceptions(filtered)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingExceptions(false)
    }
  }

  // Block/unblock payment release
  const handleToggleBlock = async (vendor: Vendor) => {
    const action = vendor.payment_blocked ? 'unblock-payment' : 'block-payment'
    try {
      const updated = await client.post(`/vendors/${vendor.id}/${action}/`, {})
      
      // Update local state
      setVendors(vendors.map(v => v.id === vendor.id ? updated : v))
      if (selectedVendor && selectedVendor.id === vendor.id) {
        setSelectedVendor(updated)
      }
      alert(`Successfully ${vendor.payment_blocked ? 'unblocked' : 'blocked'} payments for ${vendor.name}.`)
    } catch (err: any) {
      alert(`Failed to update payment status: ${err.message || err}`)
    }
  }

  // Recompute scores
  const handleRecomputeRisk = async () => {
    setRecomputing(true)
    try {
      const res = await client.post('/vendors/recompute-risk/', {})
      alert(`Risk calculation complete! Recomputed scores for ${res.recomputed} vendors.`)
      fetchVendors()
    } catch (err: any) {
      alert(`Failed to recompute risk: ${err.message || err}`)
    } finally {
      setRecomputing(false)
    }
  }

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'red':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🔴 High Risk</span>
      case 'amber':
        return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🟡 Medium Risk</span>
      case 'green':
      default:
        return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🟢 Low Risk</span>
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>Vendor Compliance Risk Ledger</h1>
          <p>Rolling 90-day vendor risk profile computed dynamically based on invoice errors, SLAs, and amount at risk.</p>
        </div>
        <button
          onClick={handleRecomputeRisk}
          className="btn btn-secondary"
          disabled={recomputing}
        >
          {recomputing ? 'Recalculating Risk Scores...' : '🔄 Recompute Risk Scores'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Vendors Table Card */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading vendors list...</div>
          ) : vendors.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No vendors recorded. Create exceptions to populate.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vendor Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>GSTIN / PAN</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Risk Level</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Score</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Exceptions (90d)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount at Risk</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Payment Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      onClick={() => handleSelectVendor(vendor)}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        background: selectedVendor?.id === vendor.id ? '#f1f5f9' : '#fff',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>{vendor.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>{vendor.gstin || vendor.pan || 'N/A'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {getRiskBadge(vendor.risk_score?.risk_level || 'green')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                        {vendor.risk_score?.score || 0}/100
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {vendor.risk_score?.exception_count_90d || 0}
                        {vendor.risk_score?.sla_breach_count ? (
                          <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '4px' }} title="SLA Breached exceptions">
                            ({vendor.risk_score.sla_breach_count} ⚠️)
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                        ₹{parseFloat(vendor.risk_score?.amount_at_risk || '0').toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {vendor.payment_blocked ? (
                          <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🛑 Blocked</span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>✔️ Active</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleBlock(vendor)}
                          className="btn"
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            background: vendor.payment_blocked ? '#10b981' : '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {vendor.payment_blocked ? '🔓 Unblock' : '🔒 Block'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Vendor Detail Drawer */}
        {selectedVendor && (
          <div className="card" style={{ width: '420px', padding: '24px', flexShrink: 0, position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Vendor Profile</h2>
              <button
                onClick={() => setSelectedVendor(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)' }}>{selectedVendor.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>GSTIN: {selectedVendor.gstin || 'N/A'}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Compliance Score</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: selectedVendor.risk_score?.risk_level === 'red' ? '#ef4444' : '#059669' }}>
                    {selectedVendor.risk_score?.score || 0}%
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Risk Level</div>
                  <div style={{ marginTop: '4px' }}>{getRiskBadge(selectedVendor.risk_score?.risk_level || 'green')}</div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '12px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Avg Resolution</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>{selectedVendor.risk_score?.avg_resolution_days || 0} days</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>SLA Breaches</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', color: selectedVendor.risk_score?.sla_breach_count ? '#ef4444' : '#000' }}>
                    {selectedVendor.risk_score?.sla_breach_count || 0}
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                  Exceptions Timeline ({vendorExceptions.length})
                </h3>
                {loadingExceptions ? (
                  <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading history...</div>
                ) : vendorExceptions.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>No exceptions in the past 90 days.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {vendorExceptions.map(exc => (
                      <Link
                        key={exc.id}
                        to={`/exceptions/${exc.id}`}
                        style={{
                          display: 'block',
                          padding: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          color: 'inherit',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span style={{ color: '#4F46E5' }}>{exc.exception_code}</span>
                          <span>₹{parseFloat(exc.amount_difference).toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '4px' }}>
                          <span>Type: {exc.reconciliation_type.toUpperCase()}</span>
                          <span>{new Date(exc.created_at).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
