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
