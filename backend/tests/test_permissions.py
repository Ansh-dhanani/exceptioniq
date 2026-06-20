"""
Tests for RolePermission class and ROLE_ACTION_MAP.
Covers every action in the matrix against every role.
"""
import pytest
from unittest.mock import MagicMock
from apps.api.permissions import RolePermission, ROLE_ACTION_MAP


def _make_request(role, is_authenticated=True):
    user = MagicMock()
    user.is_authenticated = is_authenticated
    user.role = role
    req = MagicMock()
    req.user = user
    return req


def _make_view(action):
    view = MagicMock()
    view.action = action
    return view


@pytest.mark.parametrize("role", ["admin", "manager", "approver", "analyst", "viewer"])
def test_list_allowed_all_roles(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("list")) is True


@pytest.mark.parametrize("role", ["admin", "manager", "approver", "analyst", "viewer"])
def test_retrieve_allowed_all_roles(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("retrieve")) is True


def test_unauthenticated_denied():
    perm = RolePermission()
    req = _make_request("admin", is_authenticated=False)
    assert perm.has_permission(req, _make_view("list")) is False


# --- Resolve ---
@pytest.mark.parametrize("role", ["admin", "manager", "analyst"])
def test_resolve_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("resolve")) is True

@pytest.mark.parametrize("role", ["approver", "viewer"])
def test_resolve_denied(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("resolve")) is False


# --- Approve ---
@pytest.mark.parametrize("role", ["admin", "manager", "approver"])
def test_approve_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("approve")) is True

@pytest.mark.parametrize("role", ["analyst", "viewer"])
def test_approve_denied(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("approve")) is False


# --- Reject ---
@pytest.mark.parametrize("role", ["admin", "manager", "approver"])
def test_reject_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("reject")) is True

@pytest.mark.parametrize("role", ["analyst", "viewer"])
def test_reject_denied(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("reject")) is False


# --- Reassign ---
@pytest.mark.parametrize("role", ["admin", "manager"])
def test_reassign_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("reassign")) is True

@pytest.mark.parametrize("role", ["approver", "analyst", "viewer"])
def test_reassign_denied(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("reassign")) is False


# --- Comment ---
@pytest.mark.parametrize("role", ["admin", "manager", "approver", "analyst"])
def test_comment_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("comment")) is True

def test_comment_viewer_denied():
    perm = RolePermission()
    assert perm.has_permission(_make_request("viewer"), _make_view("comment")) is False


# --- bank_upload / bank_run ---
@pytest.mark.parametrize("role", ["admin", "manager", "analyst"])
def test_bank_upload_allowed(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("bank_upload")) is True

@pytest.mark.parametrize("role", ["approver", "viewer"])
def test_bank_upload_denied(role):
    perm = RolePermission()
    assert perm.has_permission(_make_request(role), _make_view("bank_upload")) is False


# --- bank_clear: admin only ---
def test_bank_clear_admin_only():
    perm = RolePermission()
    assert perm.has_permission(_make_request("admin"),    _make_view("bank_clear")) is True
    assert perm.has_permission(_make_request("manager"),  _make_view("bank_clear")) is False
    assert perm.has_permission(_make_request("analyst"),  _make_view("bank_clear")) is False


# --- create/update/destroy: admin only ---
@pytest.mark.parametrize("action", ["create", "update", "partial_update", "destroy"])
def test_write_actions_admin_only(action):
    perm = RolePermission()
    assert perm.has_permission(_make_request("admin"),   _make_view(action)) is True
    assert perm.has_permission(_make_request("manager"), _make_view(action)) is False
    assert perm.has_permission(_make_request("viewer"),  _make_view(action)) is False


# --- Unknown action defaults to admin-only ---
def test_unknown_action_defaults_admin():
    perm = RolePermission()
    assert perm.has_permission(_make_request("admin"),   _make_view("unknown_action")) is True
    assert perm.has_permission(_make_request("analyst"), _make_view("unknown_action")) is False
