import csv
import io
from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.entities.models import Entity
from apps.tds.models import Form26ASEntry, TDSLedgerEntry, TDSReconciliationRun
from apps.tds.services import run_tds_reconciliation
from apps.api.serializers import TDSReconciliationRunSerializer
from apps.api.permissions import RolePermission

class TDSViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = TDSReconciliationRun.objects.all().order_by('-created_at')
    serializer_class = TDSReconciliationRunSerializer
    filterset_fields = ['entity', 'financial_year', 'quarter', 'status']

    @action(detail=False, methods=['post'], url_path='upload-26as')
    def upload_26as(self, request):
        entity_id = request.data.get('entity_id')
        financial_year = request.data.get('financial_year')
        quarter = request.data.get('quarter')
        rows = request.data.get('rows', [])

        if not entity_id or not financial_year or not quarter:
            return Response({'error': 'entity_id, financial_year and quarter are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        records_created = 0
        for r in rows:
            dt_str = r.get('transaction_date', '')
            parsed_date = None
            if dt_str:
                for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d'):
                    try:
                        parsed_date = datetime.strptime(dt_str, fmt).date()
                        break
                    except ValueError:
                        continue

            # In Form 26AS, we can have multiple entries for same deductor.
            # To avoid duplicates if uploaded multiple times, we can insert fresh or check.
            # Usually Form 26AS doesn't have a unique invoice ID. We can use bulk create or delete-then-insert.
            # But let's check unique constraint if any. Our model doesn't have unique_together for entries,
            # so let's clear out previous uploaded Form 26AS for this entity, FY, quarter first!
            # That is the most robust way to support re-uploads.
            pass

        # Clean old entries for this period before writing new ones
        Form26ASEntry.objects.filter(entity=entity, financial_year=financial_year, quarter=quarter).delete()

        for r in rows:
            dt_str = r.get('transaction_date', '')
            parsed_date = None
            if dt_str:
                for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d'):
                    try:
                        parsed_date = datetime.strptime(dt_str, fmt).date()
                        break
                    except ValueError:
                        continue

            gross = Decimal(str(r.get('gross_amount', 0)))
            tds = Decimal(str(r.get('tds_amount', 0)))
            rate = Decimal(str(r.get('tds_rate', 0)))
            if gross > 0 and rate == 0:
                rate = round((tds / gross) * 100, 2)

            Form26ASEntry.objects.create(
                entity=entity,
                financial_year=financial_year,
                quarter=quarter,
                deductor_pan=r.get('deductor_pan', '').strip().upper(),
                deductor_name=r.get('deductor_name', '').strip(),
                transaction_date=parsed_date,
                gross_amount=gross,
                tds_amount=tds,
                tds_rate=rate,
                section_code=r.get('section_code', '').strip().upper(),
                raw_data=r
            )
            records_created += 1

        return Response({'status': 'success', 'records_created': records_created})

    @action(detail=False, methods=['post'], url_path='upload-ledger')
    def upload_ledger(self, request):
        entity_id = request.data.get('entity_id')
        financial_year = request.data.get('financial_year')
        quarter = request.data.get('quarter')
        file = request.FILES.get('file')

        if not entity_id or not financial_year or not quarter or not file:
            return Response({'error': 'entity_id, financial_year, quarter and file are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        csv_data = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(csv_data))
        records_created = 0

        # Clean old entries for this period before writing new ones
        TDSLedgerEntry.objects.filter(entity=entity, financial_year=financial_year, quarter=quarter).delete()

        for r in reader:
            row_dict = {k.lower().replace(' ', '_').strip(): v for k, v in r.items() if k}
            
            deductor_pan = row_dict.get('deductor_pan') or row_dict.get('pan', '')
            deductor_name = row_dict.get('deductor_name') or row_dict.get('party_name') or row_dict.get('name', '')
            transaction_date_str = row_dict.get('transaction_date') or row_dict.get('date', '')
            gross_amount_str = row_dict.get('gross_amount') or row_dict.get('gross_amt', '0')
            tds_amount_str = row_dict.get('tds_amount') or row_dict.get('tds_amt', '0')
            section_code = row_dict.get('section_code') or row_dict.get('section', '')
            tds_rate_str = row_dict.get('tds_rate') or row_dict.get('rate', '0')

            if not deductor_pan:
                continue

            parsed_date = None
            if transaction_date_str:
                for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d'):
                    try:
                        parsed_date = datetime.strptime(transaction_date_str, fmt).date()
                        break
                    except ValueError:
                        continue

            try:
                gross = Decimal(gross_amount_str.replace(',', '').strip() or '0')
                tds = Decimal(tds_amount_str.replace(',', '').strip() or '0')
                rate = Decimal(tds_rate_str.replace(',', '').strip() or '0')
            except Exception:
                gross = Decimal('0')
                tds = Decimal('0')
                rate = Decimal('0')

            if gross > 0 and rate == 0:
                rate = round((tds / gross) * 100, 2)

            TDSLedgerEntry.objects.create(
                entity=entity,
                financial_year=financial_year,
                quarter=quarter,
                deductor_pan=deductor_pan.strip().upper(),
                deductor_name=deductor_name.strip(),
                transaction_date=parsed_date,
                gross_amount=gross,
                tds_amount=tds,
                tds_rate=rate,
                section_code=section_code.strip().upper(),
                raw_data=row_dict
            )
            records_created += 1

        return Response({'status': 'success', 'records_created': records_created})

    @action(detail=False, methods=['post'], url_path='run')
    def run_reconciliation(self, request):
        entity_id = request.data.get('entity_id')
        financial_year = request.data.get('financial_year')
        quarter = request.data.get('quarter')

        if not entity_id or not financial_year or not quarter:
            return Response({'error': 'entity_id, financial_year and quarter are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            run = run_tds_reconciliation(entity, financial_year, quarter)
            return Response(TDSReconciliationRunSerializer(run).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
