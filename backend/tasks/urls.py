from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectTaskViewSet, dashboard_stats, my_tasks

router = DefaultRouter()
router.register(
    r'projects/(?P<project_id>\d+)/tasks',
    ProjectTaskViewSet,
    basename='project-task'
)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('dashboard/my-tasks/', my_tasks, name='dashboard-my-tasks'),
]
