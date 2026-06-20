import os
import requests
from datetime import date
from django.utils import timezone

ZOHO_API_BASE = "https://www.zohoapis.in/books/v3"

def _refresh_zoho_token(entity):
    client_id = os.getenv("ZOHO_CLIENT_ID", "").strip()
    client_secret = os.getenv("ZOHO_CLIENT_SECRET", "").strip()
    
    # Send refresh token request to Zoho
    res = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
        "refresh_token": entity.zoho_refresh_token,
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "refresh_token",
    })
    res.raise_for_status()
    data = res.json()
    entity.zoho_access_token = data["access_token"]
    entity.zoho_token_expiry = timezone.now() + timezone.timedelta(seconds=data["expires_in"])
    entity.save(update_fields=["zoho_access_token", "zoho_token_expiry"])
    return entity.zoho_access_token

def pull_zoho_bank_transactions(entity, from_date: date, to_date: date) -> list[dict]:
    if not entity.zoho_access_token or not entity.zoho_token_expiry or timezone.now() >= entity.zoho_token_expiry:
        token = _refresh_zoho_token(entity)
    else:
        token = entity.zoho_access_token

    headers = {"Authorization": f"Zoho-oauthtoken {token}"}
    
    org_id = entity.zoho_org_id
    if not org_id:
        org_id = os.getenv("ZOHO_ORG_ID", "").strip()
        
    params  = {
        "organization_id": org_id,
        "date_start": from_date.isoformat(),
        "date_end":   to_date.isoformat(),
        "per_page":   200,
    }
    res = requests.get(f"{ZOHO_API_BASE}/banktransactions", headers=headers, params=params)
    res.raise_for_status()
    txns = res.json().get("banktransactions", [])
    return [{
        "txn_date":     t.get("date"),
        "amount":       abs(float(t.get("debit_amount", 0) or t.get("credit_amount", 0))),
        "reference":    t.get("reference_number", ""),
        "counterparty": t.get("payee", ""),
        "narration":    t.get("description", ""),
    } for t in txns]
