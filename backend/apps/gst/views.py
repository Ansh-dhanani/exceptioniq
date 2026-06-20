import csv
import io
from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.entities.models import Entity
from apps.gst.models import GSTR2BRecord, PurchaseRegisterEntry, GSTReconciliationRun
from apps.gst.services import run_gst_reconciliation
from apps.api.serializers import (
    GSTReconciliationRunSerializer, GSTR2BRecordSerializer, PurchaseRegisterEntrySerializer
)
from apps.api.permissions import RolePermission

class GSTViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = GSTReconciliationRun.objects.all().order_by('-created_at')
    serializer_class = GSTReconciliationRunSerializer
    filterset_fields = ['entity', 'tax_period', 'status']

    @action(detail=False, methods=['post'], url_path='upload-gstr2b')
    def upload_gstr2b(self, request):
        entity_id = request.data.get('entity_id')
        tax_period = request.data.get('tax_period')
        rows = request.data.get('rows', [])

        if not entity_id or not tax_period:
            return Response({'error': 'entity_id and tax_period are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        records_created = 0
        for r in rows:
            # Parse invoice_date. Let's support formats like DD-MM-YYYY, YYYY-MM-DD
            idt_str = r.get('invoice_date', '')
            parsed_date = None
            for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d'):
                try:
                    parsed_date = datetime.strptime(idt_str, fmt).date()
                    break
                except ValueError:
                    continue
            
            if not parsed_date:
                parsed_date = datetime.today().date()

            GSTR2BRecord.objects.update_or_create(
                entity=entity,
                tax_period=tax_period,
                supplier_gstin=r.get('supplier_gstin', '').strip().upper(),
                invoice_number=r.get('invoice_number', '').strip().upper(),
                defaults={
                    'invoice_date': parsed_date,
                    'taxable_value': Decimal(str(r.get('taxable_value', 0))),
                    'igst': Decimal(str(r.get('igst', 0))),
                    'cgst': Decimal(str(r.get('cgst', 0))),
                    'sgst': Decimal(str(r.get('sgst', 0))),
                    'total_tax': Decimal(str(r.get('total_tax', 0))),
                    'raw_data': r
                }
            )
            records_created += 1

        return Response({'status': 'success', 'records_created': records_created})

    @action(detail=False, methods=['post'], url_path='upload-purchase-register')
    def upload_purchase_register(self, request):
        entity_id = request.data.get('entity_id')
        tax_period = request.data.get('tax_period')
        file = request.FILES.get('file')

        if not entity_id or not tax_period or not file:
            return Response({'error': 'entity_id, tax_period and file are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        csv_data = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(csv_data))
        records_created = 0

        for r in reader:
            # Standardize column header mappings: case-insensitive
            row_dict = {k.lower().replace(' ', '_').strip(): v for k, v in r.items() if k}
            
            supplier_gstin = row_dict.get('supplier_gstin') or row_dict.get('gstin', '')
            invoice_number = row_dict.get('invoice_number') or row_dict.get('invoice_no') or row_dict.get('inv_no', '')
            invoice_date_str = row_dict.get('invoice_date') or row_dict.get('date', '')
            taxable_val_str = row_dict.get('taxable_value') or row_dict.get('taxable_val', '0')
            igst_str = row_dict.get('igst', '0')
            cgst_str = row_dict.get('cgst', '0')
            sgst_str = row_dict.get('sgst', '0')
            total_tax_str = row_dict.get('total_tax', '0')

            if not supplier_gstin or not invoice_number:
                continue

            parsed_date = None
            for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d'):
                try:
                    parsed_date = datetime.strptime(invoice_date_str, fmt).date()
                    break
                except ValueError:
                    continue

            try:
                taxable_value = Decimal(taxable_val_str.replace(',', '').strip() or '0')
                igst = Decimal(igst_str.replace(',', '').strip() or '0')
                cgst = Decimal(cgst_str.replace(',', '').strip() or '0')
                sgst = Decimal(sgst_str.replace(',', '').strip() or '0')
                total_tax = Decimal(total_tax_str.replace(',', '').strip() or '0')
            except Exception:
                taxable_value = Decimal('0')
                igst = Decimal('0')
                cgst = Decimal('0')
                sgst = Decimal('0')
                total_tax = Decimal('0')

            if total_tax == 0:
                total_tax = igst + cgst + sgst

            PurchaseRegisterEntry.objects.update_or_create(
                entity=entity,
                tax_period=tax_period,
                supplier_gstin=supplier_gstin.strip().upper(),
                invoice_number=invoice_number.strip().upper(),
                defaults={
                    'invoice_date': parsed_date,
                    'taxable_value': taxable_value,
                    'igst': igst,
                    'cgst': cgst,
                    'sgst': sgst,
                    'total_tax': total_tax,
                    'raw_data': row_dict
                }
            )
            records_created += 1

        return Response({'status': 'success', 'records_created': records_created})

    @action(detail=False, methods=['post'], url_path='run')
    def run_reconciliation(self, request):
        entity_id = request.data.get('entity_id')
        tax_period = request.data.get('tax_period')

        if not entity_id or not tax_period:
            return Response({'error': 'entity_id and tax_period are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            run = run_gst_reconciliation(entity, tax_period)
            return Response(GSTReconciliationRunSerializer(run).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='summary')
    def get_summary(self, request):
        entity_id = request.query_params.get('entity_id')
        tax_period = request.query_params.get('tax_period')

        if not entity_id or not tax_period:
            return Response({'error': 'entity_id and tax_period are required'}, status=status.HTTP_400_BAD_REQUEST)

        runs = GSTReconciliationRun.objects.filter(entity_id=entity_id, tax_period=tax_period).order_by('-completed_at')
        if not runs.exists():
            return Response({'status': 'not_run', 'message': 'No reconciliation run found for this period'})

        latest_run = runs.first()
        return Response(GSTReconciliationRunSerializer(latest_run).data)
