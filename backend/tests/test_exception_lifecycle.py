"""
Integration tests for ExceptionRecord lifecycle:
  detected → routed → investigating → resolved → approved → closed
Covers: comment, resolve, approve, reject, reassign, ai_summary actions.
"""
import pytest
from django.urls import reverse


BASE = "/api/v1/exceptions"


@pytest.mark.django_db
class TestExceptionRead:
    def test_list_returns_200_for_all_roles(
        self, auth_client, exception_record,
        admin_user, manager_user, approver_user, analyst_user, viewer_user
    ):
        for user in [admin_user, manager_user, approver_user, analyst_user, viewer_user]:
            client = auth_client(user)
            res = client.get(f"{BASE}/")
            assert res.status_code == 200, f"Failed for role: {user.role}"

    def test_retrieve_returns_exception_detail(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        res = client.get(f"{BASE}/{exception_record.id}/")
        assert res.status_code == 200
        assert str(exception_record.id) in res.data["id"]

    def test_filter_by_status(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        res = client.get(f"{BASE}/?status=routed")
        assert res.status_code == 200


@pytest.mark.django_db
class TestExceptionComment:
    def test_analyst_can_comment(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        res = client.post(f"{BASE}/{exception_record.id}/comment/", {"message": "Investigating now."})
        assert res.status_code == 200

    def test_viewer_cannot_comment(self, auth_client, viewer_user, exception_record):
        client = auth_client(viewer_user)
        res = client.post(f"{BASE}/{exception_record.id}/comment/", {"message": "Trying to comment."})
        assert res.status_code == 403

    def test_comment_creates_audit_log(self, auth_client, analyst_user, exception_record):
        from apps.exceptions_app.models import AuditLog
        client = auth_client(analyst_user)
        client.post(f"{BASE}/{exception_record.id}/comment/", {"message": "Test comment"})
        assert AuditLog.objects.filter(exception=exception_record, action="commented").exists()


@pytest.mark.django_db
class TestExceptionResolve:
    def test_analyst_can_resolve(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        res = client.post(
            f"{BASE}/{exception_record.id}/resolve/",
            {"resolution_code": "manual_fix", "note": "Fixed the mismatch."}
        )
        assert res.status_code == 200
        assert res.data["status"] == "resolved"

    def test_approver_cannot_resolve(self, auth_client, approver_user, exception_record):
        client = auth_client(approver_user)
        res = client.post(f"{BASE}/{exception_record.id}/resolve/", {"resolution_code": "fix"})
        assert res.status_code == 403

    def test_viewer_cannot_resolve(self, auth_client, viewer_user, exception_record):
        client = auth_client(viewer_user)
        res = client.post(f"{BASE}/{exception_record.id}/resolve/", {})
        assert res.status_code == 403

    def test_resolve_sets_resolved_at(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        client.post(f"{BASE}/{exception_record.id}/resolve/", {"resolution_code": "fix"})
        exception_record.refresh_from_db()
        assert exception_record.resolved_at is not None


@pytest.mark.django_db
class TestExceptionApproveReject:
    def test_approver_can_approve(self, auth_client, approver_user, resolved_exception):
        client = auth_client(approver_user)
        res = client.post(f"{BASE}/{resolved_exception.id}/approve/", {"note": "Looks good."})
        assert res.status_code == 200
        assert res.data["status"] == "closed"

    def test_analyst_cannot_approve(self, auth_client, analyst_user, resolved_exception):
        client = auth_client(analyst_user)
        res = client.post(f"{BASE}/{resolved_exception.id}/approve/", {})
        assert res.status_code == 403

    def test_approver_can_reject(self, auth_client, approver_user, resolved_exception):
        client = auth_client(approver_user)
        res = client.post(f"{BASE}/{resolved_exception.id}/reject/", {"note": "Needs more info."})
        assert res.status_code == 200
        assert res.data["status"] == "investigating"

    def test_analyst_cannot_reject(self, auth_client, analyst_user, resolved_exception):
        client = auth_client(analyst_user)
        res = client.post(f"{BASE}/{resolved_exception.id}/reject/", {})
        assert res.status_code == 403

    def test_approve_creates_audit_log(self, auth_client, approver_user, resolved_exception):
        from apps.exceptions_app.models import AuditLog
        client = auth_client(approver_user)
        client.post(f"{BASE}/{resolved_exception.id}/approve/", {})
        assert AuditLog.objects.filter(exception=resolved_exception, action="approved").exists()


@pytest.mark.django_db
class TestExceptionReassign:
    def test_manager_can_reassign(
        self, auth_client, manager_user, analyst_user, exception_record
    ):
        client = auth_client(manager_user)
        res = client.post(
            f"{BASE}/{exception_record.id}/reassign/",
            {"user_id": str(analyst_user.id)}
        )
        assert res.status_code == 200
        assert str(res.data["assigned_to"]["id"]) == str(analyst_user.id)

    def test_analyst_cannot_reassign(self, auth_client, analyst_user, exception_record):
        client = auth_client(analyst_user)
        res = client.post(
            f"{BASE}/{exception_record.id}/reassign/",
            {"user_id": str(analyst_user.id)}
        )
        assert res.status_code == 403

    def test_reassign_nonexistent_user_returns_400(
        self, auth_client, manager_user, exception_record
    ):
        client = auth_client(manager_user)
        res = client.post(
            f"{BASE}/{exception_record.id}/reassign/",
            {"user_id": "00000000-0000-0000-0000-000000000000"}
        )
        assert res.status_code == 400
