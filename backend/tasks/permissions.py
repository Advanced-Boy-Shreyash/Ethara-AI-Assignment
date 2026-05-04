from rest_framework import permissions
from projects.models import ProjectMember


class IsTaskOwnerOrAdmin(permissions.BasePermission):
    """
    Allow update if user is the task assignee, creator, or project admin.
    Allow delete only if user is project admin.
    Any project member can move tasks between statuses.
    """

    def has_permission(self, request, view):
        """Check that the user is at least a project member."""
        project_id = view.kwargs.get('project_id')
        if not project_id:
            return True
        return ProjectMember.objects.filter(
            user=request.user,
            project_id=project_id
        ).exists()

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any project member
        if request.method in permissions.SAFE_METHODS:
            return ProjectMember.objects.filter(
                user=request.user,
                project=obj.project
            ).exists()

        # Delete — admin only
        if request.method == 'DELETE':
            return ProjectMember.objects.filter(
                user=request.user,
                project=obj.project,
                role=ProjectMember.Role.ADMIN
            ).exists()

        # PATCH for status-only changes — any project member can do this
        if request.method == 'PATCH':
            patch_fields = set(request.data.keys())
            if patch_fields == {'status'}:
                return ProjectMember.objects.filter(
                    user=request.user,
                    project=obj.project
                ).exists()

        # Full update — assignee, creator, or admin
        if obj.assignee == request.user or obj.creator == request.user:
            return True

        return ProjectMember.objects.filter(
            user=request.user,
            project=obj.project,
            role=ProjectMember.Role.ADMIN
        ).exists()
