from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.entities.models import Entity
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from apps.api.services import detect_bank_exceptions
from apps.integrations.models import SyncJob
from apps.integrations.tally import pull_tally_ledger
from apps.integrations.zoho import pull_zoho_bank_transactions, _refresh_zoho_token
from apps.api.serializers import SyncJobSerializer
from apps.api.permissions import RolePermission

class SyncJobViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [RolePermission]
    queryset = SyncJob.objects.all().order_by('-created_at')
    serializer_class = SyncJobSerializer
    filterset_fields = ['entity', 'source', 'status']


class IntegrationsViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]

    @action(detail=False, methods=['post'], url_path='tally/sync')
    def tally_sync(self, request):
        entity_id = request.data.get('entity_id')
        from_date_str = request.data.get('from_date')
        to_date_str = request.data.get('to_date')
        tally_host = request.data.get('tally_host', 'localhost:9000')

        if not entity_id or not from_date_str or not to_date_str:
            return Response({'error': 'entity_id, from_date and to_date are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        job = SyncJob.objects.create(
            entity=entity,
            source='tally',
            from_date=from_date,
            to_date=to_date,
            status='running'
        )

        try:
            vouchers = pull_tally_ledger(entity, from_date, to_date, tally_host)
            
            # Create reconciliation Batch
            batch = Batch.objects.create(
                entity=entity,
                recon_type='bank',
                status='processing',
                source_name=f'TallyPrime Sync ({from_date_str} to {to_date_str})',
                total_rows=len(vouchers)
            )

            # Insert ledger entries
            for v in vouchers:
                try:
                    txn_date = datetime.strptime(v['txn_date'], '%Y-%m-%d').date()
                except ValueError:
                    txn_date = datetime.today().date()

                LedgerEntry.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date,
                    amount=v['amount'],
                    reference=v['reference'],
                    counterparty=v['counterparty'],
                    account_type='bank',
                    raw_data=v
                )

            batch.status = 'completed'
            batch.save(update_fields=['status'])

            # Trigger exception detection
            detect_bank_exceptions(entity)

            job.status = 'success'
            job.rows_pulled = len(vouchers)
            job.completed_at = timezone.now()
            job.save()

            return Response(SyncJobSerializer(job).data)

        except Exception as e:
            job.status = 'failed'
            job.error_msg = str(e)
            job.completed_at = timezone.now()
            job.save()
            return Response({'error': str(e), 'job_id': job.id}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='zoho/sync')
    def zoho_sync(self, request):
        entity_id = request.data.get('entity_id')
        from_date_str = request.data.get('from_date')
        to_date_str = request.data.get('to_date')

        if not entity_id or not from_date_str or not to_date_str:
            return Response({'error': 'entity_id, from_date and to_date are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        job = SyncJob.objects.create(
            entity=entity,
            source='zoho',
            from_date=from_date,
            to_date=to_date,
            status='running'
        )

        try:
            txns = pull_zoho_bank_transactions(entity, from_date, to_date)

            # Create reconciliation Batch
            batch = Batch.objects.create(
                entity=entity,
                recon_type='bank',
                status='processing',
                source_name=f'Zoho Books Sync ({from_date_str} to {to_date_str})',
                total_rows=len(txns)
            )

            # Insert bank statement lines
            for t in txns:
                try:
                    txn_date = datetime.strptime(t['txn_date'], '%Y-%m-%d').date()
                except ValueError:
                    txn_date = datetime.today().date()

                BankStatementLine.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date,
                    amount=t['amount'],
                    reference=t['reference'],
                    counterparty=t['counterparty'],
                    narration=t.get('narration', ''),
                    raw_data=t
                )

            batch.status = 'completed'
            batch.save(update_fields=['status'])

            # Trigger exception detection
            detect_bank_exceptions(entity)

            job.status = 'success'
            job.rows_pulled = len(txns)
            job.completed_at = timezone.now()
            job.save()

            return Response(SyncJobSerializer(job).data)

        except Exception as e:
            job.status = 'failed'
            job.error_msg = str(e)
            job.completed_at = timezone.now()
            job.save()
            return Response({'error': str(e), 'job_id': job.id}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='zoho/connect')
    def zoho_connect(self, request):
        entity_id = request.data.get('entity_id')
        zoho_org_id = request.data.get('zoho_org_id')
        zoho_refresh_token = request.data.get('zoho_refresh_token')

        if not entity_id or not zoho_org_id or not zoho_refresh_token:
            return Response({'error': 'entity_id, zoho_org_id and zoho_refresh_token are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        # Store details on entity
        entity.zoho_org_id = zoho_org_id
        entity.zoho_refresh_token = zoho_refresh_token
        entity.save(update_fields=['zoho_org_id', 'zoho_refresh_token'])

        # Test refresh token connection
        try:
            _refresh_zoho_token(entity)
            return Response({'status': 'success', 'message': 'Successfully authenticated with Zoho Books'})
        except Exception as e:
            return Response({'error': f'Failed to verify Zoho connection: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
