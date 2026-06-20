from decimal import Decimal
from django.utils import timezone
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
    
    # Query all exceptions for this entity in past 90 days
    excs = ExceptionRecord.objects.filter(
        entity=vendor.entity,
        created_at__gte=cutoff
    )
    
    # Match vendor by case-insensitive name check on counterparty
    v_excs = []
    for exc in excs:
        c_party = exc.context.get('counterparty', '')
        if str(c_party).strip().lower() == vendor.name.strip().lower():
            v_excs.append(exc)
            
    count = len(v_excs)
    breached = 0
    resolved_days_list = []
    total_amt = Decimal('0.00')
    
    for exc in v_excs:
        total_amt += exc.amount_difference
        
        # Check SLA breach
        if exc.sla_deadline and exc.sla_deadline < timezone.now() and exc.status in ['detected','routed','investigating']:
            breached += 1
            
        # Check resolution time
        if exc.resolved_at:
            delta = exc.resolved_at - exc.created_at
            resolved_days_list.append(delta.total_seconds() / 86400.0)
            
    sla_rate = (breached / count) if count else 0
    avg_days = sum(resolved_days_list) / len(resolved_days_list) if resolved_days_list else 0
    
    # Normalize each factor to 0–1
    n_count  = min(count  / MAX_EXCEPTIONS, 1.0)
    n_sla    = min(sla_rate, 1.0)
    n_days   = min(float(avg_days) / MAX_RES_DAYS, 1.0)
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
            'score': score, 
            'risk_level': risk_level,
            'exception_count_90d': count, 
            'sla_breach_count': breached,
            'avg_resolution_days': Decimal(str(round(avg_days, 1))),
            'amount_at_risk': total_amt,
        }
    )
    return rs
