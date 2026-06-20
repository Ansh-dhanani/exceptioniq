"""
Tests for RoutingRule CRUD — admin-only write, all roles can read.
"""
import pytest

BASE = "/api/v1/routing-rules"


@pytest.mark.django_db
class TestRoutingRulePermissions:
    RULE_PAYLOAD = {
        "reconciliation_type": "bank",
        "exception_code": "BANK-AMT",
        "min_amount": "1000.00",
        "max_amount": None,
        "assign_to_role": "approver",
        "sla_hours": 24,
        "priority": "high",
        "active": True,
    }

    def test_admin_can_create_rule(self, auth_client, admin_user, entity):
        self.RULE_PAYLOAD["entity"] = str(entity.id)
        client = auth_client(admin_user)
        res = client.post(f"{BASE}/", self.RULE_PAYLOAD, format="json")
        assert res.status_code == 201

    def test_manager_cannot_create_rule(self, auth_client, manager_user, entity):
        payload = {**self.RULE_PAYLOAD, "entity": str(entity.id)}
        client = auth_client(manager_user)
        res = client.post(f"{BASE}/", payload, format="json")
        assert res.status_code == 403

    def test_analyst_cannot_create_rule(self, auth_client, analyst_user, entity):
        payload = {**self.RULE_PAYLOAD, "entity": str(entity.id)}
        client = auth_client(analyst_user)
        res = client.post(f"{BASE}/", payload, format="json")
        assert res.status_code == 403

    def test_all_roles_can_list_rules(
        self, auth_client, admin_user, manager_user, approver_user, analyst_user, viewer_user
    ):
        for user in [admin_user, manager_user, approver_user, analyst_user, viewer_user]:
            res = auth_client(user).get(f"{BASE}/")
            assert res.status_code == 200, f"Failed for {user.role}"
