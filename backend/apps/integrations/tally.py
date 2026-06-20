"""
Tally exposes a local SOAP/HTTP server on port 9000.
We send a TDL XML request to pull ledger vouchers for a date range.
"""
import requests
from datetime import date
import xml.etree.ElementTree as ET

TALLY_XML = """
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Ledger Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVFROMDATE>{from_date}</SVFROMDATE>
          <SVTODATE>{to_date}</SVTODATE>
          <SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
"""

def pull_tally_ledger(entity, from_date: date, to_date: date, tally_host: str = "localhost:9000"):
    xml = TALLY_XML.format(
        from_date=from_date.strftime("%Y%m%d"),
        to_date=to_date.strftime("%Y%m%d"),
        company=entity.tally_company_name or "",
    )
    try:
        res = requests.post(f"http://{tally_host}", data=xml,
                            headers={"Content-Type": "application/xml"}, timeout=10)
        res.raise_for_status()
        return _parse_tally_xml(res.text)
    except requests.RequestException as e:
        raise ConnectionError(f"Tally unreachable at {tally_host}: {e}")

def _parse_tally_xml(xml_text: str) -> list[dict]:
    """Parse TallyPrime XML voucher export into list of ledger row dicts."""
    try:
        root = ET.fromstring(xml_text.strip())
    except Exception as e:
        raise ValueError(f"Failed to parse Tally XML response: {e}")
    rows = []
    # Try iterating through either VOUCHER or ENVELOPE > BODY > DATA > COLLECTION > VOUCHER
    # Let's inspect all tags
    vouchers = root.findall(".//VOUCHER")
    for voucher in vouchers:
        date_el   = voucher.find("DATE")
        amount_el = voucher.find("AMOUNT")
        ref_el    = voucher.find("VOUCHERNUMBER")
        party_el  = voucher.find("PARTYLEDGERNAME")
        
        # Date and amount are crucial, but let's fall back gracefully if missing
        if date_el is None or amount_el is None:
            continue
            
        # Parse amount (Tally sometimes wraps debit/credit signs or has comma)
        amt_str = amount_el.text or "0"
        try:
            amt_val = abs(float(amt_str.replace(',', '').strip()))
        except ValueError:
            amt_val = 0.0

        # Parse date from YYYYMMDD to YYYY-MM-DD
        dt_str = date_el.text or ""
        if len(dt_str) == 8:
            dt_str = f"{dt_str[:4]}-{dt_str[4:6]}-{dt_str[6:]}"

        rows.append({
            "txn_date":    dt_str,
            "amount":      amt_val,
            "reference":   ref_el.text if ref_el is not None else "",
            "counterparty":party_el.text if party_el is not None else "",
            "account_type":"bank",
        })
    return rows
