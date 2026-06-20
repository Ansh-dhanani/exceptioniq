from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    EntityViewSet, RoutingRuleViewSet, ExceptionViewSet,
    ReconciliationViewSet, UserViewSet, health, auth_login, auth_logout, me
)

router = DefaultRouter()
router.register('entities', EntityViewSet, basename='entities')
router.register('routing/rules', RoutingRuleViewSet, basename='routing-rules')
router.register('routing-rules', RoutingRuleViewSet, basename='routing-rules-alt')
router.register('exceptions', ExceptionViewSet, basename='exceptions')
router.register('recon', ReconciliationViewSet, basename='recon')
router.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('health/', health),
    path('auth/login/', auth_login, name='auth-login'),
    path('auth/logout/', auth_logout, name='auth-logout'),
    path('auth/me/', me, name='auth-me'),
    path('', include(router.urls)),
]
