from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.entities.models import Entity
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from apps.exceptions_app.models import ExceptionRecord, ExceptionComment, AuditLog
from apps.routing.models import RoutingRule

# Phase 3 model imports
from apps.gst.models import GSTR2BRecord, PurchaseRegisterEntry, GSTReconciliationRun
from apps.tds.models import Form26ASEntry, TDSLedgerEntry, TDSReconciliationRun
from apps.vendors.models import Vendor, VendorRiskScore
from apps.close.models import MonthEndPeriod, CloseChecklistItem
from apps.integrations.models import SyncJob

User = get_user_model()

class EntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        fields = '__all__'

class BatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        fields = '__all__'

class LedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerEntry
        fields = '__all__'

class BankStatementLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementLine
        fields = '__all__'

class RoutingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutingRule
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']

class AuditLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = AuditLog
        fields = '__all__'

class ExceptionCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = ExceptionComment
        fields = '__all__'

class ExceptionRecordSerializer(serializers.ModelSerializer):
    comments = ExceptionCommentSerializer(many=True, read_only=True)
    audit_logs = AuditLogSerializer(many=True, read_only=True)
    assigned_to = UserSerializer(read_only=True)

    class Meta:
        model = ExceptionRecord
        fields = '__all__'


# GST Serializers
class GSTR2BRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GSTR2BRecord
        fields = '__all__'

class PurchaseRegisterEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRegisterEntry
        fields = '__all__'

class GSTReconciliationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = GSTReconciliationRun
        fields = '__all__'


# TDS Serializers
class Form26ASEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Form26ASEntry
        fields = '__all__'

class TDSLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TDSLedgerEntry
        fields = '__all__'

class TDSReconciliationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = TDSReconciliationRun
        fields = '__all__'


# Vendor Serializers
class VendorRiskScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorRiskScore
        fields = '__all__'

class VendorSerializer(serializers.ModelSerializer):
    risk_score = VendorRiskScoreSerializer(read_only=True)

    class Meta:
        model = Vendor
        fields = '__all__'


# Close Checklist Serializers
class CloseChecklistItemSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(read_only=True)
    completed_by = UserSerializer(read_only=True)

    class Meta:
        model = CloseChecklistItem
        fields = '__all__'

class MonthEndPeriodSerializer(serializers.ModelSerializer):
    items = CloseChecklistItemSerializer(many=True, read_only=True)
    closed_by = UserSerializer(read_only=True)

    class Meta:
        model = MonthEndPeriod
        fields = '__all__'


# Integrations Serializers
class SyncJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncJob
        fields = '__all__'

