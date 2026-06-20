from decimal import Decimal
from django.utils import timezone
from apps.gst.models import GSTR2BRecord, PurchaseRegisterEntry, GSTReconciliationRun
from apps.exceptions_app.models import ExceptionRecord, AuditLog
from apps.api.services import apply_routing

def run_gst_reconciliation(entity, tax_period: str) -> GSTReconciliationRun:
    # Get or create the run record, setting status to running
    run, created_run = GSTReconciliationRun.objects.get_or_create(
        entity=entity, 
        tax_period=tax_period,
        defaults={'status': 'running'}
    )
    if not created_run:
        run.status = 'running'
        run.completed_at = None
        run.save(update_fields=['status', 'completed_at'])

    # Delete existing GST exception records for this entity and tax period to avoid duplicates
    # Let's filter on the context key tax_period
    old_exceptions = ExceptionRecord.objects.filter(
        entity=entity,
        reconciliation_type='gst',
        context__tax_period=tax_period
    )
    old_exceptions.delete()

    gstr2b_qs = GSTR2BRecord.objects.filter(entity=entity, tax_period=tax_period)
    pr_qs     = PurchaseRegisterEntry.objects.filter(entity=entity, tax_period=tax_period)

    gstr2b_map = {(r.supplier_gstin.strip().upper(), r.invoice_number.strip().upper()): r for r in gstr2b_qs}
    pr_map     = {(r.supplier_gstin.strip().upper(), r.invoice_number.strip().upper()): r for r in pr_qs}

    run.total_gstr2b   = len(gstr2b_map)
    run.total_purchase = len(pr_map)
    run.matched        = 0
    run.exceptions     = 0
    run.itc_at_risk    = Decimal("0")

    created = []
    itc_risk = Decimal("0")

    all_keys = set(gstr2b_map.keys()) | set(pr_map.keys())

    for key in all_keys:
        g = gstr2b_map.get(key)
        p = pr_map.get(key)

        if g and not p:
            # ITC available in GSTR-2B but not booked in Purchase Register
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='gst',
                exception_code='GST-MISS-PR', severity='high', status='detected',
                amount_difference=g.total_tax,
                confidence_score=95,
                context={
                    'supplier_gstin': g.supplier_gstin, 
                    'invoice_number': g.invoice_number,
                    'tax_period': tax_period, 
                    'itc_at_risk': str(g.total_tax),
                    'counterparty': g.raw_data.get('supplier_name', g.supplier_gstin)
                },
                source_record_ids=[str(g.id)]
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            apply_routing(exc)
            itc_risk += g.total_tax
            created.append(exc)

        elif p and not g:
            # ITC claimed in Purchase Register but supplier hasn't filed GSTR-2B
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='gst',
                exception_code='GST-MISS-GSTR', severity='critical', status='detected',
                amount_difference=p.total_tax,
                confidence_score=95,
                context={
                    'supplier_gstin': p.supplier_gstin, 
                    'invoice_number': p.invoice_number,
                    'tax_period': tax_period, 
                    'itc_at_risk': str(p.total_tax),
                    'counterparty': p.raw_data.get('supplier_name', p.supplier_gstin)
                },
                source_record_ids=[str(p.id)]
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            apply_routing(exc)
            itc_risk += p.total_tax
            created.append(exc)

        elif g and p:
            tax_diff = abs(g.total_tax - p.total_tax)
            date_diff = abs((g.invoice_date - p.invoice_date).days) if p.invoice_date and g.invoice_date else 0

            if tax_diff > Decimal("1.00"):
                exc = ExceptionRecord.objects.create(
                    entity=entity, reconciliation_type='gst',
                    exception_code='GST-AMT', severity='medium', status='detected',
                    amount_difference=tax_diff,
                    confidence_score=90,
                    context={
                        'supplier_gstin': g.supplier_gstin, 
                        'invoice_number': g.invoice_number,
                        'tax_period': tax_period,
                        'gstr2b_tax': str(g.total_tax), 
                        'pr_tax': str(p.total_tax),
                        'counterparty': g.raw_data.get('supplier_name', g.supplier_gstin)
                    },
                    source_record_ids=[str(g.id), str(p.id)]
                )
                AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
                apply_routing(exc)
                created.append(exc)
            elif date_diff > 5:
                exc = ExceptionRecord.objects.create(
                    entity=entity, reconciliation_type='gst',
                    exception_code='GST-DATE', severity='low', status='detected',
                    date_difference=date_diff,
                    confidence_score=85,
                    context={
                        'supplier_gstin': g.supplier_gstin, 
                        'invoice_number': g.invoice_number,
                        'tax_period': tax_period,
                        'gstr2b_date': str(g.invoice_date), 
                        'pr_date': str(p.invoice_date),
                        'counterparty': g.raw_data.get('supplier_name', g.supplier_gstin)
                    },
                    source_record_ids=[str(g.id), str(p.id)]
                )
                AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
                apply_routing(exc)
                created.append(exc)
            else:
                run.matched += 1

    run.exceptions  = len(created)
    run.itc_at_risk = itc_risk
    run.status      = 'completed'
    run.completed_at = timezone.now()
    run.save()
    return run
