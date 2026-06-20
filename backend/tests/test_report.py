import pytest

REPORT_URL = "/api/v1/exceptions/export-pdf-report/"


@pytest.mark.django_db
class TestExecutiveReport:
    def test_manager_can_download_pdf_report(self, auth_client, manager_user, exception_record, resolved_exception):
        client = auth_client(manager_user)
        res = client.get(REPORT_URL)
        assert res.status_code == 200
        assert res["Content-Type"] == "application/pdf"
        assert b"%PDF" in res.content

    def test_admin_can_download_pdf_report(self, auth_client, admin_user, exception_record):
        client = auth_client(admin_user)
        res = client.get(REPORT_URL)
        assert res.status_code == 200
        assert res["Content-Type"] == "application/pdf"
        assert b"%PDF" in res.content

    def test_analyst_cannot_download_pdf_report(self, auth_client, analyst_user):
        client = auth_client(analyst_user)
        res = client.get(REPORT_URL)
        assert res.status_code == 403

    def test_viewer_cannot_download_pdf_report(self, auth_client, viewer_user):
        client = auth_client(viewer_user)
        res = client.get(REPORT_URL)
        assert res.status_code == 403

    def test_unauthenticated_cannot_download_pdf_report(self, api_client):
        res = api_client.get(REPORT_URL)
        assert res.status_code in [401, 403]
