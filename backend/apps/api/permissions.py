from rest_framework.permissions import BasePermission

ROLE_ACTION_MAP = {
    'comment':        {'admin', 'manager', 'approver', 'analyst'},
    'resolve':        {'admin', 'manager', 'analyst'},
    'approve':        {'admin', 'manager', 'approver'},
    'reject':         {'admin', 'manager', 'approver'},
    'reassign':       {'admin', 'manager'},
    'ai_summary':     {'admin', 'manager', 'analyst'},
    'bank_upload':    {'admin', 'manager', 'analyst'},
    'bank_run':       {'admin', 'manager', 'analyst'},
    'bank_clear':     {'admin'},
    'export_pdf_report': {'admin', 'manager', 'approver'},
    'create':         {'admin'},
    'update':         {'admin'},
    'partial_update': {'admin'},
    'destroy':        {'admin'},
    
    # GST
    'upload_gstr2b':          {'admin', 'manager', 'analyst'},
    'upload_purchase_register':{'admin', 'manager', 'analyst'},
    'gst_run':                {'admin', 'manager', 'analyst'},
    'gst_summary':            {'admin', 'manager', 'approver', 'analyst', 'viewer'},

    # TDS
    'upload_26as':            {'admin', 'manager', 'analyst'},
    'upload_tds_ledger':      {'admin', 'manager', 'analyst'},
    'tds_run':                {'admin', 'manager', 'analyst'},

    # Vendors
    'block_payment':          {'admin', 'manager'},
    'unblock_payment':        {'admin', 'manager'},
    'recompute_risk':         {'admin'},

    # Close
    'generate_close':         {'admin', 'manager'},
    'close_period':           {'admin', 'manager'},
    'complete_item':          {'admin', 'manager', 'approver', 'analyst'},

    # Integrations
    'tally_sync':             {'admin', 'manager'},
    'zoho_sync':              {'admin', 'manager'},
    'zoho_connect':           {'admin'},
}

class RolePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', 'viewer')
        action = getattr(view, 'action', None)
        if action in ('list', 'retrieve', None):
            return True
        allowed = ROLE_ACTION_MAP.get(action, {'admin'})
        return role in allowed
