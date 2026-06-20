from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.entities.models import Entity
from apps.close.models import MonthEndPeriod, CloseChecklistItem
from apps.close.services import generate_close_period
from apps.api.serializers import MonthEndPeriodSerializer, CloseChecklistItemSerializer
from apps.api.permissions import RolePermission

class CloseViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = MonthEndPeriod.objects.all().order_by('-period')
    serializer_class = MonthEndPeriodSerializer
    filterset_fields = ['entity', 'status', 'period']

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_checklist(self, request):
        entity_id = request.data.get('entity_id')
        period = request.data.get('period') # Format "YYYY-MM"

        if not entity_id or not period:
            return Response({'error': 'entity_id and period are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity = Entity.objects.get(id=entity_id)
        except Entity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            period_record = generate_close_period(entity, period)
            return Response(MonthEndPeriodSerializer(period_record).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['patch'], url_path='items/(?P<item_id>[^/.]+)/complete')
    def complete_item(self, request, pk=None, item_id=None):
        period = self.get_object()
        try:
            item = CloseChecklistItem.objects.get(period=period, id=item_id)
        except CloseChecklistItem.DoesNotExist:
            return Response({'error': 'Checklist item not found'}, status=status.HTTP_404_NOT_FOUND)

        is_complete = request.data.get('is_complete', True)
        
        if is_complete:
            item.is_complete = True
            item.completed_by = request.user
            item.completed_at = timezone.now()
        else:
            item.is_complete = False
            item.completed_by = None
            item.completed_at = None
            
        item.save()

        # Update period status to in_progress if not already, unless it's closed
        if period.status == 'open' and is_complete:
            period.status = 'in_progress'
            period.save(update_fields=['status', 'updated_at'])

        return Response(CloseChecklistItemSerializer(item).data)

    @action(detail=True, methods=['post'], url_path='close')
    def close_period(self, request, pk=None):
        period = self.get_object()
        
        if period.status == 'closed':
            return Response({'error': 'Period is already closed'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for incomplete critical items
        incomplete_critical = period.items.filter(is_critical=True, is_complete=False)
        if incomplete_critical.exists():
            titles = [item.title for item in incomplete_critical]
            return Response({
                'error': 'Cannot close period. Critical checklist items are incomplete.',
                'incomplete_critical_items': titles
            }, status=status.HTTP_400_BAD_REQUEST)

        period.status = 'closed'
        period.closed_by = request.user
        period.closed_at = timezone.now()
        period.save(update_fields=['status', 'closed_by', 'closed_at', 'updated_at'])

        return Response(MonthEndPeriodSerializer(period).data)
