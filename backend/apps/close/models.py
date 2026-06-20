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

    def __str__(self):
        return f"{self.entity.name} - {self.period} ({self.status})"


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

    def __str__(self):
        return f"{self.title} - Complete: {self.is_complete}"
