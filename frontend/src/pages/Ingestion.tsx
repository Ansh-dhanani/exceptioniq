import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { client } from '../api/client'

interface AppContextType {
  entityId: string
}

export default function Ingestion() {
  const { entityId } = useOutletContext<AppContextType>()
  
  // CSV States
  const [bankCsv, setBankCsv] = useState('')
  const [ledgerCsv, setLedgerCsv] = useState('')
  const [bankFileSelected, setBankFileSelected] = useState<string | null>(null)
  const [ledgerFileSelected, setLedgerFileSelected] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // Matching state
  const [matching, setMatching] = useState(false)
  
  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [previewRows, setPreviewRows] = useState<any[]>([])

  // Handle CSV file selection and reading
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'ledger') => {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === 'bank') {
      setBankFileSelected(file.name)
    } else {
      setLedgerFileSelected(file.name)
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (type === 'bank') {
        setBankCsv(text)
      } else {
        setLedgerCsv(text)
      }
    }
    reader.readAsText(file)
  }

  // Handle upload of both CSVs
  const handleUploadCsvs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entityId) {
      alert('Please select an active entity first.')
      return
    }
    if (!bankCsv.trim() && !ledgerCsv.trim()) {
      alert('Please enter or upload at least one CSV dataset.')
      return
    }

    setUploading(true)
    try {
      if (bankCsv.trim()) {
        await client.post('/recon/bank/upload/', {
          entity_id: entityId,
          csv_text: bankCsv,
          source_type: 'bank'
        })
      }
      if (ledgerCsv.trim()) {
        await client.post('/recon/bank/upload/', {
          entity_id: entityId,
          csv_text: ledgerCsv,
          source_type: 'ledger'
        })
      }
      alert('Data uploaded successfully! Click OK to continue.')
      setBankCsv('')
      setLedgerCsv('')
      setBankFileSelected(null)
      setLedgerFileSelected(null)
    } catch (err: any) {
      alert(`Upload failed: ${err.message || err}`)
    } finally {
      setUploading(false)
    }
  }

  // Trigger matching engine
  const handleRunReconciliation = async () => {
    if (!entityId) {
      alert('Please select an active entity first.')
      return
    }
    setMatching(true)
    try {
      const res = await client.post('/recon/bank/run/', { entity_id: entityId })
      alert(`Reconciliation matching finished! Created/Routed ${res.exceptions_created} exceptions.`);
    } catch (err: any) {
      alert(`Failed to run reconciliation: ${err.message || err}`)
    } finally {
      setMatching(false)
    }
  }

  // Handle PDF Statement parsing
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pdfFile) return
    
    setParsing(true)
    setPreviewRows([])
    
    const formData = new FormData()
    formData.append('file', pdfFile)

    try {
      const res = await fetch('http://localhost:8001/parse-bank-pdf', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('PDF parsing failed on AI service')
      const data = await res.json()
      setPreviewRows(data.rows || [])
      if (data.rows?.length === 0) {
        alert('PDF parsed successfully, but no rows matches were extracted.')
      }
    } catch (err: any) {
      alert(`PDF Ingestion Error: ${err.message}`)
    } finally {
      setParsing(false)
    }
  }

  const handleCellChange = (index: number, field: string, value: any) => {
    const updated = [...previewRows]
    if (field === 'amount') {
      const parsedVal = parseFloat(value) || 0
      updated[index][field] = parsedVal
      if (parsedVal > 0 && updated[index].debit_credit !== 'unknown') {
        updated[index].needs_review = false
      }
    } else if (field === 'debit_credit') {
      updated[index][field] = value
      if (value !== 'unknown' && updated[index].amount > 0) {
        updated[index].needs_review = false
      }
    } else {
      updated[index][field] = value
    }
    setPreviewRows(updated)
  }

  const handleDeleteRow = (index: number) => {
    setPreviewRows(previewRows.filter((_, idx) => idx !== index))
  }

  const handleConfirmUpload = async () => {
    if (!entityId) {
      alert('Please select an active entity first.')
      return
    }
    if (previewRows.length === 0) return

    setUploading(true)
    try {
      const rows = previewRows.map(r => ({
        txn_date: r.txn_date,
        amount: r.debit_credit === 'debit' ? -Math.abs(r.amount) : Math.abs(r.amount),
        reference: r.reference || '',
        counterparty: r.counterparty || '',
        narration: r.narration || '',
      }))

      await client.post('/recon/bank/upload/', {
        entity_id: entityId,
        rows,
        source_type: 'bank'
      })

      alert('Parsed bank statement rows ingested successfully!')
      setPreviewRows([])
      setPdfFile(null)
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message || err}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>Data Ingestion</h1>
          <p>Import transaction entries and execute reconciliation matching rules.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* CSV Upload Column */}
        <div>
          <div className="card">
            <h2>CSV Transaction Upload</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Provide datasets for statement and ledger. Files must contain: <code>txn_date</code>, <code>amount</code>, <code>reference</code>, <code>counterparty</code>.</p>
            
            <form onSubmit={handleUploadCsvs}>
              {/* Bank Statement File */}
              <div className="form-group">
                <label className="form-label">🏦 Bank Statement CSV</label>
                <div className="drag-drop-area" style={{ padding: '16px' }}>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={(e) => handleFileChange(e, 'bank')}
                    style={{ display: 'none' }}
                    id="bank-file-input"
                  />
                  <label htmlFor="bank-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: '24px' }}>📄</div>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginTop: '4px' }}>
                      {bankFileSelected ? `Selected: ${bankFileSelected}` : 'Click to select Bank Statement CSV'}
                    </div>
                  </label>
                </div>
                <textarea 
                  value={bankCsv}
                  onChange={(e) => setBankCsv(e.target.value)}
                  placeholder="Or paste bank statement CSV rows here..."
                  className="form-input"
                  style={{ height: '80px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                />
              </div>

              {/* General Ledger File */}
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">📖 General Ledger CSV</label>
                <div className="drag-drop-area" style={{ padding: '16px' }}>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={(e) => handleFileChange(e, 'ledger')}
                    style={{ display: 'none' }}
                    id="ledger-file-input"
                  />
                  <label htmlFor="ledger-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: '24px' }}>📄</div>
                    <div style={{ fontWeight: 500, fontSize: '13px', marginTop: '4px' }}>
                      {ledgerFileSelected ? `Selected: ${ledgerFileSelected}` : 'Click to select General Ledger CSV'}
                    </div>
                  </label>
                </div>
                <textarea 
                  value={ledgerCsv}
                  onChange={(e) => setLedgerCsv(e.target.value)}
                  placeholder="Or paste ledger CSV rows here..."
                  className="form-input"
                  style={{ height: '80px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={uploading}
              >
                {uploading ? 'Processing Data Upload...' : '📥 Ingest Datasets'}
              </button>
            </form>
          </div>

          <div className="card" style={{ borderColor: '#818cf8', background: '#f5f7ff' }}>
            <h2>Matching Pipeline</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Run the matching engine to process loaded datasets, check against rules and tolerances, and generate exceptions.</p>
            <button 
              onClick={handleRunReconciliation}
              className="btn btn-primary"
              style={{ width: '100%', background: '#4F46E5' }}
              disabled={matching}
            >
              {matching ? 'Running Matching Rules...' : '⚡ Run Reconciliation Matching'}
            </button>
          </div>
        </div>

        {/* PDF Extraction Column */}
        <div>
          <div className="card">
            <h2>PDF Bank Statement Ingestion</h2>
            <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload a statement PDF (HDFC, SBI, ICICI, Axis, Kotak). Our AI parser extracts dates, amounts, and narrations for review.</p>
            
            <form onSubmit={handlePdfUpload}>
              <div className="form-group">
                <div className="drag-drop-area">
                  <div className="upload-icon">📁</div>
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setPdfFile(file)
                    }}
                    style={{ display: 'none' }}
                    id="pdf-file-input"
                  />
                  <label htmlFor="pdf-file-input" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>
                      {pdfFile ? `Selected: ${pdfFile.name}` : 'Drag & drop or click to upload statement PDF'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Supports PDF format up to 50MB</div>
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
                disabled={parsing || !pdfFile}
              >
                {parsing ? 'Parsing PDF Document...' : '✨ Process PDF Statement'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Full-width Editable Preview Table */}
      {previewRows.length > 0 && (
        <div className="card" style={{ marginTop: '24px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Editable Preview Table ({previewRows.length} lines parsed)</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>Verify extracted data. Highlighted rows ⚠️ have incomplete fields needing manual review.</p>
            </div>
            <button
              onClick={handleConfirmUpload}
              className="btn btn-primary"
              style={{ padding: '8px 16px', background: '#059669' }}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : '✔️ Confirm & Upload Ingest'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', width: '60px' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Txn Date</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', width: '130px' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', width: '110px' }}>Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Reference</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Counterparty</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Narration</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', width: '60px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderBottom: '1px solid var(--color-border)', 
                      background: row.needs_review ? '#fffbeb' : '#fff' 
                    }}
                  >
                    {/* Status Indicator */}
                    <td style={{ padding: '8px 16px', textAlign: 'center', fontSize: '16px' }}>
                      {row.needs_review ? (
                        <span title="Requires Review" style={{ cursor: 'help' }}>⚠️</span>
                      ) : (
                        <span title="Ready" style={{ cursor: 'default' }}>✅</span>
                      )}
                    </td>
                    
                    {/* Date */}
                    <td style={{ padding: '6px 12px' }}>
                      <input 
                        type="text" 
                        value={row.txn_date} 
                        onChange={(e) => handleCellChange(idx, 'txn_date', e.target.value)}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '6px 12px' }}>
                      <input 
                        type="number" 
                        value={row.amount} 
                        onChange={(e) => handleCellChange(idx, 'amount', e.target.value)}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right', fontSize: '12px' }}
                      />
                    </td>

                    {/* Debit/Credit Type */}
                    <td style={{ padding: '6px 12px' }}>
                      <select
                        value={row.debit_credit}
                        onChange={(e) => handleCellChange(idx, 'debit_credit', e.target.value)}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' }}
                      >
                        <option value="debit">debit (Dr)</option>
                        <option value="credit">credit (Cr)</option>
                        <option value="unknown">unknown</option>
                      </select>
                    </td>

                    {/* Reference */}
                    <td style={{ padding: '6px 12px' }}>
                      <input 
                        type="text" 
                        value={row.reference || ''} 
                        onChange={(e) => handleCellChange(idx, 'reference', e.target.value)}
                        placeholder="Ref No..."
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>

                    {/* Counterparty */}
                    <td style={{ padding: '6px 12px' }}>
                      <input 
                        type="text" 
                        value={row.counterparty || ''} 
                        onChange={(e) => handleCellChange(idx, 'counterparty', e.target.value)}
                        placeholder="Party..."
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>

                    {/* Narration */}
                    <td style={{ padding: '6px 12px' }}>
                      <input 
                        type="text" 
                        value={row.narration} 
                        onChange={(e) => handleCellChange(idx, 'narration', e.target.value)}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>

                    {/* Delete Action */}
                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDeleteRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                        title="Remove row"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
