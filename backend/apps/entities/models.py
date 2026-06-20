from django.db import models
from apps.common.models import TimeStampedModel

class Entity(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    gstin = models.CharField(max_length=20, blank=True)
    currency = models.CharField(max_length=10, default='INR')
    tally_company_name = models.CharField(max_length=255, blank=True)
    zoho_org_id = models.CharField(max_length=100, blank=True)
    zoho_access_token = models.TextField(blank=True)
    zoho_refresh_token = models.TextField(blank=True)
    zoho_token_expiry = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name
