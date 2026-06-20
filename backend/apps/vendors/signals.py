from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.exceptions_app.models import ExceptionRecord
from apps.vendors.models import Vendor
from apps.vendors.services import compute_vendor_risk

@receiver(post_save, sender=ExceptionRecord)
def auto_create_vendor_from_exception(sender, instance, created, **kwargs):
    c_party = instance.context.get('counterparty', '')
    if not c_party:
        return
        
    gstin = instance.context.get('supplier_gstin', '')
    # If TDS recon, deductor_pan is used
    if not gstin and 'deductor_pan' in instance.context:
        gstin = instance.context.get('deductor_pan', '')

    vendor, created_v = Vendor.objects.get_or_create(
        entity=instance.entity,
        name=c_party.strip(),
        defaults={'gstin': gstin.strip()}
    )
    
    # Compute or recompute risk score
    compute_vendor_risk(vendor)
