import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Organization, InviteCode
from .serializers import (
    OrganizationSerializer, InviteCodeSerializer,
    InviteCodeGenerateSerializer, JoinOrgSerializer,
    CreateOrgSerializer, OrgMemberSerializer
)

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_org(request):
    user = request.user
    if user.role != 'manager':
        return Response({'error': 'Only managers can create organizations.'}, status=status.HTTP_403_FORBIDDEN)
    if user.organization:
        return Response({'error': 'You already belong to an organization.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = CreateOrgSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    name = serializer.validated_data['name']

    code = name.lower().replace(' ', '-')[:50]
    base_code = code
    suffix = 1
    while Organization.objects.filter(code=code).exists():
        code = f"{base_code}-{suffix}"
        suffix += 1

    with transaction.atomic():
        org = Organization.objects.create(name=name, code=code, created_by=user)
        user.organization = org
        user.save(update_fields=['organization'])

    return Response(OrganizationSerializer(org).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_invite(request):
    user = request.user
    if user.role != 'manager':
        return Response({'error': 'Only managers can generate invites.'}, status=status.HTTP_403_FORBIDDEN)
    if not user.organization:
        return Response({'error': 'You must create an organization first.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = InviteCodeGenerateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    role = serializer.validated_data['role']
    expires_in = serializer.validated_data['expires_in_hours']

    code = secrets.token_urlsafe(16)
    invite = InviteCode.objects.create(
        code=code,
        organization=user.organization,
        created_by=user,
        role=role,
        expires_at=timezone.now() + timedelta(hours=expires_in)
    )

    return Response(InviteCodeSerializer(invite).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_org(request):
    serializer = JoinOrgSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    code = serializer.validated_data['code']
    try:
        invite = InviteCode.objects.select_related('organization').get(code=code, is_used=False)
    except InviteCode.DoesNotExist:
        return Response({'error': 'Invalid or already used invite code.'}, status=status.HTTP_400_BAD_REQUEST)

    if invite.expires_at < timezone.now():
        return Response({'error': 'This invite code has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if user.organization:
        return Response({'error': 'You already belong to an organization.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        invite.is_used = True
        invite.used_by = user
        invite.save(update_fields=['is_used', 'used_by'])
        user.organization = invite.organization
        user.role = invite.role
        user.save(update_fields=['organization', 'role'])

    return Response({
        'organization': OrganizationSerializer(invite.organization).data,
        'role': user.role,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_members(request):
    user = request.user
    if not user.organization:
        return Response({'error': 'No organization found.'}, status=status.HTTP_400_BAD_REQUEST)
    if user.role != 'manager':
        return Response({'error': 'Only managers can view members.'}, status=status.HTTP_403_FORBIDDEN)

    members = User.objects.filter(organization=user.organization).order_by('date_joined')
    return Response(OrgMemberSerializer(members, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_invites(request):
    user = request.user
    if not user.organization:
        return Response({'error': 'No organization found.'}, status=status.HTTP_400_BAD_REQUEST)
    if user.role != 'manager':
        return Response({'error': 'Only managers can view invites.'}, status=status.HTTP_403_FORBIDDEN)

    invites = InviteCode.objects.filter(organization=user.organization).order_by('-created_at')
    return Response(InviteCodeSerializer(invites, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def org_info(request):
    user = request.user
    if not user.organization:
        return Response({'organization': None})
    return Response(OrganizationSerializer(user.organization).data)
