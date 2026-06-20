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


class TDSReconciliationRun(TimeStampedModel):
    """Tracks each TDS reconciliation run per entity per financial year / quarter."""
    STATUS_CHOICES = [('pending','Pending'),('running','Running'),('completed','Completed'),('failed','Failed')]
    entity          = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='tds_runs')
    financial_year  = models.CharField(max_length=9)         # "2024-2025"
    quarter         = models.CharField(max_length=2)         # "Q1" "Q2" "Q3" "Q4"
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_26as      = models.PositiveIntegerField(default=0)
    total_ledger    = models.PositiveIntegerField(default=0)
    matched         = models.PositiveIntegerField(default=0)
    exceptions      = models.PositiveIntegerField(default=0)
    amount_at_risk  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    completed_at    = models.DateTimeField(null=True, blank=True)
