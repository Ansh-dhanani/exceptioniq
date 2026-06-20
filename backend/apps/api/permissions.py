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
