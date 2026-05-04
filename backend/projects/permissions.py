from rest_framework import permissions
from .models import ProjectMember


class IsProjectMember(permissions.BasePermission):
    """Allow access only to members of the project."""

    def has_permission(self, request, view):
        project_id = view.kwargs.get('project_id') or view.kwargs.get('pk')
        if not project_id:
            return True
        return ProjectMember.objects.filter(
            user=request.user,
            project_id=project_id
        ).exists()


class IsProjectAdmin(permissions.BasePermission):
    """Allow access only to admins of the project."""

    def has_permission(self, request, view):
        project_id = view.kwargs.get('project_id') or view.kwargs.get('pk')
        if not project_id:
            return True
        return ProjectMember.objects.filter(
            user=request.user,
            project_id=project_id,
            role=ProjectMember.Role.ADMIN
        ).exists()


class IsProjectMemberOrAdmin(permissions.BasePermission):
    """
    Members can read; admins can read + write.
    """

    def has_permission(self, request, view):
        project_id = view.kwargs.get('project_id') or view.kwargs.get('pk')
        if not project_id:
            return True

        membership = ProjectMember.objects.filter(
            user=request.user,
            project_id=project_id
        ).first()

        if not membership:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return membership.role == ProjectMember.Role.ADMIN
