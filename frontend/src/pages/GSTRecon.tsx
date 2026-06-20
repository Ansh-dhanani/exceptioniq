import { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { client } from '../api/client'
import { GSTReconciliationRun } from '../types'

interface AppContextType {
  entityId: string
}

export default function GSTRecon() {
  const { entityId } = useOutletContext<AppContextType>()
  
  const [taxPeriod, setTaxPeriod] = useState(() => {
    const d = new Date()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${month}`
  })
  
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null)
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null)
  
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  
  const [latestRun, setLatestRun] = useState<GSTReconciliationRun | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)

  // Fetch latest run summary
  const fetchSummary = async () => {
    if (!entityId || !taxPeriod) return
    setLoadingRun(true)
    try {
      const res = await client.get(`/gst/summary/?entity_id=${entityId}&tax_period=${taxPeriod}`)
      if (res.status === 'not_run') {
        setLatestRun(null)
      } else {
        setLatestRun(res)
      }
    } catch (err) {
      setLatestRun(null)
    } finally {
      setLoadingRun(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [entityId, taxPeriod])

  // Handle uploading GSTR-2B JSON
  const handleGstr2bUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gstr2bFile) return
    if (!entityId) {
      alert('Please select an active entity.')
      return
    }

    setParsing(true)
    const formData = new FormData()
    formData.append('file', gstr2bFile)

    try {
      // 1. Call AI service to parse GSTR-2B JSON
      const parseRes = await fetch('http://localhost:8001/parse-gstr2b', {
        method: 'POST',
        body: formData
      })
      if (!parseRes.ok) throw new Error('AI parse failed')
      const parsedData = await parseRes.json()

      // 2. Upload rows to backend
      await client.post('/gst/upload-gstr2b/', {
        entity_id: entityId,
        tax_period: taxPeriod,
        rows: parsedData.rows
      })

      alert(`GSTR-2B parsed and uploaded successfully! Imported ${parsedData.total} invoice records.`)
      setGstr2bFile(null)
    } catch (err: any) {
      alert(`GSTR-2B Ingestion Error: ${err.message || err}`)
    } finally {
      setParsing(false)
    }
  }

  // Handle uploading Purchase Register CSV
  const handlePurchaseUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchaseFile) return
    if (!entityId) {
      alert('Please select an active entity.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', purchaseFile)
    formData.append('entity_id', entityId)
    formData.append('tax_period', taxPeriod)

    try {
      const res = await fetch(`http://localhost:8000/api/v1/gst/upload-purchase-register/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Upload failed')
      }
      const data = await res.json()
      alert(`Purchase Register uploaded successfully! Imported ${data.records_created} records.`)
      setPurchaseFile(null)
    } catch (err: any) {
      alert(`Purchase Register Ingestion Error: ${err.message || err}`)
    } finally {
      setUploading(false)
    }
  }

  // Handle running GST reconciliation engine
  const handleRunRecon = async () => {
    if (!entityId || !taxPeriod) return
    setRunning(true)
    try {
      const res = await client.post('/gst/run/', {
        entity_id: entityId,
        tax_period: taxPeriod
      })
      alert('GST reconciliation completed successfully!')
      setLatestRun(res)
    } catch (err: any) {
      alert(`Reconciliation failed: ${err.message || err}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>GST ITC Reconciliation</h1>
          <p>Reconcile GSTR-2B statement against Purchase Register to optimize Input Tax Credit (ITC).</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label className="form-label" style={{ margin: 0, fontWeight: 500 }}>Tax Period:</label>
          <input
            type="month"
            value={taxPeriod}
            onChange={(e) => setTaxPeriod(e.target.value)}
            className="form-input"
            style={{ width: '160px', margin: 0 }}
          />
        </div>
      </div>

      <div className="grid-2">
        {/* Ingest Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* GSTR-2B JSON */}
          <div className="card">
            <h2>GSTR-2B JSON Upload</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload GSTR-2B file downloaded from GST portal (JSON format).</p>
            
            <form onSubmit={handleGstr2bUpload}>
              <div className="form-group">
                <div className="drag-drop-area">
                  <div className="upload-icon">📁</div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setGstr2bFile(file)
                    }}
                    style={{ display: 'none' }}
                    id="gstr2b-file-input"
                  />
                  <label htmlFor="gstr2b-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>
                      {gstr2bFile ? `Selected: ${gstr2bFile.name}` : 'Select GSTR-2B JSON file'}
                    </div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={parsing || !gstr2bFile}
              >
                {parsing ? 'Parsing and importing GSTR-2B...' : '✨ Process GSTR-2B JSON'}
              </button>
            </form>
          </div>

          {/* Purchase Register CSV */}
          <div className="card">
            <h2>Purchase Register CSV Upload</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload Internal Purchase Register (CSV format) exported from Tally/ERP.</p>
            
            <form onSubmit={handlePurchaseUpload}>
              <div className="form-group">
                <div className="drag-drop-area">
                  <div className="upload-icon">📄</div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setPurchaseFile(file)
                    }}
                    style={{ display: 'none' }}
                    id="purchase-file-input"
                  />
                  <label htmlFor="purchase-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>
                      {purchaseFile ? `Selected: ${purchaseFile.name}` : 'Select Purchase Register CSV'}
                    </div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={uploading || !purchaseFile}
              >
                {uploading ? 'Uploading Purchase Register...' : '📥 Ingest Purchase Register'}
              </button>
            </form>
          </div>
        </div>

        {/* Status and Action Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ borderColor: '#818cf8', background: '#f5f7ff', height: '100%' }}>
            <h2>Reconciliation Results</h2>
            <p style={{ fontSize: '13px', marginBottom: '24px' }}>Reconcile invoices by GSTIN + Invoice Number + Tax Period to detect ITC mismatch.</p>
            
            {loadingRun ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading run info...</div>
            ) : latestRun ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {parseFloat(latestRun.itc_at_risk) > 0 && (
                  <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', borderLeft: '4px solid #ef4444', fontSize: '13px', fontWeight: 500 }}>
                    ⚠️ ITC At Risk: ₹{parseFloat(latestRun.itc_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
                
                <div className="grid-2" style={{ gap: '12px' }}>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>GSTR-2B Rows</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>{latestRun.total_gstr2b}</div>
                  </div>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Purchase Reg Rows</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>{latestRun.total_purchase}</div>
                  </div>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#059669' }}>Matched Invoices</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>{latestRun.matched}</div>
                  </div>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#ef4444' }}>Exceptions Found</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{latestRun.exceptions}</div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                  Last run finished: <b>{new Date(latestRun.completed_at || latestRun.created_at).toLocaleString()}</b>
                </div>

                {latestRun.exceptions > 0 && (
                  <Link
                    to={`/exceptions?reconciliation_type=gst`}
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'block', textAlign: 'center', background: '#fff', color: '#4F46E5', borderColor: '#4F46E5' }}
                  >
                    🔍 View GST Exceptions Queue
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No reconciliation run recorded for tax period {taxPeriod} yet.
              </div>
            )}

            <button
              onClick={handleRunRecon}
              className="btn btn-primary"
              style={{ width: '100%', background: '#4F46E5', marginTop: '24px' }}
              disabled={running}
            >
              {running ? 'Running GST Matching Engine...' : '⚡ Run GST Reconciliation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
