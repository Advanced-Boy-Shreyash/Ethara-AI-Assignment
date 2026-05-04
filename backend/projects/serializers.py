from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Project, ProjectMember

User = get_user_model()


class MemberUserSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for member listings."""

    class Meta:
        model = User
        fields = ['id', 'name', 'email']


class ProjectMemberSerializer(serializers.ModelSerializer):
    """Serializer for project membership."""
    user = MemberUserSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for projects with computed stats."""
    owner = MemberUserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'owner',
            'member_count', 'task_count', 'completed_count',
            'my_role', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_completed_count(self, obj):
        return obj.tasks.filter(status='DONE').count()

    def get_my_role(self, obj):
        request = self.context.get('request')
        if request and request.user:
            membership = obj.members.filter(user=request.user).first()
            return membership.role if membership else None
        return None


class ProjectDetailSerializer(ProjectSerializer):
    """Detailed project serializer including members list."""
    members = ProjectMemberSerializer(many=True, read_only=True)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ['members']


class AddMemberSerializer(serializers.Serializer):
    """Serializer for adding a member to a project."""
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.MEMBER
    )

    def validate_email(self, value):
        try:
            User.objects.get(email=value.lower())
        except User.DoesNotExist:
            raise serializers.ValidationError("No user found with this email.")
        return value.lower()
