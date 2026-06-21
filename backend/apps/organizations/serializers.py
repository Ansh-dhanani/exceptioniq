from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Organization, InviteCode

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'code', 'created_by', 'created_at', 'member_count']
        read_only_fields = ['id', 'code', 'created_by', 'created_at', 'member_count']

    def get_member_count(self, obj):
        return obj.members.count()


class InviteCodeSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = InviteCode
        fields = ['id', 'code', 'organization', 'organization_name', 'created_by', 'role', 'is_used', 'used_by', 'created_at', 'expires_at']
        read_only_fields = ['id', 'code', 'organization', 'created_by', 'is_used', 'used_by', 'created_at']


class InviteCodeGenerateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[
        ('admin', 'Admin'),
        ('analyst', 'Analyst'),
        ('approver', 'Approver'),
        ('manager', 'Manager'),
        ('viewer', 'Viewer'),
    ])
    expires_in_hours = serializers.IntegerField(default=72, min_value=1, max_value=720)


class JoinOrgSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=64)


class CreateOrgSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)


class OrgMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'date_joined']
