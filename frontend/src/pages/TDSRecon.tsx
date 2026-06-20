import { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { client } from '../api/client'
import { TDSReconciliationRun } from '../types'

interface AppContextType {
  entityId: string
}

export default function TDSRecon() {
  const { entityId } = useOutletContext<AppContextType>()
  
  const [financialYear, setFinancialYear] = useState('2024-2025')
  const [quarter, setQuarter] = useState('Q1')
  
  const [asFile, setAsFile] = useState<File | null>(null)
  const [ledgerFile, setLedgerFile] = useState<File | null>(null)
  
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  
  const [latestRun, setLatestRun] = useState<TDSReconciliationRun | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)

  // Fetch latest run summary
  const fetchSummary = async () => {
    if (!entityId || !financialYear || !quarter) return
    setLoadingRun(true)
    try {
      const runs = await client.get(`/tds/?entity=${entityId}&financial_year=${financialYear}&quarter=${quarter}`)
      if (runs && runs.results && runs.results.length > 0) {
        setLatestRun(runs.results[0])
      } else {
        setLatestRun(null)
      }
    } catch (err) {
      setLatestRun(null)
    } finally {
      setLoadingRun(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [entityId, financialYear, quarter])

  // Handle uploading 26AS Statement (PDF, Text or CSV parsed via AI API)
  const handleAsUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asFile) return
    if (!entityId) {
      alert('Please select an active entity.')
      return
    }

    setParsing(true)
    const formData = new FormData()
    formData.append('file', asFile)

    try {
      // 1. Call AI service to parse Form 26AS text/CSV
      const parseRes = await fetch('http://localhost:8001/parse-26as', {
        method: 'POST',
        body: formData
      })
      if (!parseRes.ok) throw new Error('Form 26AS parsing failed on AI service')
      const parsedData = await parseRes.json()

      // 2. Upload rows to backend
      await client.post('/tds/upload-26as/', {
        entity_id: entityId,
        financial_year: financialYear,
        quarter: quarter,
        rows: parsedData.rows
      })

      alert(`Form 26AS parsed and uploaded successfully! Imported ${parsedData.total} rows.`)
      setAsFile(null)
    } catch (err: any) {
      alert(`26AS Ingestion Error: ${err.message || err}`)
    } finally {
      setParsing(false)
    }
  }

  // Handle uploading TDS Ledger CSV from Tally/ERP
  const handleLedgerUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerFile) return
    if (!entityId) {
      alert('Please select an active entity.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', ledgerFile)
    formData.append('entity_id', entityId)
    formData.append('financial_year', financialYear)
    formData.append('quarter', quarter)

    try {
      const res = await fetch(`http://localhost:8000/api/v1/tds/upload-ledger/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Upload failed')
      }
      const data = await res.json()
      alert(`TDS Ledger uploaded successfully! Imported ${data.records_created} records.`)
      setLedgerFile(null)
    } catch (err: any) {
      alert(`Ledger Ingestion Error: ${err.message || err}`)
    } finally {
      setUploading(false)
    }
  }

  // Handle running TDS reconciliation engine
  const handleRunRecon = async () => {
    if (!entityId || !financialYear || !quarter) return
    setRunning(true)
    try {
      const res = await client.post('/tds/run/', {
        entity_id: entityId,
        financial_year: financialYear,
        quarter: quarter
      })
      alert('TDS reconciliation completed successfully!')
      setLatestRun(res)
    } catch (err: any) {
      alert(`TDS Reconciliation failed: ${err.message || err}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>TDS 26AS Reconciliation</h1>
          <p>Match withholding tax entries between government Form 26AS and your general ledger TDS accounts.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="form-input"
            style={{ width: '130px', margin: 0 }}
          >
            <option value="2024-2025">FY 2024-25</option>
            <option value="2023-2024">FY 2023-24</option>
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="form-input"
            style={{ width: '100px', margin: 0 }}
          >
            <option value="Q1">Q1 (Apr-Jun)</option>
            <option value="Q2">Q2 (Jul-Sep)</option>
            <option value="Q3">Q3 (Oct-Dec)</option>
            <option value="Q4">Q4 (Jan-Mar)</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        {/* Ingest Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Form 26AS */}
          <div className="card">
            <h2>Form 26AS Upload</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload Form 26AS text export or copy-pasted text file containing deduction tables.</p>
            
            <form onSubmit={handleAsUpload}>
              <div className="form-group">
                <div className="drag-drop-area">
                  <div className="upload-icon">📁</div>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setAsFile(file)
                    }}
                    style={{ display: 'none' }}
                    id="as-file-input"
                  />
                  <label htmlFor="as-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>
                      {asFile ? `Selected: ${asFile.name}` : 'Select Form 26AS text/CSV file'}
                    </div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={parsing || !asFile}
              >
                {parsing ? 'Parsing Form 26AS...' : '✨ Parse & Import Form 26AS'}
              </button>
            </form>
          </div>

          {/* TDS Ledger */}
          <div className="card">
            <h2>TDS Ledger CSV Upload</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload Internal TDS Ledger (CSV format) exported from Tally/ERP for matching.</p>
            
            <form onSubmit={handleLedgerUpload}>
              <div className="form-group">
                <div className="drag-drop-area">
                  <div className="upload-icon">💼</div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setLedgerFile(file)
                    }}
                    style={{ display: 'none' }}
                    id="ledger-file-input"
                  />
                  <label htmlFor="ledger-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>
                      {ledgerFile ? `Selected: ${ledgerFile.name}` : 'Select TDS Ledger CSV'}
                    </div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={uploading || !ledgerFile}
              >
                {uploading ? 'Uploading TDS Ledger...' : '📥 Ingest TDS Ledger'}
              </button>
            </form>
          </div>
        </div>

        {/* Results Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ borderColor: '#818cf8', background: '#f5f7ff', height: '100%' }}>
            <h2>TDS Reconciliation Results</h2>
            <p style={{ fontSize: '13px', marginBottom: '24px' }}>Analyze deduction differences, incorrect section rates, and uncleared withholding tax credits.</p>
            
            {loadingRun ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading run info...</div>
            ) : latestRun ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {parseFloat(latestRun.amount_at_risk) > 0 && (
                  <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', borderLeft: '4px solid #ef4444', fontSize: '13px', fontWeight: 500 }}>
                    ⚠️ TDS Mismatch Amount: ₹{parseFloat(latestRun.amount_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
                
                <div className="grid-2" style={{ gap: '12px' }}>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Form 26AS Rows</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>{latestRun.total_26as}</div>
                  </div>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Ledger Accounts Rows</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>{latestRun.total_ledger}</div>
                  </div>
                  <div className="metric-box" style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#059669' }}>Matched PAN Vouchers</div>
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
                    to={`/exceptions?reconciliation_type=tds`}
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'block', textAlign: 'center', background: '#fff', color: '#4F46E5', borderColor: '#4F46E5' }}
                  >
                    🔍 View TDS Exceptions Queue
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No TDS reconciliation run recorded for FY {financialYear} {quarter} yet.
              </div>
            )}

            <button
              onClick={handleRunRecon}
              className="btn btn-primary"
              style={{ width: '100%', background: '#4F46E5', marginTop: '24px' }}
              disabled={running}
            >
              {running ? 'Running TDS Matching Engine...' : '⚡ Run TDS Reconciliation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
