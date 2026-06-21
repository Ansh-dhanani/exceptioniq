import uuid
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.entities.models import Entity
from apps.organizations.models import Organization
from apps.routing.models import RoutingRule
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from apps.exceptions_app.models import ExceptionRecord, ExceptionComment, AuditLog

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with default entity, users, routing rules, and 30 synthetic exceptions'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')
        
        # 1. Create default Entity
        entity, created = Entity.objects.get_or_create(
            code='ACME',
            defaults={
                'name': 'Acme Corporation',
                'gstin': '27AAAAA1111A1Z1',
                'currency': 'INR'
            }
        )
        self.stdout.write(f'Seeded Entity: {entity.name}')

        # 2. Create standard Users
        users_data = [
            ('admin', 'admin', 'admin'),
            ('analyst', 'analyst', 'analyst'),
            ('approver', 'approver', 'approver'),
            ('manager', 'manager', 'manager'),
        ]
        users = {}
        for username, password, role in users_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@exceptioniq.local',
                    'role': role,
                    'is_staff': True,
                    'is_superuser': (role == 'admin')
                }
            )
            if created:
                user.set_password(password)
                user.save()
            users[role] = user
            self.stdout.write(f'Seeded User: {username} ({role})')

        # 2b. Create default Organization and assign all users
        org, _ = Organization.objects.get_or_create(
            code='acme-corporation',
            defaults={
                'name': 'Acme Corporation',
                'created_by': users.get('manager'),
            }
        )
        for user in users.values():
            if not user.organization:
                user.organization = org
                user.save(update_fields=['organization'])
        self.stdout.write(f'Seeded Organization: {org.name}')

        # 3. Create default Routing Rules
        rules = [
            ('BANK-AMT Low/Medium', 'bank', 'BANK-AMT', 0, 1000, 'analyst', 24, 'medium'),
            ('BANK-AMT High', 'bank', 'BANK-AMT', 1000, None, 'manager', 12, 'high'),
            ('BANK-REF Rule', 'bank', 'BANK-REF', 0, None, 'analyst', 48, 'low'),
            ('BANK-DATE Rule', 'bank', 'BANK-DATE', 0, None, 'analyst', 48, 'low'),
            ('BANK-MISS-LEDGER Rule', 'bank', 'BANK-MISS-LEDGER', 0, None, 'analyst', 24, 'medium'),
            ('BANK-MISS-BANK Rule', 'bank', 'BANK-MISS-BANK', 0, None, 'analyst', 24, 'medium'),
            ('BANK-DUP Rule', 'bank', 'BANK-DUP', 0, None, 'analyst', 24, 'high'),
        ]
        for name, recon_type, code, min_amt, max_amt, role, hours, priority in rules:
            RoutingRule.objects.get_or_create(
                entity=entity,
                reconciliation_type=recon_type,
                exception_code=code,
                min_amount=min_amt,
                max_amount=max_amt,
                defaults={
                    'assign_to_role': role,
                    'sla_hours': hours,
                    'priority': priority,
                    'active': True
                }
            )
            self.stdout.write(f'Seeded Routing Rule: {code} -> {role}')

        # Clean existing reconciliation data to prevent overflow on repeat seeds
        ExceptionRecord.objects.filter(entity=entity).delete()
        LedgerEntry.objects.filter(entity=entity).delete()
        BankStatementLine.objects.filter(entity=entity).delete()
        Batch.objects.filter(entity=entity).delete()

        # Create a Seed Batch
        batch = Batch.objects.create(
            entity=entity,
            recon_type='bank',
            status='completed',
            source_name='system_seeder_batch',
            total_rows=60,
            matched_rows=30,
            exception_rows=30
        )

        # 4. Generate 30 synthetic exceptions across statuses, codes, and severities
        # 8 detected, 7 investigating, 4 pending_approval (awaiting approver), 6 closed (approved), 3 breached (past SLA), 2 high-severity DUP
        
        now = timezone.now()
        
        exceptions_config = [
            # 8 detected (unrouted or newly routed, no analyst action)
            ('BANK-AMT', 'medium', 'detected', 120.00, 0, now + timedelta(hours=24), 'Vendor XYZ', 'INV-552', 'Payment discrepancy'),
            ('BANK-MISS-LEDGER', 'high', 'detected', 500.00, 0, now + timedelta(hours=24), 'Direct Debit Corp', 'DD-881', 'Auto-debit for utilities'),
            ('BANK-MISS-BANK', 'medium', 'detected', 1200.00, 0, now + timedelta(hours=24), 'Customer ABC', 'INV-2041', 'Sales invoice unpaid'),
            ('BANK-REF', 'low', 'detected', 0.00, 0, now + timedelta(hours=48), 'Vendor Delta', 'INV-902', 'Reference mistyped'),
            ('BANK-DATE', 'low', 'detected', 0.00, 4, now + timedelta(hours=48), 'Vendor Gamma', 'INV-103', 'Transaction cleared late'),
            ('BANK-AMT', 'medium', 'detected', 45.50, 0, now + timedelta(hours=24), 'Supplier Alfa', 'INV-202', 'Decimal mismatch'),
            ('BANK-MISS-LEDGER', 'medium', 'detected', 80.00, 0, now + timedelta(hours=24), 'Bank Fees INC', 'FEES-JUN', 'Monthly charge'),
            ('BANK-MISS-BANK', 'medium', 'detected', 350.00, 0, now + timedelta(hours=24), 'Employee Reimburse', 'EMP-44', 'Pending bank payout'),
            
            # 7 investigating (assigned to analyst, active)
            ('BANK-AMT', 'medium', 'investigating', 250.00, 0, now + timedelta(hours=18), 'Tech Services', 'INV-301', 'Rate difference', 'analyst'),
            ('BANK-MISS-LEDGER', 'high', 'investigating', 980.00, 0, now + timedelta(hours=6), 'Income Tax Dept', 'TDS-REF-1', 'TDS rebate received', 'analyst'),
            ('BANK-REF', 'low', 'investigating', 0.00, 0, now + timedelta(hours=36), 'Vendor Beta', 'REF-889', 'Typo check', 'analyst'),
            ('BANK-DATE', 'low', 'investigating', 0.00, 5, now + timedelta(hours=42), 'Client Omega', 'INV-1090', 'Weekend clearance delay', 'analyst'),
            ('BANK-AMT', 'high', 'investigating', 1500.00, 0, now + timedelta(hours=8), 'Hardware Distributors', 'INV-4412', 'Disputed price', 'manager'),
            ('BANK-DUP', 'high', 'investigating', 750.00, 0, now + timedelta(hours=20), 'Logistics Supply', 'INV-909', 'Suspected double billing', 'analyst'),
            ('BANK-MISS-LEDGER', 'medium', 'investigating', 150.00, 0, now + timedelta(hours=12), 'Vendor Sigma', 'INV-771', 'Check validation', 'analyst'),

            # 4 pending_approval (resolved by analyst, awaiting approver/manager)
            ('BANK-AMT', 'medium', 'pending_approval', 15.00, 0, now + timedelta(hours=22), 'Petty Cash', 'CSH-10', 'Rounding difference resolved by analyst', 'analyst', 'round_off_charge'),
            ('BANK-MISS-LEDGER', 'medium', 'pending_approval', 400.00, 0, now + timedelta(hours=10), 'Corporate Gifting', 'INV-201', 'Gift invoice matched manually', 'analyst', 'manual_ledger_post'),
            ('BANK-MISS-BANK', 'medium', 'pending_approval', 950.00, 0, now + timedelta(hours=15), 'Vendor Lambda', 'INV-3321', 'Vendor accepted cheque delay', 'analyst', 'uncleared_cheque'),
            ('BANK-REF', 'low', 'pending_approval', 0.00, 0, now + timedelta(hours=30), 'Global Consultants', 'INV-999', 'Matched via name confirmation', 'analyst', 'manual_match_approved'),

            # 6 closed (approved & archived)
            ('BANK-AMT', 'medium', 'closed', 2.00, 0, now - timedelta(hours=12), 'Office Utilities', 'INV-88', 'Rounding adjustment approved', 'analyst', 'round_off_charge'),
            ('BANK-MISS-LEDGER', 'high', 'closed', 3200.00, 0, now - timedelta(hours=5), 'Customs Excise', 'DUTY-404', 'Duty paid correctly recorded', 'analyst', 'manual_ledger_post'),
            ('BANK-DATE', 'low', 'closed', 0.00, 3, now - timedelta(hours=20), 'Vendor Epsilon', 'INV-321', 'Cleared state checked', 'analyst', 'clearing_drift_accepted'),
            ('BANK-REF', 'low', 'closed', 0.00, 0, now - timedelta(hours=24), 'Audit Services Ltd', 'INV-6612', 'Correct reference matched', 'analyst', 'reference_updated'),
            ('BANK-MISS-BANK', 'medium', 'closed', 180.00, 0, now - timedelta(hours=36), 'Vendor Theta', 'INV-091', 'Voided bank payment entry', 'analyst', 'ledger_entry_reversed'),
            ('BANK-AMT', 'high', 'closed', 5000.00, 0, now - timedelta(hours=48), 'Prime Vendor Corp', 'INV-8090', 'Large dispute approved writeoff', 'manager', 'commercial_writeoff'),

            # 3 breached (past SLA, outstanding status)
            ('BANK-AMT', 'high', 'investigating', 2200.00, 0, now - timedelta(hours=6), 'Steel Industries', 'INV-5512', 'SLA breached amount mismatch', 'analyst'),
            ('BANK-MISS-LEDGER', 'high', 'investigating', 4500.00, 0, now - timedelta(hours=12), 'Vendor Alpha', 'INV-001', 'SLA breached ledger entry missing', 'analyst'),
            ('BANK-MISS-BANK', 'medium', 'routed', 1100.00, 0, now - timedelta(hours=24), 'Vendor Kappa', 'INV-729', 'Routed exception breached SLA', 'analyst'),

            # 2 high-severity BANK-DUP exceptions
            ('BANK-DUP', 'high', 'investigating', 3000.00, 0, now + timedelta(hours=4), 'Vendor Delta', 'INV-900', 'Duplicate billing invoice - A', 'analyst'),
            ('BANK-DUP', 'high', 'investigating', 3000.00, 0, now + timedelta(hours=4), 'Vendor Delta', 'INV-900', 'Duplicate billing invoice - B', 'analyst')
        ]

        for i, config in enumerate(exceptions_config):
            # Parse configuration
            code = config[0]
            severity = config[1]
            status = config[2]
            amt_diff = Decimal(str(config[3]))
            date_diff = config[4]
            deadline = config[5]
            party = config[6]
            ref = config[7]
            narration = config[8]
            
            assignee_role = config[9] if len(config) > 9 else None
            res_code = config[10] if len(config) > 10 else ''
            
            # Create dummy transaction items for side-by-side comparison
            bank_line = None
            ledger_entry = None
            source_ids = []
            
            txn_date = now.date() - timedelta(days=5)
            
            if code in ['BANK-AMT', 'BANK-DATE', 'BANK-REF', 'BANK-DUP']:
                # Mismatch - needs both sides
                bank_line = BankStatementLine.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date,
                    amount=Decimal('5000.00') + amt_diff if code == 'BANK-AMT' else Decimal('5000.00'),
                    reference=ref,
                    counterparty=party,
                    narration=narration,
                    raw_data={'txn_date': str(txn_date), 'amount': 5000.00, 'reference': ref}
                )
                
                ledger_entry = LedgerEntry.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date - timedelta(days=date_diff),
                    amount=Decimal('5000.00'),
                    reference=ref if code != 'BANK-REF' else f"{ref}-ledger-err",
                    counterparty=party,
                    account_type='bank',
                    raw_data={'txn_date': str(txn_date), 'amount': 5000.00, 'reference': ref}
                )
                source_ids = [str(bank_line.id), str(ledger_entry.id)]
                
            elif code == 'BANK-MISS-LEDGER':
                # Only exists in bank
                bank_line = BankStatementLine.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date,
                    amount=amt_diff,
                    reference=ref,
                    counterparty=party,
                    narration=narration,
                    raw_data={'txn_date': str(txn_date), 'amount': float(amt_diff), 'reference': ref}
                )
                source_ids = [str(bank_line.id)]
                
            elif code == 'BANK-MISS-BANK':
                # Only exists in ledger
                ledger_entry = LedgerEntry.objects.create(
                    entity=entity,
                    batch=batch,
                    txn_date=txn_date,
                    amount=amt_diff,
                    reference=ref,
                    counterparty=party,
                    account_type='bank',
                    raw_data={'txn_date': str(txn_date), 'amount': float(amt_diff), 'reference': ref}
                )
                source_ids = [str(ledger_entry.id)]

            # Create the exception record
            exc = ExceptionRecord.objects.create(
                entity=entity,
                reconciliation_type='bank',
                exception_code=code,
                severity=severity,
                status=status,
                source_record_ids=source_ids,
                amount_difference=amt_diff,
                date_difference=date_diff,
                confidence_score=Decimal('90.00'),
                context={
                    'bank_line_id': str(bank_line.id) if bank_line else None,
                    'ledger_entry_id': str(ledger_entry.id) if ledger_entry else None,
                    'reference': ref,
                    'counterparty': party,
                    'narration': narration
                },
                assigned_to=users.get(assignee_role) if assignee_role else None,
                sla_deadline=deadline,
                resolution_code=res_code,
                resolved_at=now if status in ['pending_approval', 'closed'] else None
            )
            
            # Create audit logs & comments
            AuditLog.objects.create(exception=exc, action='detected', metadata=exc.context)
            
            if assignee_role:
                AuditLog.objects.create(exception=exc, action='routed', user=users.get(assignee_role), metadata={'role': assignee_role})
                
            if status in ['pending_approval', 'closed']:
                AuditLog.objects.create(exception=exc, action='resolved', user=users.get('analyst'), metadata={'resolution_code': res_code})
                ExceptionComment.objects.create(exception=exc, user=users.get('analyst'), message=f"Identified core reason and marked as resolved under code: {res_code}")
                
            if status == 'closed':
                AuditLog.objects.create(exception=exc, action='approved', user=users.get('approver'), metadata={'note': 'Closing exception as verified'})
                ExceptionComment.objects.create(exception=exc, user=users.get('approver'), message="Verified exception resolution and closed record.")

        self.stdout.write('Database seeded successfully with 30 synthetic exceptions!')
