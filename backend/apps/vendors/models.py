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
        unique_together = ('entity', 'name')

    def __str__(self):
        return self.name


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

    def __str__(self):
        return f"{self.vendor.name} - {self.score} ({self.risk_level})"
