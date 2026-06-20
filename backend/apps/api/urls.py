from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    EntityViewSet, RoutingRuleViewSet, ExceptionViewSet,
    ReconciliationViewSet, UserViewSet, health, auth_login, auth_logout, me
)
from apps.gst.views import GSTViewSet
from apps.tds.views import TDSViewSet
from apps.vendors.views import VendorViewSet
from apps.close.views import CloseViewSet
from apps.integrations.views import IntegrationsViewSet, SyncJobViewSet

router = DefaultRouter()
router.register('entities', EntityViewSet, basename='entities')
router.register('routing/rules', RoutingRuleViewSet, basename='routing-rules')
router.register('routing-rules', RoutingRuleViewSet, basename='routing-rules-alt')
router.register('exceptions', ExceptionViewSet, basename='exceptions')
router.register('recon', ReconciliationViewSet, basename='recon')
router.register('users', UserViewSet, basename='users')

# Phase 3 router registrations
router.register('gst', GSTViewSet, basename='gst')
router.register('tds', TDSViewSet, basename='tds')
router.register('vendors', VendorViewSet, basename='vendors')
router.register('close', CloseViewSet, basename='close')
router.register('integrations/jobs', SyncJobViewSet, basename='integrations-jobs')
router.register('integrations', IntegrationsViewSet, basename='integrations')

urlpatterns = [
    path('health/', health),
    path('auth/login/', auth_login, name='auth-login'),
    path('auth/logout/', auth_logout, name='auth-logout'),
    path('auth/me/', me, name='auth-me'),
    path('', include(router.urls)),
]
