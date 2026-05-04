from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Q

from .models import Task
from .serializers import TaskSerializer
from .permissions import IsTaskOwnerOrAdmin
from projects.models import Project, ProjectMember


class ProjectTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for tasks within a project.

    list/create: any project member
    update: assignee, creator, or admin
    delete: admin only
    """
    serializer_class = TaskSerializer

    def get_queryset(self):
        project_id = self.kwargs.get('project_id')
        queryset = Task.objects.filter(project_id=project_id)

        # Apply filters
        status_filter = self.request.query_params.get('status')
        priority_filter = self.request.query_params.get('priority')
        assignee_filter = self.request.query_params.get('assignee')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if assignee_filter:
            queryset = queryset.filter(assignee_id=assignee_filter)

        return queryset

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsTaskOwnerOrAdmin()]
        return [IsAuthenticated()]

    def check_membership(self, request, project_id):
        """Verify the user is a project member."""
        if not ProjectMember.objects.filter(
            user=request.user,
            project_id=project_id
        ).exists():
            return False
        return True

    def list(self, request, *args, **kwargs):
        project_id = self.kwargs.get('project_id')
        if not self.check_membership(request, project_id):
            return Response(
                {'detail': 'You are not a member of this project.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        project_id = self.kwargs.get('project_id')
        if not self.check_membership(request, project_id):
            return Response(
                {'detail': 'You are not a member of this project.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['project_id'] = self.kwargs.get('project_id')
        return context

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_id')
        serializer.save(
            project_id=project_id,
            creator=self.request.user
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get aggregated dashboard statistics for the current user."""
    user = request.user
    today = timezone.now().date()

    # Get all projects user is a member of
    project_ids = ProjectMember.objects.filter(
        user=user
    ).values_list('project_id', flat=True)

    # Get user's tasks across all projects
    my_tasks = Task.objects.filter(
        Q(assignee=user) | Q(creator=user),
        project_id__in=project_ids
    ).distinct()

    total_tasks = my_tasks.count()
    todo_count = my_tasks.filter(status=Task.Status.TODO).count()
    in_progress_count = my_tasks.filter(status=Task.Status.IN_PROGRESS).count()
    in_review_count = my_tasks.filter(status=Task.Status.IN_REVIEW).count()
    done_count = my_tasks.filter(status=Task.Status.DONE).count()
    overdue_count = my_tasks.filter(
        due_date__lt=today
    ).exclude(status=Task.Status.DONE).count()

    return Response({
        'total_tasks': total_tasks,
        'todo': todo_count,
        'in_progress': in_progress_count,
        'in_review': in_review_count,
        'done': done_count,
        'overdue': overdue_count,
        'total_projects': len(project_ids),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_tasks(request):
    """Get current user's tasks across all projects."""
    user = request.user

    project_ids = ProjectMember.objects.filter(
        user=user
    ).values_list('project_id', flat=True)

    tasks = Task.objects.filter(
        Q(assignee=user) | Q(creator=user),
        project_id__in=project_ids
    ).distinct().select_related('project', 'assignee', 'creator')

    status_filter = request.query_params.get('status')
    if status_filter:
        tasks = tasks.filter(status=status_filter)

    serializer = TaskSerializer(tasks, many=True)
    return Response(serializer.data)
