import pytest
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from apps.entities.models import Entity

@pytest.mark.django_db
class TestZohoOAuthFlow:

    @pytest.fixture(autouse=True)
    def setup_data(self, auth_client, admin_user):
        self.admin_client = auth_client(admin_user)
        self.entity = Entity.objects.create(name="Test Entity", code="TE", gstin="29AAACT1234A1Z1")

    @patch.dict('os.environ', {
        'ZOHO_CLIENT_ID': 'fake_client_id',
        'ZOHO_CLIENT_SECRET': 'fake_client_secret',
        'ZOHO_REDIRECT_URI': 'http://localhost:8000/api/v1/integrations/zoho/callback/',
        'FRONTEND_URL': 'http://localhost:5173'
    })
    def test_zoho_connect_redirect(self):
        url = reverse('integrations-zoho-connect')
        res = self.admin_client.get(url, {'entity_id': self.entity.id})
        assert res.status_code == status.HTTP_302_FOUND
        assert 'accounts.zoho.in/oauth/v2/auth' in res.url
        assert 'state=' + str(self.entity.id) in res.url

    def test_zoho_connect_json(self):
        url = reverse('integrations-zoho-connect')
        res = self.admin_client.get(url, {'entity_id': self.entity.id, 'format': 'json'})
        assert res.status_code == status.HTTP_200_OK
        assert 'auth_url' in res.data
        assert 'accounts.zoho.in/oauth/v2/auth' in res.data['auth_url']
        assert 'state=' + str(self.entity.id) in res.data['auth_url']

    @patch('requests.post')
    @patch('requests.get')
    @patch.dict('os.environ', {
        'ZOHO_CLIENT_ID': 'fake_client_id',
        'ZOHO_CLIENT_SECRET': 'fake_client_secret',
        'ZOHO_REDIRECT_URI': 'http://localhost:8000/api/v1/integrations/zoho/callback/',
        'FRONTEND_URL': 'http://localhost:5173'
    })
    def test_zoho_callback_success(self, mock_get, mock_post):
        # Mock token response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'access_token': 'fake_access_token',
            'refresh_token': 'fake_refresh_token',
            'expires_in': 3600
        }
        # Mock organization response
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'organizations': [
                {'organization_id': 'fake_org_id', 'name': 'Fake Org'}
            ]
        }

        # Callback does not require authentication
        from rest_framework.test import APIClient
        anon_client = APIClient()

        url = reverse('integrations-zoho-callback')
        res = anon_client.get(url, {'code': 'auth_code_123', 'state': str(self.entity.id)})
        assert res.status_code == status.HTTP_302_FOUND
        assert 'http://localhost:5173/integrations?zoho=connected' in res.url

        self.entity.refresh_from_db()
        assert self.entity.zoho_access_token == 'fake_access_token'
        assert self.entity.zoho_refresh_token == 'fake_refresh_token'
        assert self.entity.zoho_org_id == 'fake_org_id'
        assert self.entity.zoho_token_expiry is not None

    def test_zoho_disconnect(self):
        self.entity.zoho_access_token = 'token123'
        self.entity.zoho_refresh_token = 'refresh123'
        self.entity.save()

        url = reverse('integrations-zoho-disconnect')
        res = self.admin_client.post(url, {'entity_id': self.entity.id}, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'disconnected'

        self.entity.refresh_from_db()
        assert self.entity.zoho_access_token == ''
        assert self.entity.zoho_refresh_token == ''
        assert self.entity.zoho_token_expiry is None
