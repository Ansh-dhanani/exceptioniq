from django.utils import timezone
from datetime import date
import calendar
from apps.close.models import MonthEndPeriod, CloseChecklistItem

DEFAULT_CHECKLIST = [
    {"title": "Bank Reconciliation — Upload & Run",       "category": "bank",   "is_critical": True,  "linked_url": "/ingestion"},
    {"title": "Bank Recon — All exceptions resolved",     "category": "bank",   "is_critical": True,  "linked_url": "/exceptions?reconciliation_type=bank"},
    {"title": "GSTR-2B Upload for the period",            "category": "gst",    "is_critical": True,  "linked_url": "/gst"},
    {"title": "GST Reconciliation — Run & review ITC",    "category": "gst",    "is_critical": True,  "linked_url": "/gst"},
    {"title": "GST exceptions resolved before 3B filing", "category": "gst",    "is_critical": True,  "linked_url": "/exceptions?reconciliation_type=gst"},
    {"title": "Form 26AS upload & TDS recon run",         "category": "tds",    "is_critical": False, "linked_url": "/tds"},
    {"title": "TDS exceptions reviewed",                  "category": "tds",    "is_critical": False, "linked_url": "/exceptions?reconciliation_type=tds"},
    {"title": "High-risk vendor payments reviewed",       "category": "vendor", "is_critical": False, "linked_url": "/vendors"},
    {"title": "Payroll posted to ledger",                 "category": "payroll","is_critical": False, "linked_url": ""},
    {"title": "Management MIS report generated",          "category": "other",  "is_critical": False, "linked_url": "/exceptions/export-pdf-report"},
]

def generate_close_period(entity, period: str):
    # Check if already exists
    month_end, created = MonthEndPeriod.objects.get_or_create(
        entity=entity,
        period=period,
        defaults={'status': 'open'}
    )
    if not created:
        return month_end

    year, month = map(int, period.split('-'))
    _, last_day = calendar.monthrange(year, month)
    due = date(year, month, last_day)

    for item_def in DEFAULT_CHECKLIST:
        CloseChecklistItem.objects.create(
            period=month_end, due_date=due, **item_def
        )
    return month_end
