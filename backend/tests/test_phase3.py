import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from apps.entities.models import Entity
from apps.gst.models import GSTR2BRecord, PurchaseRegisterEntry, GSTReconciliationRun
from apps.tds.models import Form26ASEntry, TDSLedgerEntry, TDSReconciliationRun
from apps.vendors.models import Vendor, VendorRiskScore
from apps.close.models import MonthEndPeriod, CloseChecklistItem
from apps.integrations.models import SyncJob
from apps.exceptions_app.models import ExceptionRecord

@pytest.mark.django_db
class TestPhase3Backend:

    @pytest.fixture(autouse=True)
    def setup_data(self, auth_client, admin_user):
        self.client = auth_client(admin_user)
        self.entity = Entity.objects.create(name="Test Entity", code="TE", gstin="29AAACT1234A1Z1")

    def test_gst_recon_flow(self):
        # 1. Upload GSTR-2B
        gstr2b_data = {
            'entity_id': self.entity.id,
            'tax_period': '2024-01',
            'rows': [
                {
                    'supplier_gstin': '29SUPP1234A1Z2',
                    'invoice_number': 'INV-001',
                    'invoice_date': '10-01-2024',
                    'taxable_value': 10000.00,
                    'igst': 1800.00,
                    'cgst': 0,
                    'sgst': 0,
                    'total_tax': 1800.00
                }
            ]
        }
        res = self.client.post(reverse('gst-upload-gstr2b'), gstr2b_data, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert GSTR2BRecord.objects.filter(entity=self.entity).count() == 1

        # 2. Run reconciliation (with missing purchase entry)
        run_data = {
            'entity_id': self.entity.id,
            'tax_period': '2024-01'
        }
        res = self.client.post(reverse('gst-run-reconciliation'), run_data, format='json')
        assert res.status_code == status.HTTP_200_OK
        
        run = GSTReconciliationRun.objects.get(entity=self.entity, tax_period='2024-01')
        assert run.status == 'completed'
        assert run.exceptions == 1
        assert run.itc_at_risk == Decimal('1800.00')

        # Check that exception record was created and routed
        excs = ExceptionRecord.objects.filter(entity=self.entity, reconciliation_type='gst')
        assert excs.count() == 1
        assert excs.first().exception_code == 'GST-MISS-PR'
        assert excs.first().status in ('detected', 'routed')

    def test_tds_recon_flow(self):
        # 1. Upload 26AS rows
        tds_data = {
            'entity_id': self.entity.id,
            'financial_year': '2024-2025',
            'quarter': 'Q1',
            'rows': [
                {
                    'deductor_pan': 'ABCDE1234F',
                    'deductor_name': 'Supplier A',
                    'gross_amount': 50000.00,
                    'tds_amount': 5000.00,
                    'section_code': '194J',
                    'tds_rate': 10.0
                }
            ]
        }
        res = self.client.post(reverse('tds-upload-26as'), tds_data, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert Form26ASEntry.objects.filter(entity=self.entity).count() == 1

        # 2. Run reconciliation (missing ledger entry)
        run_data = {
            'entity_id': self.entity.id,
            'financial_year': '2024-2025',
            'quarter': 'Q1'
        }
        res = self.client.post(reverse('tds-run-reconciliation'), run_data, format='json')
        assert res.status_code == status.HTTP_200_OK
        
        run = TDSReconciliationRun.objects.get(entity=self.entity, quarter='Q1')
        assert run.status == 'completed'
        assert run.exceptions == 1
        assert run.amount_at_risk == Decimal('5000.00')

    def test_vendor_risk_actions(self):
        vendor = Vendor.objects.create(entity=self.entity, name="Risk Vendor", gstin="29VEND1234A1Z3")
        VendorRiskScore.objects.create(vendor=vendor, score=75, risk_level='red')

        # Block payment
        res = self.client.post(reverse('vendors-block-payment', args=[vendor.id]))
        assert res.status_code == status.HTTP_200_OK
        vendor.refresh_from_db()
        assert vendor.payment_blocked is True

        # Unblock payment
        res = self.client.post(reverse('vendors-unblock-payment', args=[vendor.id]))
        assert res.status_code == status.HTTP_200_OK
        vendor.refresh_from_db()
        assert vendor.payment_blocked is False

    def test_month_end_close_flow(self):
        # Generate checklist
        res = self.client.post(reverse('close-generate-checklist'), {
            'entity_id': self.entity.id,
            'period': '2024-01'
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        
        period = MonthEndPeriod.objects.get(entity=self.entity, period='2024-01')
        assert period.items.count() > 0

        # Try to close period (should fail because critical items are not complete)
        res = self.client.post(reverse('close-close-period', args=[period.id]))
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Critical checklist items are incomplete' in res.data['error']

        # Complete all critical items
        for item in period.items.filter(is_critical=True):
            res = self.client.patch(
                reverse('close-complete-item', args=[period.id, item.id]),
                {'is_complete': True},
                format='json'
            )
            assert res.status_code == status.HTTP_200_OK

        # Try to close period again (should succeed now)
        res = self.client.post(reverse('close-close-period', args=[period.id]))
        assert res.status_code == status.HTTP_200_OK
        period.refresh_from_db()
        assert period.status == 'closed'
