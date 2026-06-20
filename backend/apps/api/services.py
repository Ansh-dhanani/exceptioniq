from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from apps.reconciliation.models import LedgerEntry, BankStatementLine
from apps.exceptions_app.models import ExceptionRecord, AuditLog
from apps.routing.models import RoutingRule
from apps.users.models import User


def normalize_reference(value: str) -> str:
    return ''.join(ch for ch in (value or '').lower() if ch.isalnum())


def detect_bank_exceptions(entity, amount_tolerance=Decimal('0.00')):
    created = []
    used_ledger_ids = set()
    ledger_entries = list(LedgerEntry.objects.filter(entity=entity).order_by('txn_date', 'amount'))

    for bank_line in BankStatementLine.objects.filter(entity=entity).order_by('txn_date', 'amount'):
        candidate = None
        # First pass: Match by reference if it exists and matches
        for ledger in ledger_entries:
            if ledger.id in used_ledger_ids:
                continue
            if ledger.reference and bank_line.reference and normalize_reference(ledger.reference) == normalize_reference(bank_line.reference):
                candidate = ledger
                break
        
        # Second pass: Fall back to exact amount match
        if not candidate:
            for ledger in ledger_entries:
                if ledger.id in used_ledger_ids:
                    continue
                amount_diff = abs(ledger.amount - bank_line.amount)
                if amount_diff <= amount_tolerance:
                    candidate = ledger
                    break
        if not candidate:
            exc = ExceptionRecord.objects.create(
                entity=entity,
                reconciliation_type='bank',
                exception_code='BANK-MISS-LEDGER',
                severity='high',
                amount_difference=bank_line.amount,
                context={'bank_line_id': str(bank_line.id), 'reference': bank_line.reference},
                source_record_ids=[str(bank_line.id)],
                confidence_score=95,
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            created.append(exc)
            continue

        used_ledger_ids.add(candidate.id)
        ref_match = normalize_reference(candidate.reference) == normalize_reference(bank_line.reference)
        date_diff = abs((candidate.txn_date - bank_line.txn_date).days)
        amount_diff = abs(candidate.amount - bank_line.amount)
        if not ref_match or date_diff > 0 or amount_diff > amount_tolerance:
            code = 'BANK-REF' if not ref_match else 'BANK-DATE'
            if amount_diff > amount_tolerance:
                code = 'BANK-AMT'
            exc = ExceptionRecord.objects.create(
                entity=entity,
                reconciliation_type='bank',
                exception_code=code,
                severity='medium' if code != 'BANK-AMT' else 'high',
                amount_difference=amount_diff,
                date_difference=date_diff,
                context={'bank_line_id': str(bank_line.id), 'ledger_entry_id': str(candidate.id)},
                source_record_ids=[str(bank_line.id), str(candidate.id)],
                confidence_score=88,
            )
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            created.append(exc)

    for ledger in ledger_entries:
        if ledger.id in used_ledger_ids:
            continue
        exc = ExceptionRecord.objects.create(
            entity=entity,
            reconciliation_type='bank',
            exception_code='BANK-MISS-BANK',
            severity='high',
            amount_difference=ledger.amount,
            context={'ledger_entry_id': str(ledger.id), 'reference': ledger.reference},
            source_record_ids=[str(ledger.id)],
            confidence_score=95,
        )
        AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
        created.append(exc)
    return created


def apply_routing(exception):
    rules = RoutingRule.objects.filter(
        entity=exception.entity,
        reconciliation_type=exception.reconciliation_type,
        exception_code=exception.exception_code,
        active=True,
    ).order_by('min_amount')
    chosen = None
    for rule in rules:
        if exception.amount_difference < rule.min_amount:
            continue
        if rule.max_amount is not None and exception.amount_difference > rule.max_amount:
            continue
        chosen = rule
        break
    if not chosen:
        chosen = RoutingRule.objects.filter(entity=exception.entity, reconciliation_type=exception.reconciliation_type, active=True).first()
    if not chosen:
        return exception
    assignee = User.objects.filter(role=chosen.assign_to_role, is_active=True).order_by('id').first()
    exception.assigned_to = assignee
    exception.sla_deadline = timezone.now() + timedelta(hours=chosen.sla_hours)
    exception.status = 'routed'
    exception.save(update_fields=['assigned_to', 'sla_deadline', 'status', 'updated_at'])
    AuditLog.objects.create(exception=exception, user=assignee, action='routed', metadata={'rule_id': str(chosen.id)})
    return exception
