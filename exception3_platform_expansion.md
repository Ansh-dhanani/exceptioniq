# ExceptionIQ — Phase 3 Implementation Spec
# Modules 2, 3, 5, 6, 7: GST Recon · TDS Recon · Vendor Risk · Month-End Close · Tally/Zoho Sync

> **Document:** `docs/exception3_platform_expansion.md`
> **Version:** 1.0
> **Status:** Implementation Ready
> **Builds on:** `exception2_rbac_pdf_ingestion.md`
> **Repo:** https://github.com/mananjp/exceptioniq

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module 2 — GST GSTR-2B Reconciliation](#2-module-2--gst-gstr-2b-reconciliation)
3. [Module 3 — TDS 26AS Reconciliation](#3-module-3--tds-26as-reconciliation)
4. [Module 5 — Vendor Risk Ledger](#5-module-5--vendor-risk-ledger)
5. [Module 6 — Month-End Close Checklist](#6-module-6--month-end-close-checklist)
6. [Module 7 — Tally / Zoho Books Sync](#7-module-7--tally--zoho-books-sync)
7. [Shared: New Django Apps & Migrations](#8-shared-new-django-apps--migrations)
8. [Shared: API URL Registration](#9-shared-api-url-registration)
9. [Shared: RBAC Extensions](#10-shared-rbac-extensions)
10. [Frontend Route & Nav Changes](#11-frontend-route--nav-changes)
11. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Architecture Overview

### What this phase adds

```
ExceptionIQ (after Phase 3)
├── Bank Reconciliation          ← already exists
├── Module 2: GST Recon          ← NEW  apps/gst/
├── Module 3: TDS Recon          ← NEW  apps/tds/
├── Module 5: Vendor Risk        ← NEW  apps/vendors/
├── Module 6: Month-End Close    ← NEW  apps/close/
└── Module 7: ERP Sync           ← NEW  apps/integrations/
```

### New Django apps to create

```bash
cd backend
python manage.py startapp gst         # → apps/gst/
python manage.py startapp tds         # → apps/tds/
python manage.py startapp vendors     # → apps/vendors/
python manage.py startapp close       # → apps/close/
python manage.py startapp integrations # → apps/integrations/
```

Add all 5 to `INSTALLED_APPS` in `config/settings.py`:
```python
INSTALLED_APPS = [
    ...
    'apps.gst',
    'apps.tds',
    'apps.vendors',
    'apps.close',
    'apps.integrations',
]
```

### Entity model extension

Add `gstin` (already exists) and `tally_company_name` to `apps/entities/models.py`:

```python
class Entity(TimeStampedModel):
    name                = models.CharField(max_length=255)
    code                = models.CharField(max_length=50, unique=True)
    gstin               = models.CharField(max_length=20, blank=True)   # already exists
    currency            = models.CharField(max_length=10, default='INR') # already exists
    tally_company_name  = models.CharField(max_length=255, blank=True)
    zoho_org_id         = models.CharField(max_length=100, blank=True)
    zoho_access_token   = models.TextField(blank=True)
    zoho_refresh_token  = models.TextField(blank=True)
    zoho_token_expiry   = models.DateTimeField(null=True, blank=True)
```

---

## 2. Module 2 — GST GSTR-2B Reconciliation

### 2.1 What it does

Ingests GSTR-2B JSON (downloaded from GST portal) and a Purchase Register
(CSV from Tally/Zoho Books) for the same tax period. Matches invoices by
**GSTIN + invoice number + tax period**, surfaces ITC mismatches as
`ExceptionRecord` rows with `reconciliation_type = "gst"`.

### 2.2 GSTR-2B JSON structure (govt format)

```json
{
  "data": {
    "docdata": {
      "b2b": [
        {
          "ctin": "29ABCDE1234F1ZA",
          "inv": [
            {
              "inum": "INV-2024-001",
              "idt":  "10-01-2024",
              "val":  11800.00,
              "itms": [{ "itm_det": { "txval": 10000.00, "igst": 1800.00, "cgst": 0, "sgst": 0 } }]
            }
          ]
        }
      ]
    }
  }
}
```

### 2.3 Models — `apps/gst/models.py`

```python
from django.db import models
from apps.common.models import TimeStampedModel
from apps.entities.models import Entity

class GSTR2BRecord(TimeStampedModel):
    """A single invoice row parsed from GSTR-2B JSON."""
    entity          = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='gstr2b_records')
    tax_period      = models.CharField(max_length=7)          # "2024-01"
    supplier_gstin  = models.CharField(max_length=20)
    invoice_number  = models.CharField(max_length=100)
    invoice_date    = models.DateField()
    taxable_value   = models.DecimalField(max_digits=15, decimal_places=2)
    igst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cgst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    sgst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tax       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    raw_data        = models.JSONField(default=dict)

    class Meta:
        unique_together = ('entity', 'tax_period', 'supplier_gstin', 'invoice_number')


class PurchaseRegisterEntry(TimeStampedModel):
    """A single row from the company's internal purchase register."""
    entity          = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='purchase_entries')
    tax_period      = models.CharField(max_length=7)
    supplier_gstin  = models.CharField(max_length=20)
    invoice_number  = models.CharField(max_length=100)
    invoice_date    = models.DateField(null=True, blank=True)
    taxable_value   = models.DecimalField(max_digits=15, decimal_places=2)
    igst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cgst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    sgst            = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tax       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    raw_data        = models.JSONField(default=dict)

    class Meta:
        unique_together = ('entity', 'tax_period', 'supplier_gstin', 'invoice_number')


class GSTReconciliationRun(TimeStampedModel):
    """Tracks each reconciliation run per entity per tax period."""
    STATUS_CHOICES = [('pending','Pending'),('running','Running'),('completed','Completed'),('failed','Failed')]
    entity          = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='gst_runs')
    tax_period      = models.CharField(max_length=7)          # "2024-01"
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_gstr2b    = models.PositiveIntegerField(default=0)
    total_purchase  = models.PositiveIntegerField(default=0)
    matched         = models.PositiveIntegerField(default=0)
    exceptions      = models.PositiveIntegerField(default=0)
    itc_at_risk     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    completed_at    = models.DateTimeField(null=True, blank=True)
```

### 2.4 GST Exception Codes

| Code | Meaning |
|---|---|
| `GST-MISS-PR` | Invoice in GSTR-2B but NOT in Purchase Register — ITC available but unclaimed |
| `GST-MISS-GSTR` | Invoice in Purchase Register but NOT in GSTR-2B — ITC claimed but supplier hasn't filed |
| `GST-AMT` | Invoice matched (GSTIN + number) but tax amounts differ |
| `GST-DATE` | Invoice matched but date differs by > 5 days |

### 2.5 Reconciliation service — `apps/gst/services.py`

```python
from decimal import Decimal
from django.utils import timezone
from apps.gst.models import GSTR2BRecord, PurchaseRegisterEntry, GSTReconciliationRun
from apps.exceptions_app.models import ExceptionRecord, AuditLog
from apps.routing.models import RoutingRule


def run_gst_reconciliation(entity, tax_period: str) -> GSTReconciliationRun:
    run = GSTReconciliationRun.objects.create(entity=entity, tax_period=tax_period, status='running')

    gstr2b_qs = GSTR2BRecord.objects.filter(entity=entity, tax_period=tax_period)
    pr_qs     = PurchaseRegisterEntry.objects.filter(entity=entity, tax_period=tax_period)

    gstr2b_map = {(r.supplier_gstin, r.invoice_number.upper()): r for r in gstr2b_qs}
    pr_map     = {(r.supplier_gstin, r.invoice_number.upper()): r for r in pr_qs}

    run.total_gstr2b   = len(gstr2b_map)
    run.total_purchase = len(pr_map)

    created = []
    itc_risk = Decimal("0")

    all_keys = set(gstr2b_map) | set(pr_map)

    for key in all_keys:
        g = gstr2b_map.get(key)
        p = pr_map.get(key)

        if g and not p:
            # ITC available in GSTR-2B but not booked in Purchase Register
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='gst',
                exception_code='GST-MISS-PR', severity='high', status='detected',
                amount_difference=g.total_tax,
                context={'supplier_gstin': g.supplier_gstin, 'invoice_number': g.invoice_number,
                         'tax_period': tax_period, 'itc_at_risk': str(g.total_tax)},
            )
            itc_risk += g.total_tax
            created.append(exc)

        elif p and not g:
            # ITC claimed in Purchase Register but supplier hasn't filed GSTR-2B
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='gst',
                exception_code='GST-MISS-GSTR', severity='critical', status='detected',
                amount_difference=p.total_tax,
                context={'supplier_gstin': p.supplier_gstin, 'invoice_number': p.invoice_number,
                         'tax_period': tax_period, 'itc_at_risk': str(p.total_tax)},
            )
            itc_risk += p.total_tax
            created.append(exc)

        elif g and p:
            tax_diff = abs(g.total_tax - p.total_tax)
            date_diff = abs((g.invoice_date - p.invoice_date).days) if p.invoice_date else 0

            if tax_diff > Decimal("1.00"):
                exc = ExceptionRecord.objects.create(
                    entity=entity, reconciliation_type='gst',
                    exception_code='GST-AMT', severity='medium', status='detected',
                    amount_difference=tax_diff,
                    context={'supplier_gstin': g.supplier_gstin, 'invoice_number': g.invoice_number,
                             'gstr2b_tax': str(g.total_tax), 'pr_tax': str(p.total_tax)},
                )
                created.append(exc)
            elif date_diff > 5:
                exc = ExceptionRecord.objects.create(
                    entity=entity, reconciliation_type='gst',
                    exception_code='GST-DATE', severity='low', status='detected',
                    date_difference=date_diff,
                    context={'supplier_gstin': g.supplier_gstin, 'invoice_number': g.invoice_number,
                             'gstr2b_date': str(g.invoice_date), 'pr_date': str(p.invoice_date)},
                )
                created.append(exc)
            else:
                run.matched += 1

    run.exceptions  = len(created)
    run.itc_at_risk = itc_risk
    run.status      = 'completed'
    run.completed_at = timezone.now()
    run.save()
    return run
```

### 2.6 AI Service: GSTR-2B JSON parser — add to `ai_service/main.py`

```python
@app.post('/parse-gstr2b')
async def parse_gstr2b(file: UploadFile = File(...)):
    """
    Accepts GSTR-2B JSON file (downloaded from GST portal).
    Returns a flat list of invoice rows ready for DB insert.
    """
    try:
        content = await file.read()
        data = json.loads(content)
        b2b_suppliers = data.get('data', {}).get('docdata', {}).get('b2b', [])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GSTR-2B JSON: {str(e)}")

    rows = []
    for supplier in b2b_suppliers:
        ctin = supplier.get('ctin', '')
        for inv in supplier.get('inv', []):
            itms = inv.get('itms', [{}])
            itm  = itms[0].get('itm_det', {}) if itms else {}
            rows.append({
                'supplier_gstin': ctin,
                'invoice_number': inv.get('inum', ''),
                'invoice_date':   inv.get('idt', ''),
                'taxable_value':  itm.get('txval', 0),
                'igst':           itm.get('igst', 0),
                'cgst':           itm.get('cgst', 0),
                'sgst':           itm.get('sgst', 0),
                'total_tax':      round(itm.get('igst', 0) + itm.get('cgst', 0) + itm.get('sgst', 0), 2),
            })
    return {'rows': rows, 'total': len(rows)}
```

### 2.7 Backend endpoints — new `GSTViewSet` actions

| Method | URL | Permission | Action |
|---|---|---|---|
| POST | `/api/v1/gst/upload-gstr2b/` | admin, manager, analyst | Upload GSTR-2B JSON rows |
| POST | `/api/v1/gst/upload-purchase-register/` | admin, manager, analyst | Upload Purchase Register CSV |
| POST | `/api/v1/gst/run/` | admin, manager, analyst | Run GST reconciliation |
| GET  | `/api/v1/gst/runs/` | all roles | List past runs |
| GET  | `/api/v1/gst/summary/?entity_id=&tax_period=` | all roles | ITC at risk summary |

### 2.8 Frontend pages

- **`/gst`** — GST Reconciliation hub
  - Tax period selector (month/year)
  - Upload GSTR-2B JSON (drag & drop, calls `/parse-gstr2b` for preview)
  - Upload Purchase Register CSV
  - "Run Reconciliation" button
  - Results: matched count, ITC at risk in ₹ (red banner), exception table
- **`/exceptions?reconciliation_type=gst`** — filters existing exception list

---

## 3. Module 3 — TDS 26AS Reconciliation

### 3.1 What it does

Matches Form 26AS (downloadable from IT portal as text/CSV) against the
company's TDS ledger (exported from Tally). Flags deduction mismatches,
wrong rates, and deposits not reflected. Each mismatch → `ExceptionRecord`
with `reconciliation_type = "tds"`.

### 3.2 Models — `apps/tds/models.py`

```python
from django.db import models
from apps.common.models import TimeStampedModel
from apps.entities.models import Entity

class Form26ASEntry(TimeStampedModel):
    """One row from Form 26AS — what the IT dept says was deducted."""
    entity           = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='form26as_entries')
    financial_year   = models.CharField(max_length=9)         # "2024-2025"
    quarter          = models.CharField(max_length=2)         # "Q1" "Q2" "Q3" "Q4"
    deductor_pan     = models.CharField(max_length=10)
    deductor_name    = models.CharField(max_length=255, blank=True)
    transaction_date = models.DateField(null=True, blank=True)
    gross_amount     = models.DecimalField(max_digits=15, decimal_places=2)
    tds_amount       = models.DecimalField(max_digits=15, decimal_places=2)
    tds_rate         = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    section_code     = models.CharField(max_length=20, blank=True) # "194C" "194J" etc
    raw_data         = models.JSONField(default=dict)


class TDSLedgerEntry(TimeStampedModel):
    """One row from the company's TDS ledger (Tally export)."""
    entity           = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='tds_ledger_entries')
    financial_year   = models.CharField(max_length=9)
    quarter          = models.CharField(max_length=2)
    deductor_pan     = models.CharField(max_length=10)
    deductor_name    = models.CharField(max_length=255, blank=True)
    transaction_date = models.DateField(null=True, blank=True)
    gross_amount     = models.DecimalField(max_digits=15, decimal_places=2)
    tds_amount       = models.DecimalField(max_digits=15, decimal_places=2)
    tds_rate         = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    section_code     = models.CharField(max_length=20, blank=True)
    raw_data         = models.JSONField(default=dict)
```

### 3.3 TDS Exception Codes

| Code | Meaning | Severity |
|---|---|---|
| `TDS-MISS-LEDGER` | In 26AS but not in TDS ledger | high |
| `TDS-MISS-26AS` | In TDS ledger but not in 26AS (not deposited by deductor) | critical |
| `TDS-AMT` | Matched by PAN+quarter but TDS amounts differ | medium |
| `TDS-RATE` | TDS rate applied differs from expected for section code | medium |

### 3.4 Expected TDS Rates — `apps/tds/constants.py`

```python
SECTION_TDS_RATES = {
    "192":  None,   # salary — variable
    "194A": 10.0,   # interest (non-bank)
    "194B": 30.0,   # lottery / prize
    "194C":  1.0,   # contractor (individual) / 2.0 (company)
    "194D":  5.0,   # insurance commission
    "194G":  5.0,   # commission on sale of lottery tickets
    "194H":  5.0,   # commission / brokerage
    "194I": 10.0,   # rent (plant/machinery 2%, land/building 10%)
    "194J": 10.0,   # professional / technical fees
    "194Q":  0.1,   # purchase of goods
    "195":  None,   # payments to non-residents — varies by DTAA
}
```

### 3.5 Backend endpoints — `TDSViewSet`

| Method | URL | Permission | Action |
|---|---|---|---|
| POST | `/api/v1/tds/upload-26as/` | admin, manager, analyst | Upload Form 26AS CSV/text |
| POST | `/api/v1/tds/upload-ledger/` | admin, manager, analyst | Upload TDS ledger CSV |
| POST | `/api/v1/tds/run/` | admin, manager, analyst | Run TDS reconciliation |
| GET  | `/api/v1/tds/runs/` | all roles | List past runs |

### 3.6 AI Service: 26AS text parser — add to `ai_service/main.py`

```python
@app.post('/parse-26as')
async def parse_26as(file: UploadFile = File(...)):
    """
    Accepts Form 26AS as plain text (copy-pasted from IT portal) or CSV.
    Returns structured rows: deductor PAN, section, gross amount, TDS amount.
    """
    content = (await file.read()).decode('utf-8', errors='replace')
    rows = []
    PAN_RE      = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')
    AMOUNT_RE   = re.compile(r'[\d,]+\.\d{2}')
    SECTION_RE  = re.compile(r'\b(19[0-9][A-Z]?|195)\b')

    for line in content.splitlines():
        line = line.strip()
        if not line or len(line) < 20:
            continue
        pan_match     = PAN_RE.search(line)
        amounts       = AMOUNT_RE.findall(line)
        section_match = SECTION_RE.search(line)
        if not pan_match or len(amounts) < 2:
            continue
        rows.append({
            'deductor_pan':  pan_match.group(0),
            'gross_amount':  float(amounts[0].replace(',', '')),
            'tds_amount':    float(amounts[1].replace(',', '')),
            'section_code':  section_match.group(0) if section_match else '',
            'needs_review':  not section_match,
        })
    return {'rows': rows, 'total': len(rows)}
```

### 3.7 Frontend page — `/tds`

- Financial year + quarter selector
- Upload Form 26AS (text/CSV)
- Upload TDS Ledger (CSV)
- Run button
- Results: summary card with total TDS in both sources, ₹ mismatch amount,
  exception table sorted by severity

---

## 4. Module 5 — Vendor Risk Ledger

### 4.1 What it does

Computes a rolling 90-day risk score per counterparty (vendor/supplier)
by aggregating their exception history. Exposes a Vendor card on every
exception detail page and a dedicated `/vendors` dashboard. Payment
release for high-risk vendors requires manager approval.

### 4.2 Model — `apps/vendors/models.py`

```python
from django.db import models
from apps.common.models import TimeStampedModel
from apps.entities.models import Entity

class Vendor(TimeStampedModel):
    """Master vendor record. Auto-created on first exception or sync."""
    entity          = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='vendors')
    name            = models.CharField(max_length=255)
    gstin           = models.CharField(max_length=20, blank=True)
    pan             = models.CharField(max_length=10, blank=True)
    email           = models.EmailField(blank=True)
    payment_blocked = models.BooleanField(default=False)

    class Meta:
        unique_together = ('entity', 'gstin')


class VendorRiskScore(TimeStampedModel):
    """
    Computed daily. Stores the rolling 90-day risk profile per vendor.
    Risk level: green (0-30) | amber (31-60) | red (61-100)
    """
    RISK_CHOICES = [('green','Green'),('amber','Amber'),('red','Red')]
    vendor              = models.OneToOneField(Vendor, on_delete=models.CASCADE, related_name='risk_score')
    score               = models.PositiveIntegerField(default=0)     # 0–100
    risk_level          = models.CharField(max_length=10, choices=RISK_CHOICES, default='green')
    exception_count_90d = models.PositiveIntegerField(default=0)
    avg_resolution_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    sla_breach_count    = models.PositiveIntegerField(default=0)
    amount_at_risk      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    last_computed       = models.DateTimeField(auto_now=True)
```

### 4.3 Risk Score Algorithm — `apps/vendors/services.py`

```python
from decimal import Decimal
from django.utils import timezone
from django.db.models import Avg, Count, Sum, Q
from apps.vendors.models import Vendor, VendorRiskScore
from apps.exceptions_app.models import ExceptionRecord

WEIGHTS = {
    'exception_count':  0.35,  # frequency
    'sla_breach_rate':  0.30,  # urgency
    'avg_resolution':   0.20,  # slowness
    'amount_at_risk':   0.15,  # monetary exposure
}
MAX_EXCEPTIONS  = 20
MAX_SLA_RATE    = 1.0
MAX_RES_DAYS    = 30
MAX_AMOUNT      = 500_000   # ₹5 lakh

def compute_vendor_risk(vendor: Vendor) -> VendorRiskScore:
    cutoff = timezone.now() - timezone.timedelta(days=90)
    excs   = ExceptionRecord.objects.filter(
        entity=vendor.entity,
        context__contains={'counterparty': vendor.name},
        created_at__gte=cutoff,
    )

    count     = excs.count()
    breached  = excs.filter(sla_deadline__lt=timezone.now(), status__in=['detected','routed','investigating']).count()
    sla_rate  = (breached / count) if count else 0
    avg_days  = excs.exclude(resolved_at=None).aggregate(
        avg=Avg('resolved_at') - Avg('created_at')
    ).get('avg') or 0
    total_amt = excs.aggregate(Sum('amount_difference')).get('amount_difference__sum') or Decimal('0')

    # Normalize each factor to 0–1
    n_count  = min(count  / MAX_EXCEPTIONS, 1.0)
    n_sla    = min(sla_rate, 1.0)
    n_days   = min(float(avg_days or 0) / MAX_RES_DAYS, 1.0)
    n_amount = min(float(total_amt) / MAX_AMOUNT, 1.0)

    raw_score = (
        WEIGHTS['exception_count'] * n_count +
        WEIGHTS['sla_breach_rate'] * n_sla  +
        WEIGHTS['avg_resolution']  * n_days +
        WEIGHTS['amount_at_risk']  * n_amount
    ) * 100

    score = round(raw_score)
    risk_level = 'green' if score <= 30 else ('amber' if score <= 60 else 'red')

    rs, _ = VendorRiskScore.objects.update_or_create(
        vendor=vendor,
        defaults={
            'score': score, 'risk_level': risk_level,
            'exception_count_90d': count, 'sla_breach_count': breached,
            'avg_resolution_days': avg_days or 0,
            'amount_at_risk': total_amt,
        }
    )
    return rs
```

### 4.4 Backend endpoints — `VendorViewSet`

| Method | URL | Permission | Action |
|---|---|---|---|
| GET  | `/api/v1/vendors/` | all roles | List all vendors with risk scores |
| GET  | `/api/v1/vendors/{id}/` | all roles | Vendor detail + exception history |
| POST | `/api/v1/vendors/{id}/block-payment/` | admin, manager | Block payment release |
| POST | `/api/v1/vendors/{id}/unblock-payment/` | admin, manager | Unblock payment |
| POST | `/api/v1/vendors/recompute-risk/` | admin | Recompute all vendor risk scores |

### 4.5 Frontend

- **`/vendors`** — Vendor Risk Dashboard
  - Table: vendor name | GSTIN | risk badge (🔴🟡🟢) | score | exceptions 90d | ₹ at risk | payment status
  - Click → vendor detail drawer with full exception timeline
- **Exception Detail sidebar** — show vendor risk badge inline next to counterparty name

---

## 5. Module 6 — Month-End Close Checklist

### 5.1 What it does

Auto-generates a structured checklist at the start of each financial month.
Each checklist item has an owner, due date, and completion status. The month
cannot be "closed" until all critical items are checked. CFOs get a live
progress view.

### 5.2 Model — `apps/close/models.py`

```python
from django.conf import settings
from django.db import models
from apps.common.models import TimeStampedModel
from apps.entities.models import Entity

class MonthEndPeriod(TimeStampedModel):
    """One month-end close cycle per entity."""
    STATUS_CHOICES = [('open','Open'),('in_progress','In Progress'),('closed','Closed')]
    entity         = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='close_periods')
    period         = models.CharField(max_length=7)           # "2024-01"
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    closed_by      = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    closed_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('entity', 'period')


class CloseChecklistItem(TimeStampedModel):
    """One item on the checklist. Can be system-generated or manual."""
    SOURCE_CHOICES = [('auto','Auto'),('manual','Manual')]
    CATEGORY_CHOICES = [
        ('bank','Bank Recon'), ('gst','GST Compliance'), ('tds','TDS Compliance'),
        ('vendor','Vendor Review'), ('payroll','Payroll'), ('other','Other')
    ]
    period         = models.ForeignKey(MonthEndPeriod, on_delete=models.CASCADE, related_name='items')
    title          = models.CharField(max_length=255)
    description    = models.TextField(blank=True)
    category       = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    is_critical    = models.BooleanField(default=False)
    source         = models.CharField(max_length=10, choices=SOURCE_CHOICES, default='auto')
    assigned_to    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name='checklist_items')
    due_date       = models.DateField(null=True, blank=True)
    is_complete    = models.BooleanField(default=False)
    completed_by   = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name='completed_items')
    completed_at   = models.DateTimeField(null=True, blank=True)
    linked_url     = models.CharField(max_length=255, blank=True)  # deep link e.g. "/gst?period=2024-01"
```

### 5.3 Auto-generation logic — `apps/close/services.py`

```python
from django.utils import timezone
from datetime import date
import calendar

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
    from apps.close.models import MonthEndPeriod, CloseChecklistItem
    month_end = MonthEndPeriod.objects.create(entity=entity, period=period)
    year, month = map(int, period.split('-'))
    _, last_day = calendar.monthrange(year, month)
    due = date(year, month, last_day)

    for item_def in DEFAULT_CHECKLIST:
        CloseChecklistItem.objects.create(
            period=month_end, due_date=due, **item_def
        )
    return month_end
```

### 5.4 Backend endpoints — `CloseViewSet`

| Method | URL | Permission | Action |
|---|---|---|---|
| POST | `/api/v1/close/generate/` | admin, manager | Generate checklist for period |
| GET  | `/api/v1/close/` | all roles | List all periods |
| GET  | `/api/v1/close/{id}/` | all roles | Get period + all items |
| PATCH | `/api/v1/close/{id}/items/{item_id}/complete/` | all roles | Mark item complete |
| POST | `/api/v1/close/{id}/close/` | admin, manager | Close the period (blocked if critical items incomplete) |

### 5.5 Frontend page — `/close`

- **Period selector** — month/year, "Generate Checklist" button
- **Progress bar** — X of Y items complete (critical items shown separately)
- **Checklist table** — category icon | title | owner | due | status badge | deep link
- **"Close Month" button** — disabled until all critical items complete; triggers
  confirmation modal
- CFO/Manager sees a summary card on their dashboard: e.g. *"Month-End Close:
  7/10 items done — 3 critical remaining"*

---

## 6. Module 7 — Tally / Zoho Books Sync

### 6.1 What it does

Replaces manual CSV export → upload with automated pulls:
- **Tally**: Via TDL (Tally Definition Language) HTTP bridge — Tally exposes
  a local HTTP server on port 9000; ExceptionIQ queries it for ledger entries.
- **Zoho Books**: Via Zoho Books REST API using OAuth2 refresh tokens stored
  per entity.

Both connectors pull ledger entries and bank transactions and auto-create
`LedgerEntry` / `BankStatementLine` rows, then optionally auto-trigger a
reconciliation run.

### 6.2 Model — `apps/integrations/models.py`

```python
from django.db import models
from apps.common.models import TimeStampedModel
from apps.entities.models import Entity

class SyncJob(TimeStampedModel):
    """Tracks every ERP sync pull."""
    SOURCE_CHOICES = [('tally','TallyPrime'),('zoho','Zoho Books')]
    STATUS_CHOICES = [('pending','Pending'),('running','Running'),('success','Success'),('failed','Failed')]
    entity       = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='sync_jobs')
    source       = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    from_date    = models.DateField()
    to_date      = models.DateField()
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rows_pulled  = models.PositiveIntegerField(default=0)
    error_msg    = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
```

### 6.3 Tally connector — `apps/integrations/tally.py`

```python
"""
Tally exposes a local SOAP/HTTP server on port 9000.
We send a TDL XML request to pull ledger vouchers for a date range.
"""
import requests
from datetime import date

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
    import xml.etree.ElementTree as ET
    root = ET.fromstring(xml_text)
    rows = []
    for voucher in root.iter("VOUCHER"):
        date_el   = voucher.find("DATE")
        amount_el = voucher.find("AMOUNT")
        ref_el    = voucher.find("VOUCHERNUMBER")
        party_el  = voucher.find("PARTYLEDGERNAME")
        if date_el is None or amount_el is None:
            continue
        rows.append({
            "txn_date":    date_el.text,
            "amount":      abs(float(amount_el.text or 0)),
            "reference":   ref_el.text if ref_el is not None else "",
            "counterparty":party_el.text if party_el is not None else "",
            "account_type":"bank",
        })
    return rows
```

### 6.4 Zoho Books connector — `apps/integrations/zoho.py`

```python
import requests
from datetime import date
from django.utils import timezone

ZOHO_API_BASE = "https://www.zohoapis.in/books/v3"

def _refresh_zoho_token(entity):
    res = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
        "refresh_token": entity.zoho_refresh_token,
        "client_id":     "YOUR_CLIENT_ID",
        "client_secret": "YOUR_CLIENT_SECRET",
        "grant_type":    "refresh_token",
    })
    data = res.json()
    entity.zoho_access_token = data["access_token"]
    entity.zoho_token_expiry = timezone.now() + timezone.timedelta(seconds=data["expires_in"])
    entity.save(update_fields=["zoho_access_token", "zoho_token_expiry"])
    return entity.zoho_access_token

def pull_zoho_bank_transactions(entity, from_date: date, to_date: date) -> list[dict]:
    if not entity.zoho_access_token or timezone.now() >= (entity.zoho_token_expiry or timezone.now()):
        token = _refresh_zoho_token(entity)
    else:
        token = entity.zoho_access_token

    headers = {"Authorization": f"Zoho-oauthtoken {token}"}
    params  = {
        "organization_id": entity.zoho_org_id,
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
```

### 6.5 Backend endpoints — `IntegrationsViewSet`

| Method | URL | Permission | Action |
|---|---|---|---|
| POST | `/api/v1/integrations/tally/sync/` | admin, manager | Pull ledger from Tally for date range |
| POST | `/api/v1/integrations/zoho/sync/` | admin, manager | Pull transactions from Zoho Books |
| POST | `/api/v1/integrations/zoho/connect/` | admin | Save Zoho org ID + OAuth tokens |
| GET  | `/api/v1/integrations/jobs/` | all roles | List all sync jobs |
| GET  | `/api/v1/integrations/jobs/{id}/` | all roles | Sync job detail |

### 6.6 Frontend page — `/integrations`

- **Tally card** — Tally host input (default: `localhost:9000`), company name,
  date range picker, "Pull from Tally" button, last sync status
- **Zoho Books card** — "Connect Zoho Books" OAuth button, org ID display,
  date range picker, "Pull from Zoho" button, last sync status
- **Sync History table** — source | from | to | rows pulled | status | time

---

## 7. Shared: New Django Apps & Migrations

### 7.1 `apps/gst/apps.py`
```python
from django.apps import AppConfig
class GstConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gst'
```
_(repeat pattern for `tds`, `vendors`, `close`, `integrations`)_

### 7.2 Migration order

```bash
python manage.py makemigrations gst
python manage.py makemigrations tds
python manage.py makemigrations vendors
python manage.py makemigrations close
python manage.py makemigrations integrations
python manage.py makemigrations entities   # for new fields
python manage.py migrate
```

---

## 8. Shared: API URL Registration

### `backend/apps/api/urls.py` additions

```python
from apps.gst.views  import GSTViewSet
from apps.tds.views  import TDSViewSet
from apps.vendors.views import VendorViewSet
from apps.close.views   import CloseViewSet
from apps.integrations.views import IntegrationsViewSet

router.register(r'gst',          GSTViewSet,          basename='gst')
router.register(r'tds',          TDSViewSet,          basename='tds')
router.register(r'vendors',      VendorViewSet,       basename='vendors')
router.register(r'close',        CloseViewSet,        basename='close')
router.register(r'integrations', IntegrationsViewSet, basename='integrations')
```

---

## 9. Shared: RBAC Extensions

### New actions to add to `ROLE_ACTION_MAP` in `apps/api/permissions.py`

```python
ROLE_ACTION_MAP = {
    # ... existing entries ...

    # GST
    'upload_gstr2b':          {'admin', 'manager', 'analyst'},
    'upload_purchase_register':{'admin', 'manager', 'analyst'},
    'gst_run':                {'admin', 'manager', 'analyst'},

    # TDS
    'upload_26as':            {'admin', 'manager', 'analyst'},
    'upload_tds_ledger':      {'admin', 'manager', 'analyst'},
    'tds_run':                {'admin', 'manager', 'analyst'},

    # Vendors
    'block_payment':          {'admin', 'manager'},
    'unblock_payment':        {'admin', 'manager'},
    'recompute_risk':         {'admin'},

    # Close
    'generate_close':         {'admin', 'manager'},
    'close_period':           {'admin', 'manager'},

    # Integrations
    'tally_sync':             {'admin', 'manager'},
    'zoho_sync':              {'admin', 'manager'},
    'zoho_connect':           {'admin'},
}
```

---

## 10. Frontend Route & Nav Changes

### New pages

| Route | Component | Roles |
|---|---|---|
| `/gst` | `GSTRecon.tsx` | admin, manager, analyst |
| `/tds` | `TDSRecon.tsx` | admin, manager, analyst |
| `/vendors` | `VendorRisk.tsx` | all |
| `/close` | `MonthEndClose.tsx` | all |
| `/integrations` | `Integrations.tsx` | admin, manager |

### Navbar additions (`Sidebar.tsx`)

```tsx
const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/',             roles: ['admin','manager','approver','analyst','viewer'] },
  { label: 'Exceptions',    path: '/exceptions',   roles: ['admin','manager','approver','analyst','viewer'] },
  { label: 'Bank Recon',    path: '/ingestion',    roles: ['admin','manager','analyst'] },
  { label: 'GST Recon',     path: '/gst',          roles: ['admin','manager','analyst'] },     // NEW
  { label: 'TDS Recon',     path: '/tds',          roles: ['admin','manager','analyst'] },     // NEW
  { label: 'Vendors',       path: '/vendors',      roles: ['admin','manager','approver','analyst','viewer'] }, // NEW
  { label: 'Month-End',     path: '/close',        roles: ['admin','manager','approver','analyst','viewer'] }, // NEW
  { label: 'Integrations',  path: '/integrations', roles: ['admin','manager'] },                // NEW
  { label: 'Routing Rules', path: '/routing',      roles: ['admin'] },
  { label: 'Users',         path: '/users',        roles: ['admin'] },
]
```

### Dashboard additions per role

| Role | New widget |
|---|---|
| Admin | GST ITC at risk card + Month-End close progress |
| Manager | Month-End close progress bar + vendor risk summary |
| Analyst | My pending checklist items count |
| Approver | Pending close approval items |
| Viewer | Read-only close status banner |

---

## 11. Implementation Checklist

### Phase 3A — Backend foundations (Week 1)
- [ ] Create 5 new Django apps (gst, tds, vendors, close, integrations)
- [ ] Write all models and run migrations
- [ ] Update RBAC `ROLE_ACTION_MAP` with new actions
- [ ] Register URL routes for all 5 new ViewSets
- [ ] Entity model migration (add `tally_company_name`, `zoho_org_id`, token fields)

### Phase 3B — Module 2: GST (Week 1–2)
- [ ] Implement `GSTViewSet` with upload + run actions
- [ ] Implement `run_gst_reconciliation()` service
- [ ] Add `/parse-gstr2b` to FastAPI AI service
- [ ] Frontend: `GSTRecon.tsx` page with JSON upload + CSV upload + run

### Phase 3C — Module 3: TDS (Week 2)
- [ ] Implement `TDSViewSet`
- [ ] Implement TDS reconciliation service with section rate validation
- [ ] Add `/parse-26as` to FastAPI AI service
- [ ] Frontend: `TDSRecon.tsx` page

### Phase 3D — Module 5: Vendor Risk (Week 2–3)
- [ ] Implement `VendorViewSet` with block/unblock/recompute actions
- [ ] Implement `compute_vendor_risk()` scoring algorithm
- [ ] Wire vendor auto-creation on exception create (post_save signal)
- [ ] Frontend: `VendorRisk.tsx` dashboard + vendor badge on Exception Detail

### Phase 3E — Module 6: Month-End Close (Week 3)
- [ ] Implement `CloseViewSet` with generate + complete-item + close actions
- [ ] Implement `generate_close_period()` auto-checklist service
- [ ] Block `close_period` if any critical items incomplete
- [ ] Frontend: `MonthEndClose.tsx` checklist page + dashboard progress widget

### Phase 3F — Module 7: ERP Sync (Week 3–4)
- [ ] Implement Tally HTTP connector (`tally.py`) + `IntegrationsViewSet`
- [ ] Implement Zoho Books OAuth connector (`zoho.py`)
- [ ] Store Zoho tokens encrypted on Entity model
- [ ] Frontend: `Integrations.tsx` page with Tally + Zoho cards

### Phase 3G — Testing & docs (Week 4)
- [ ] Write `exception4_test_suite.md` test spec for all new modules
- [ ] Add tests to `backend/tests/` for all new endpoints
- [ ] Add tests to `ai_service/tests/` for `/parse-gstr2b` and `/parse-26as`
- [ ] Update `docs/exception3_platform_expansion.md` with actual implementation notes
