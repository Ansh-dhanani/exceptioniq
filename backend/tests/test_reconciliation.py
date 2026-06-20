"""
Integration tests for reconciliation ingestion and run endpoints.
Covers: bank/upload (CSV), bank/upload (JSON rows), bank/run, bank/clear.
"""
import pytest
import json
from apps.exceptions_app.models import ExceptionRecord
from apps.reconciliation.models import BankStatementLine, LedgerEntry, Batch

BASE_RECON = "/api/v1/recon"

BANK_CSV = """txn_date,amount,reference,counterparty,narration
2024-01-10,10000.00,REF001,Vendor A,Payment to Vendor A
2024-01-12,5000.00,REF002,Vendor B,Service fee
2024-01-15,250.00,REF003,Vendor C,Utility bill
"""

LEDGER_CSV = """txn_date,amount,reference,counterparty,account_type
2024-01-10,10000.00,REF001,Vendor A,bank
2024-01-12,4500.00,REF002,Vendor B,bank
"""


@pytest.mark.django_db
class TestBankUploadCSV:
    def test_analyst_can_upload_csv(self, auth_client, analyst_user, entity):
        client = auth_client(analyst_user)
        res = client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "csv_text": BANK_CSV,
            "source_type": "bank",
        }, format="json")
        assert res.status_code == 201
        assert res.data["total_rows"] == 3
        assert BankStatementLine.objects.filter(entity=entity).count() == 3

    def test_viewer_cannot_upload(self, auth_client, viewer_user, entity):
        client = auth_client(viewer_user)
        res = client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "csv_text": BANK_CSV,
            "source_type": "bank",
        }, format="json")
        assert res.status_code == 403

    def test_approver_cannot_upload(self, auth_client, approver_user, entity):
        client = auth_client(approver_user)
        res = client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "csv_text": BANK_CSV,
        }, format="json")
        assert res.status_code == 403


@pytest.mark.django_db
class TestBankUploadJSONRows:
    def test_upload_json_rows_from_pdf_pipeline(self, auth_client, analyst_user, entity):
        rows = [
            {"txn_date": "2024-01-10", "amount": "10000.00", "reference": "REF001",
             "counterparty": "Vendor A", "narration": "Payment"},
            {"txn_date": "2024-01-11", "amount": "3000.00", "reference": "REF002",
             "counterparty": "Vendor B", "narration": "Fee"},
        ]
        client = auth_client(analyst_user)
        res = client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "rows": rows,
            "source_type": "bank",
        }, format="json")
        assert res.status_code == 201
        assert res.data["total_rows"] == 2
        assert BankStatementLine.objects.filter(entity=entity).count() == 2


@pytest.mark.django_db
class TestReconciliationRun:
    def _upload_both(self, auth_client, analyst_user, entity):
        client = auth_client(analyst_user)
        client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "csv_text": BANK_CSV,
            "source_type": "bank",
        }, format="json")
        client.post(f"{BASE_RECON}/bank/upload/", {
            "entity_id": str(entity.id),
            "csv_text": LEDGER_CSV,
            "source_type": "ledger",
        }, format="json")
        return client

    def test_run_creates_exceptions(self, auth_client, analyst_user, entity):
        client = self._upload_both(auth_client, analyst_user, entity)
        res = client.post(f"{BASE_RECON}/bank/run/", {"entity_id": str(entity.id)}, format="json")
        assert res.status_code == 200
        assert res.data["exceptions_created"] >= 1
        assert ExceptionRecord.objects.filter(entity=entity).count() >= 1

    def test_amount_mismatch_detected(self, auth_client, analyst_user, entity):
        client = self._upload_both(auth_client, analyst_user, entity)
        client.post(f"{BASE_RECON}/bank/run/", {"entity_id": str(entity.id)}, format="json")
        amt_mismatch = ExceptionRecord.objects.filter(entity=entity, exception_code="BANK-AMT")
        assert amt_mismatch.exists()

    def test_missing_ledger_detected(self, auth_client, analyst_user, entity):
        client = self._upload_both(auth_client, analyst_user, entity)
        client.post(f"{BASE_RECON}/bank/run/", {"entity_id": str(entity.id)}, format="json")
        missing = ExceptionRecord.objects.filter(entity=entity, exception_code="BANK-MISS-LEDGER")
        assert missing.exists()

    def test_viewer_cannot_run(self, auth_client, viewer_user, entity):
        client = auth_client(viewer_user)
        res = client.post(f"{BASE_RECON}/bank/run/", {"entity_id": str(entity.id)}, format="json")
        assert res.status_code == 403


@pytest.mark.django_db
class TestBankClear:
    def test_admin_can_clear_in_debug(self, auth_client, admin_user, entity, settings):
        settings.DEBUG = True
        client = auth_client(admin_user)
        res = client.post(f"{BASE_RECON}/bank/clear/", {"entity_id": str(entity.id)}, format="json")
        assert res.status_code == 200
        assert res.data["status"] == "cleared"

    def test_clear_blocked_in_production(self, auth_client, admin_user, entity, settings):
        settings.DEBUG = False
        client = auth_client(admin_user)
        res = client.post(f"{BASE_RECON}/bank/clear/", {"entity_id": str(entity.id)}, format="json")
        assert res.status_code == 403

    def test_analyst_cannot_clear(self, auth_client, analyst_user, entity, settings):
        settings.DEBUG = True
        client = auth_client(analyst_user)
        res = client.post(f"{BASE_RECON}/bank/clear/", {"entity_id": str(entity.id)}, format="json")
        assert res.status_code == 403
