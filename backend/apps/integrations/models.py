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

    def __str__(self):
        return f"{self.entity.name} - {self.source} ({self.status})"
