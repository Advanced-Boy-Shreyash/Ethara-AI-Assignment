from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from .models import Project, ProjectMember
from .serializers import (
    ProjectSerializer,
    ProjectDetailSerializer,
    ProjectMemberSerializer,
    AddMemberSerializer,
)
from .permissions import IsProjectMember, IsProjectAdmin

User = get_user_model()


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for project CRUD operations.

    list/create: any authenticated user
    retrieve: project members only
    update/delete: project admins only
    """
    serializer_class = ProjectSerializer

    def get_queryset(self):
        """Return only projects the user is a member of."""
        return Project.objects.filter(
            members__user=self.request.user
        ).distinct()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        return ProjectSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsProjectAdmin()]
        if self.action == 'retrieve':
            return [IsAuthenticated(), IsProjectMember()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Create project and add creator as ADMIN."""
        project = serializer.save(owner=self.request.user)
        ProjectMember.objects.create(
            user=self.request.user,
            project=project,
            role=ProjectMember.Role.ADMIN
        )

    # === Member management endpoints ===

    @action(detail=True, methods=['get', 'post'], url_path='members')
    def members(self, request, pk=None):
        project = self.get_object()

        if request.method == 'GET':
            members = ProjectMember.objects.filter(project=project)
            serializer = ProjectMemberSerializer(members, many=True)
            return Response(serializer.data)

        # POST — add member (admin only)
        admin_check = IsProjectAdmin()
        if not admin_check.has_permission(request, self):
            return Response(
                {'detail': 'Only project admins can add members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(email=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response(
                {'detail': 'No user found with this email address.', 'code': 'not_found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if ProjectMember.objects.filter(user=user, project=project).exists():
            return Response(
                {'detail': 'User is already a member of this project.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = ProjectMember.objects.create(
            user=user,
            project=project,
            role=serializer.validated_data['role']
        )
        return Response(
            ProjectMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=['delete', 'patch'],
        url_path='members/(?P<user_id>[^/.]+)'
    )
    def member_detail(self, request, pk=None, user_id=None):
        """Remove or update role of a project member."""
        project = self.get_object()

        admin_check = IsProjectAdmin()
        if not admin_check.has_permission(request, self):
            return Response(
                {'detail': 'Only project admins can manage members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        membership = get_object_or_404(
            ProjectMember,
            project=project,
            user_id=user_id
        )

        if request.method == 'DELETE':
            # Prevent removing the project owner
            if membership.user == project.owner:
                return Response(
                    {'detail': 'Cannot remove the project owner.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            membership.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if request.method == 'PATCH':
            role = request.data.get('role')
            if role not in dict(ProjectMember.Role.choices):
                return Response(
                    {'detail': 'Invalid role. Must be ADMIN or MEMBER.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            membership.role = role
            membership.save()
            return Response(ProjectMemberSerializer(membership).data)
