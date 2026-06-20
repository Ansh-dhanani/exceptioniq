"""
Tests for /api/v1/auth/me/ endpoint.
Verifies correct role and user info is returned per user.
"""
import pytest

ME_URL = "/api/v1/auth/me/"


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_returns_correct_role_analyst(self, auth_client, analyst_user):
        client = auth_client(analyst_user)
        res = client.get(ME_URL)
        assert res.status_code == 200
        assert res.data["role"] == "analyst"
        assert res.data["username"] == "analyst_u"

    def test_me_returns_correct_role_approver(self, auth_client, approver_user):
        client = auth_client(approver_user)
        res = client.get(ME_URL)
        assert res.status_code == 200
        assert res.data["role"] == "approver"

    def test_me_returns_correct_role_admin(self, auth_client, admin_user):
        client = auth_client(admin_user)
        res = client.get(ME_URL)
        assert res.status_code == 200
        assert res.data["role"] == "admin"

    def test_me_returns_id_username_email(self, auth_client, admin_user):
        client = auth_client(admin_user)
        res = client.get(ME_URL)
        assert "id" in res.data
        assert "username" in res.data
        assert "email" in res.data
        assert "role" in res.data

    def test_me_unauthenticated_returns_403(self, api_client):
        res = api_client.get(ME_URL)
        assert res.status_code in [401, 403]
