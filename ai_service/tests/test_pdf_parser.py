"""
Unit tests for the PDF bank statement parser logic in ai_service/main.py.
Tests _parse_amount(), _extract_rows(), and the /parse-bank-pdf endpoint.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import _parse_amount, _extract_rows, ParsedRow
from fastapi.testclient import TestClient
from main import app
import io

client = TestClient(app)


class TestParseAmount:
    def test_dr_suffix_returns_debit(self):
        amount, dc = _parse_amount("1,500.00Dr")
        assert amount == 1500.00
        assert dc == "debit"

    def test_cr_suffix_returns_credit(self):
        amount, dc = _parse_amount("2,300.50Cr")
        assert amount == 2300.50
        assert dc == "credit"

    def test_lowercase_dr(self):
        amount, dc = _parse_amount("500.00dr")
        assert dc == "debit"

    def test_lowercase_cr(self):
        amount, dc = _parse_amount("750.00cr")
        assert dc == "credit"

    def test_plain_number_defaults_credit(self):
        amount, dc = _parse_amount("1000.00")
        assert amount == 1000.00
        assert dc == "credit"

    def test_commas_removed_correctly(self):
        amount, dc = _parse_amount("1,00,000.00Cr")
        assert amount == 100000.00

    def test_invalid_string_returns_zero_unknown(self):
        amount, dc = _parse_amount("N/A")
        assert amount == 0.0
        assert dc == "unknown"


class TestExtractRows:
    def test_hdfc_style_line(self):
        text = "10/01/2024  Payment to Vendor A  REF001  10,000.00Dr  90,000.00"
        rows = _extract_rows(text)
        assert len(rows) == 1
        assert rows[0].txn_date == "10/01/2024"
        assert rows[0].debit_credit == "debit"
        assert rows[0].amount == 10000.00
        assert rows[0].needs_review is False

    def test_sbi_style_line(self):
        text = "15-Jan-2024  NEFT Transfer  INB12345  5,000.00Cr  45,000.00"
        rows = _extract_rows(text)
        assert len(rows) == 1
        assert rows[0].debit_credit == "credit"

    def test_line_without_date_skipped(self):
        text = "This line has no date but has 1,000.00 amount"
        rows = _extract_rows(text)
        assert len(rows) == 0

    def test_line_without_amount_skipped(self):
        text = "10/01/2024  This line has no amount"
        rows = _extract_rows(text)
        assert len(rows) == 0

    def test_short_line_skipped(self):
        rows = _extract_rows("short")
        assert len(rows) == 0

    def test_needs_review_flagged_for_zero_amount(self):
        text = "10/01/2024  Payment  N/A  0.00  0.00"
        rows = _extract_rows(text)
        # zero amount → needs_review
        if rows:
            assert rows[0].needs_review is True

    def test_multiple_lines_parsed(self):
        text = (
            "10/01/2024  NEFT Credit  REF001  10,000.00Cr  1,10,000.00\n"
            "12/01/2024  ATM Withdrawal  REF002  2,000.00Dr  1,08,000.00\n"
            "15/01/2024  UPI Transfer  REF003  500.00Dr  1,07,500.00\n"
        )
        rows = _extract_rows(text)
        assert len(rows) == 3

    def test_narration_extracted(self):
        text = "10/01/2024  NEFT Payment to ABC Corp  REF001  5,000.00Dr  50,000.00"
        rows = _extract_rows(text)
        assert len(rows) == 1
        assert "NEFT" in rows[0].narration or "ABC" in rows[0].narration


class TestParseBankPdfEndpoint:
    def test_health_endpoint(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_parse_bank_pdf_invalid_file_returns_error(self):
        fake_pdf = io.BytesIO(b"not a real pdf")
        res = client.post(
            "/parse-bank-pdf",
            files={"file": ("bank.pdf", fake_pdf, "application/pdf")}
        )
        # fitz will raise on invalid PDF — expect 400, 422, or 500
        assert res.status_code in [400, 422, 500]

    def test_parse_bank_pdf_returns_expected_keys(self, tmp_path):
        """Creates a minimal valid PDF with transaction-like text and tests the response shape."""
        try:
            import fitz
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 100), "10/01/2024  Payment  REF001  5,000.00Dr  95,000.00")
            pdf_bytes = doc.tobytes()
            doc.close()

            res = client.post(
                "/parse-bank-pdf",
                files={"file": ("bank.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
            )
            assert res.status_code == 200
            data = res.json()
            assert "rows" in data
            assert "total" in data
            assert "unparsed_count" in data
        except ImportError:
            pytest.skip("PyMuPDF not installed in test environment")


class TestSummarizeException:
    def test_summarize_bank_amt_fallback(self):
        payload = {
            "markdown": "Exception Code: BANK-AMT\nAmount Difference: 500.00\nDate Difference: 0"
        }
        res = client.post("/summarize-exception", json=payload)
        assert res.status_code == 200
        assert "summary" in res.json()
        assert "mismatch" in res.json()["summary"].lower() or "amount" in res.json()["summary"].lower()

    def test_summarize_bank_miss_ledger_fallback(self):
        payload = {
            "markdown": "Exception Code: BANK-MISS-LEDGER\nAmount Difference: 1200.00"
        }
        res = client.post("/summarize-exception", json=payload)
        assert res.status_code == 200
        assert "ledger" in res.json()["summary"].lower()

    def test_summarize_bank_date_fallback(self):
        payload = {
            "markdown": "Exception Code: BANK-DATE\nDate Difference: 5"
        }
        res = client.post("/summarize-exception", json=payload)
        assert res.status_code == 200
        assert "date" in res.json()["summary"].lower()

    def test_classify_amount_diff(self):
        payload = {
            "ledger_amount": 1000.0, "bank_amount": 1500.0,
            "ledger_date": "2024-01-10", "bank_date": "2024-01-10"
        }
        res = client.post("/classify-exception", json=payload)
        assert res.status_code == 200
        assert res.json()["code"] == "BANK-AMT"

    def test_classify_date_diff(self):
        payload = {
            "ledger_amount": 1000.0, "bank_amount": 1000.0,
            "ledger_date": "2024-01-10", "bank_date": "2024-01-12"
        }
        res = client.post("/classify-exception", json=payload)
        assert res.status_code == 200
        assert res.json()["code"] == "BANK-DATE"
