from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_org, name='org-create'),
    path('invite/', views.generate_invite, name='org-invite'),
    path('join/', views.join_org, name='org-join'),
    path('members/', views.list_members, name='org-members'),
    path('invites/', views.list_invites, name='org-invites'),
    path('info/', views.org_info, name='org-info'),
]
