import { Link } from 'react-router-dom'
import { ExceptionRecord } from '../types'
import StatusChip from './StatusChip'
import SeverityBadge from './SeverityBadge'
import SlaCountdown from './SlaCountdown'

interface ExceptionTableProps {
  exceptions: ExceptionRecord[]
}

export default function ExceptionTable({ exceptions }: ExceptionTableProps) {
  if (exceptions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>No exceptions found matching filters.</p>
      </div>
    )
  }

  // Format currency helper
  const formatCurrency = (val: string) => {
    const num = parseFloat(val) || 0
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(num)
  }

  return (
    <div className="table-container">
      <div className="responsive-table">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Exception Code</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Amount Diff</th>
              <th>Drift (Days)</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>SLA Remaining</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map(exc => (
              <tr key={exc.id}>
                <td style={{ fontWeight: 600 }}>
                  <Link to={`/app/exceptions/${exc.id}`} style={{ color: 'var(--color-primary)' }}>
                    {exc.id.slice(0, 8).toUpperCase()}
                  </Link>
                </td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{exc.exception_code}</span>
                </td>
                <td style={{ textTransform: 'capitalize' }}>
                  {exc.reconciliation_type}
                </td>
                <td>
                  <SeverityBadge severity={exc.severity} />
                </td>
                <td style={{ fontWeight: 600 }}>
                  {formatCurrency(exc.amount_difference)}
                </td>
                <td>
                  {exc.date_difference} d
                </td>
                <td>
                  <StatusChip status={exc.status} />
                </td>
                <td>
                  {exc.assigned_to ? (
                    <span style={{ fontSize: '13px' }}>👤 {exc.assigned_to.username} ({exc.assigned_to.role})</span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Unassigned</span>
                  )}
                </td>
                <td>
                  <SlaCountdown deadlineStr={exc.sla_deadline} status={exc.status} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Link to={`/app/exceptions/${exc.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                    🔍 Investigate
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
