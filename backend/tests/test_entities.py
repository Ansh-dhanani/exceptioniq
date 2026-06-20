"""
Tests for Entity CRUD — admin-only write, all roles can read.
"""
import pytest

BASE = "/api/v1/entities"


@pytest.mark.django_db
class TestEntityPermissions:
    def test_admin_can_create_entity(self, auth_client, admin_user):
        client = auth_client(admin_user)
        res = client.post(f"{BASE}/", {"name": "New Corp", "code": "NC01"}, format="json")
        assert res.status_code == 201

    def test_manager_cannot_create_entity(self, auth_client, manager_user):
        client = auth_client(manager_user)
        res = client.post(f"{BASE}/", {"name": "New Corp", "code": "NC02"}, format="json")
        assert res.status_code == 403

    def test_analyst_cannot_delete_entity(self, auth_client, analyst_user, entity):
        client = auth_client(analyst_user)
        res = client.delete(f"{BASE}/{entity.id}/")
        assert res.status_code == 403

    def test_all_roles_can_list_entities(
        self, auth_client, admin_user, analyst_user, viewer_user
    ):
        for user in [admin_user, analyst_user, viewer_user]:
            res = auth_client(user).get(f"{BASE}/")
            assert res.status_code == 200
