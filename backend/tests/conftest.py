import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.entities.models import Entity
from apps.exceptions_app.models import ExceptionRecord, ExceptionComment, AuditLog
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from decimal import Decimal
from django.utils import timezone

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def entity(db):
    return Entity.objects.create(name="Acme Corp", code="ACME")


@pytest.fixture
def make_user(db):
    def _make(username, role):
        return User.objects.create_user(
            username=username, password="testpass123", role=role
        )
    return _make


@pytest.fixture
def admin_user(make_user):    return make_user("admin_u",    "admin")
@pytest.fixture
def manager_user(make_user):  return make_user("manager_u",  "manager")
@pytest.fixture
def approver_user(make_user): return make_user("approver_u", "approver")
@pytest.fixture
def analyst_user(make_user):  return make_user("analyst_u",  "analyst")
@pytest.fixture
def viewer_user(make_user):   return make_user("viewer_u",   "viewer")


@pytest.fixture
def auth_client(api_client):
    def _auth(user):
        api_client.force_authenticate(user=user)
        return api_client
    return _auth


@pytest.fixture
def exception_record(db, entity, analyst_user):
    return ExceptionRecord.objects.create(
        entity=entity,
        reconciliation_type="bank",
        exception_code="BANK-AMT",
        severity="high",
        status="routed",
        amount_difference=Decimal("500.00"),
        date_difference=0,
        assigned_to=analyst_user,
        sla_deadline=timezone.now() + timezone.timedelta(hours=24),
    )


@pytest.fixture
def resolved_exception(db, entity, analyst_user):
    return ExceptionRecord.objects.create(
        entity=entity,
        reconciliation_type="bank",
        exception_code="BANK-MISS-LEDGER",
        severity="medium",
        status="resolved",
        amount_difference=Decimal("1200.00"),
        assigned_to=analyst_user,
    )
