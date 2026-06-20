from decimal import Decimal
from django.utils import timezone
from apps.tds.models import Form26ASEntry, TDSLedgerEntry, TDSReconciliationRun
from apps.tds.constants import SECTION_TDS_RATES
from apps.exceptions_app.models import ExceptionRecord, AuditLog
from apps.api.services import apply_routing

def run_tds_reconciliation(entity, financial_year: str, quarter: str) -> TDSReconciliationRun:
    run, created_run = TDSReconciliationRun.objects.get_or_create(
        entity=entity,
        financial_year=financial_year,
        quarter=quarter,
        defaults={'status': 'running'}
    )
    if not created_run:
        run.status = 'running'
        run.completed_at = None
        run.save(update_fields=['status', 'completed_at'])

    # Clear old TDS exceptions for this period
    old_exceptions = ExceptionRecord.objects.filter(
        entity=entity,
        reconciliation_type='tds',
        context__financial_year=financial_year,
        context__quarter=quarter
    )
    old_exceptions.delete()

    as_entries = Form26ASEntry.objects.filter(entity=entity, financial_year=financial_year, quarter=quarter)
    ledger_entries = TDSLedgerEntry.objects.filter(entity=entity, financial_year=financial_year, quarter=quarter)

    run.total_26as = as_entries.count()
    run.total_ledger = ledger_entries.count()
    run.matched = 0
    run.exceptions = 0
    run.amount_at_risk = Decimal("0")

    # Group Form 26AS by (deductor_pan, section_code)
    as_grouped = {}
    for entry in as_entries:
        pan = entry.deductor_pan.strip().upper()
        sec = entry.section_code.strip().upper()
        key = (pan, sec)
        if key not in as_grouped:
            as_grouped[key] = {'gross': Decimal('0.00'), 'tds': Decimal('0.00'), 'name': entry.deductor_name, 'ids': []}
        as_grouped[key]['gross'] += entry.gross_amount
        as_grouped[key]['tds'] += entry.tds_amount
        as_grouped[key]['ids'].append(str(entry.id))

    # Group TDS Ledger by (deductor_pan, section_code)
    ledger_grouped = {}
    for entry in ledger_entries:
        pan = entry.deductor_pan.strip().upper()
        sec = entry.section_code.strip().upper()
        key = (pan, sec)
        if key not in ledger_grouped:
            ledger_grouped[key] = {'gross': Decimal('0.00'), 'tds': Decimal('0.00'), 'name': entry.deductor_name, 'ids': []}
        ledger_grouped[key]['gross'] += entry.gross_amount
        ledger_grouped[key]['tds'] += entry.tds_amount
        ledger_grouped[key]['ids'].append(str(entry.id))

    created = []
    amt_risk = Decimal("0")
    all_keys = set(as_grouped.keys()) | set(ledger_grouped.keys())

    for key in all_keys:
        pan, sec = key
        g_as = as_grouped.get(key)
        g_led = ledger_grouped.get(key)

        if g_as and not g_led:
            # Deducted in 26AS but not present in TDS ledger
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='tds',
                exception_code='TDS-MISS-LEDGER', severity='high', status='detected',
                amount_difference=g_as['tds'],
                confidence_score=95,
                context={
                    'deductor_pan': pan,
                    'section_code': sec,
                    'financial_year': financial_year,
                    'quarter': quarter,
                    'tds_amount': str(g_as['tds']),
                    'counterparty': g_as['name'] or pan
                },
                source_record_ids=g_as['ids']
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            apply_routing(exc)
            amt_risk += g_as['tds']
            created.append(exc)

        elif g_led and not g_as:
            # Deductee claims TDS in ledger but not present in 26AS (not deposited)
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='tds',
                exception_code='TDS-MISS-26AS', severity='critical', status='detected',
                amount_difference=g_led['tds'],
                confidence_score=95,
                context={
                    'deductor_pan': pan,
                    'section_code': sec,
                    'financial_year': financial_year,
                    'quarter': quarter,
                    'tds_amount': str(g_led['tds']),
                    'counterparty': g_led['name'] or pan
                },
                source_record_ids=g_led['ids']
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            apply_routing(exc)
            amt_risk += g_led['tds']
            created.append(exc)

        elif g_as and g_led:
            diff = abs(g_as['tds'] - g_led['tds'])
            if diff > Decimal("1.00"):
                exc = ExceptionRecord.objects.create(
                    entity=entity, reconciliation_type='tds',
                    exception_code='TDS-AMT', severity='medium', status='detected',
                    amount_difference=diff,
                    confidence_score=90,
                    context={
                        'deductor_pan': pan,
                        'section_code': sec,
                        'financial_year': financial_year,
                        'quarter': quarter,
                        'as_tds': str(g_as['tds']),
                        'ledger_tds': str(g_led['tds']),
                        'counterparty': g_as['name'] or g_led['name'] or pan
                    },
                    source_record_ids=g_as['ids'] + g_led['ids']
                )
                AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
                apply_routing(exc)
                created.append(exc)
            else:
                run.matched += 1

    # Check for TDS-RATE exceptions
    # We can inspect ledger entries individually to check if rate matches section rules
    for entry in ledger_entries:
        sec = entry.section_code.strip().upper()
        if not sec:
            continue
        expected_rate = SECTION_TDS_RATES.get(sec)
        if expected_rate is None:
            continue

        actual_rate = entry.tds_rate
        # For contractor/rent, let's be flexible
        rate_matched = False
        if sec == '194C':
            # contractor individual is 1.0, corporate is 2.0
            rate_matched = abs(actual_rate - Decimal('1.0')) < Decimal('0.05') or abs(actual_rate - Decimal('2.0')) < Decimal('0.05')
        elif sec == '194I':
            # rent machinery is 2.0, land/building is 10.0
            rate_matched = abs(actual_rate - Decimal('2.0')) < Decimal('0.05') or abs(actual_rate - Decimal('10.0')) < Decimal('0.05')
        else:
            rate_matched = abs(actual_rate - Decimal(str(expected_rate))) < Decimal('0.05')

        if not rate_matched:
            # Rate mismatch
            exc = ExceptionRecord.objects.create(
                entity=entity, reconciliation_type='tds',
                exception_code='TDS-RATE', severity='medium', status='detected',
                amount_difference=abs(entry.tds_amount - (entry.gross_amount * Decimal(str(expected_rate or 0)) / 100)),
                confidence_score=85,
                context={
                    'deductor_pan': entry.deductor_pan,
                    'section_code': sec,
                    'financial_year': financial_year,
                    'quarter': quarter,
                    'expected_rate': str(expected_rate),
                    'actual_rate': str(actual_rate),
                    'gross_amount': str(entry.gross_amount),
                    'tds_amount': str(entry.tds_amount),
                    'counterparty': entry.deductor_name or entry.deductor_pan
                },
                source_record_ids=[str(entry.id)]
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            apply_routing(exc)
            created.append(exc)

    run.exceptions = len(created)
    run.amount_at_risk = amt_risk
    run.status = 'completed'
    run.completed_at = timezone.now()
    run.save()
    return run
