from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.vendors.models import Vendor, VendorRiskScore
from apps.vendors.services import compute_vendor_risk
from apps.api.serializers import VendorSerializer
from apps.api.permissions import RolePermission

class VendorViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = Vendor.objects.all().select_related('risk_score').order_by('name')
    serializer_class = VendorSerializer
    filterset_fields = ['entity', 'payment_blocked']

    @action(detail=True, methods=['post'], url_path='block-payment')
    def block_payment(self, request, pk=None):
        vendor = self.get_object()
        vendor.payment_blocked = True
        vendor.save(update_fields=['payment_blocked', 'updated_at'])
        # Recompute risk in case status changes
        compute_vendor_risk(vendor)
        return Response(VendorSerializer(vendor).data)

    @action(detail=True, methods=['post'], url_path='unblock-payment')
    def unblock_payment(self, request, pk=None):
        vendor = self.get_object()
        vendor.payment_blocked = False
        vendor.save(update_fields=['payment_blocked', 'updated_at'])
        # Recompute risk
        compute_vendor_risk(vendor)
        return Response(VendorSerializer(vendor).data)

    @action(detail=False, methods=['post'], url_path='recompute-risk')
    def recompute_risk(self, request):
        vendors = Vendor.objects.all()
        recomputed = 0
        for v in vendors:
            compute_vendor_risk(v)
            recomputed += 1
        return Response({'status': 'success', 'recomputed': recomputed})
