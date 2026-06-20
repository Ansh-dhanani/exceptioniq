import csv
import io
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model, authenticate, login, logout
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.entities.models import Entity
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from apps.exceptions_app.models import ExceptionRecord, ExceptionComment, AuditLog
from apps.routing.models import RoutingRule

from .serializers import (
    EntitySerializer, BatchSerializer, LedgerEntrySerializer,
    BankStatementLineSerializer, ExceptionRecordSerializer,
    ExceptionCommentSerializer, RoutingRuleSerializer, UserSerializer
)
from .services import detect_bank_exceptions, apply_routing
from .permissions import RolePermission

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout(request):
    logout(request)
    return Response({'status': 'logged_out'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        'id': str(request.user.id),
        'username': request.user.username,
        'email': request.user.email,
        'role': request.user.role,
        'first_name': request.user.first_name,
        'last_name': request.user.last_name,
    })

class EntityViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = Entity.objects.all().order_by('name')
    serializer_class = EntitySerializer

class RoutingRuleViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = RoutingRule.objects.select_related('entity').all().order_by('-created_at')
    serializer_class = RoutingRuleSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [RolePermission]
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer

class ExceptionViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = ExceptionRecord.objects.select_related('entity', 'assigned_to').prefetch_related('comments', 'audit_logs').all().order_by('-created_at')
    serializer_class = ExceptionRecordSerializer
    filterset_fields = ['entity', 'reconciliation_type', 'exception_code', 'status', 'severity']

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        exception = self.get_object()
        serializer = ExceptionCommentSerializer(data={
            'exception': str(exception.id),
            'message': request.data.get('message', '').strip(),
        })
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user)
        AuditLog.objects.create(exception=exception, user=request.user, action='commented', metadata={'comment_id': str(comment.id)})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'resolved'
        exception.resolution_code = request.data.get('resolution_code', 'manual_resolution')
        exception.resolved_at = timezone.now()
        exception.save(update_fields=['status', 'resolution_code', 'resolved_at', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Resolved: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='resolved', metadata={'resolution_code': exception.resolution_code, 'note': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'closed'
        exception.save(update_fields=['status', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Approved: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='approved', metadata={'note': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'investigating'
        exception.save(update_fields=['status', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Rejected: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='rejected', metadata={'reason': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        exception = self.get_object()
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
            exception.assigned_to = user
            exception.save(update_fields=['assigned_to', 'updated_at'])
            AuditLog.objects.create(exception=exception, user=request.user, action='reassigned', metadata={'assigned_to': user.username})
            return Response(ExceptionRecordSerializer(exception).data)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='ai-summary')
    def ai_summary(self, request, pk=None):
        exception = self.get_object()
        import requests
        from django.conf import settings
        
        desc = f"""# Reconciliation Exception Details
- **Exception ID**: {exception.id}
- **Type**: {exception.reconciliation_type.upper()}
- **Exception Code**: {exception.exception_code}
- **Severity**: {exception.severity.upper()}
- **Status**: {exception.status.upper()}
- **Amount Difference**: {exception.amount_difference}
- **Date Difference**: {exception.date_difference} days
- **Context**: {exception.context}
"""
        try:
            res = requests.post(
                f"{settings.AI_SERVICE_URL}/summarize-exception",
                json={'markdown': desc},
                timeout=5
            )
            if res.status_code == 200:
                return Response(res.json())
            return Response({'summary': f"AI service returned status code {res.status_code}"})
        except Exception as e:
            return Response({'summary': f"Error calling AI Service: {str(e)}"})

class ReconciliationViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]

    @action(detail=False, methods=['post'], url_path='bank/upload')
    def bank_upload(self, request):
        entity_id = request.data.get('entity_id')
        csv_text = request.data.get('csv_text', '')
        rows_json = request.data.get('rows', None)
        source_type = request.data.get('source_type', 'bank')
        entity = Entity.objects.get(id=entity_id)
        batch = Batch.objects.create(entity=entity, recon_type='bank', status='processing', source_name=f'{source_type}_upload')

        reader = rows_json if rows_json is not None else list(csv.DictReader(io.StringIO(csv_text)))
        total = 0
        inserted = 0
        errors = []
        
        for idx, row in enumerate(reader):
            total += 1
            try:
                txn_date = row.get('txn_date')
                if not txn_date:
                    raise ValueError("Transaction date is missing.")
                
                amount_raw = row.get('amount')
                if amount_raw is None or amount_raw == '':
                    raise ValueError("Amount is missing.")
                
                try:
                    amount = Decimal(str(amount_raw))
                except Exception:
                    raise ValueError(f"Invalid amount format: '{amount_raw}'")

                payload = {
                    'entity': entity,
                    'batch': batch,
                    'txn_date': txn_date,
                    'amount': amount,
                    'reference': row.get('reference', '') or '',
                    'counterparty': row.get('counterparty', '') or '',
                    'raw_data': row,
                }
                
                with transaction.atomic():
                    if source_type == 'bank':
                        BankStatementLine.objects.create(narration=row.get('narration', '') or '', **payload)
                    else:
                        LedgerEntry.objects.create(account_type=row.get('account_type', 'bank') or 'bank', **payload)
                inserted += 1
            except Exception as e:
                errors.append({
                    'row_index': idx,
                    'error': str(e),
                    'row_data': row
                })

        batch.total_rows = total
        batch.status = 'completed'
        batch.save(update_fields=['total_rows', 'status', 'updated_at'])
        
        return Response({
            'batch': BatchSerializer(batch).data,
            'total_rows': total,
            'inserted_rows': inserted,
            'failed_rows': len(errors),
            'errors': errors
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bank/run')
    def bank_run(self, request):
        entity = Entity.objects.get(id=request.data.get('entity_id'))
        created = detect_bank_exceptions(entity)
        routed = [apply_routing(exc) for exc in created]
        return Response({'exceptions_created': len(routed)})

    @action(detail=False, methods=['post'], url_path='bank/clear')
    def bank_clear(self, request):
        from django.conf import settings
        if not settings.DEBUG:
            return Response(
                {"error": "This action is only available in debug mode."},
                status=status.HTTP_403_FORBIDDEN
            )
        entity_id = request.data.get('entity_id')
        if not entity_id:
            return Response({'error': 'entity_id is required'}, status=400)
        entity = Entity.objects.get(id=entity_id)
        with transaction.atomic():
            ExceptionRecord.objects.filter(entity=entity).delete()
            LedgerEntry.objects.filter(entity=entity).delete()
            BankStatementLine.objects.filter(entity=entity).delete()
            Batch.objects.filter(entity=entity).delete()
        return Response({'status': 'cleared'})

@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})
