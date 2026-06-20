export interface Entity {
  id: string;
  name: string;
  code: string;
  gstin: string;
  currency: string;
  tally_company_name?: string;
  zoho_org_id?: string;
  zoho_access_token?: string;
  zoho_refresh_token?: string;
  zoho_token_expiry?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'analyst' | 'approver' | 'manager' | 'viewer';
}

export interface Batch {
  id: string;
  entity: string;
  recon_type: 'bank' | 'ap' | 'ar' | 'gst';
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  source_name: string;
  total_rows: number;
  matched_rows: number;
  exception_rows: number;
  error_rows: number;
  created_at: string;
}

export interface ExceptionComment {
  id: string;
  exception: string;
  user: User | null;
  message: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  exception: string;
  user: User | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ExceptionRecord {
  id: string;
  entity: string;
  reconciliation_type: string;
  exception_code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'routed' | 'investigating' | 'pending_approval' | 'resolved' | 'approved' | 'closed';
  source_record_ids: string[];
  amount_difference: string;
  date_difference: number;
  confidence_score: string;
  context: {
    bank_line_id?: string | null;
    ledger_entry_id?: string | null;
    reference?: string;
    counterparty?: string;
    narration?: string;
    [key: string]: any;
  };
  assigned_to: User | null;
  sla_deadline: string | null;
  resolution_code: string;
  root_cause_code: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  comments?: ExceptionComment[];
  audit_logs?: AuditLog[];
}

export interface RoutingRule {
  id: string;
  entity: string;
  reconciliation_type: string;
  exception_code: string;
  min_amount: string;
  max_amount: string | null;
  assign_to_role: string;
  sla_hours: number;
  priority: string;
  active: boolean;
}

export interface GSTReconciliationRun {
  id: string;
  entity: string;
  tax_period: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_gstr2b: number;
  total_purchase: number;
  matched: number;
  exceptions: number;
  itc_at_risk: string;
  completed_at: string | null;
  created_at: string;
}

export interface TDSReconciliationRun {
  id: string;
  entity: string;
  financial_year: string;
  quarter: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_26as: number;
  total_ledger: number;
  matched: number;
  exceptions: number;
  amount_at_risk: string;
  completed_at: string | null;
  created_at: string;
}

export interface VendorRiskScore {
  id: string;
  vendor: string;
  score: number;
  risk_level: 'green' | 'amber' | 'red';
  exception_count_90d: number;
  avg_resolution_days: string;
  sla_breach_count: number;
  amount_at_risk: string;
  last_computed: string;
}

export interface Vendor {
  id: string;
  entity: string;
  name: string;
  gstin: string;
  pan: string;
  email: string;
  payment_blocked: boolean;
  risk_score?: VendorRiskScore | null;
  created_at: string;
  updated_at: string;
}

export interface CloseChecklistItem {
  id: string;
  period: string;
  title: string;
  description: string;
  category: 'bank' | 'gst' | 'tds' | 'vendor' | 'payroll' | 'other';
  is_critical: boolean;
  source: 'auto' | 'manual';
  assigned_to: User | null;
  due_date: string | null;
  is_complete: boolean;
  completed_by: User | null;
  completed_at: string | null;
  linked_url: string;
  created_at: string;
}

export interface MonthEndPeriod {
  id: string;
  entity: string;
  period: string;
  status: 'open' | 'in_progress' | 'closed';
  closed_by: User | null;
  closed_at: string | null;
  items?: CloseChecklistItem[];
  created_at: string;
}

export interface SyncJob {
  id: string;
  entity: string;
  source: 'tally' | 'zoho';
  from_date: string;
  to_date: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  rows_pulled: number;
  error_msg: string;
  completed_at: string | null;
  created_at: string;
}

