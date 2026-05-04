from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Task
from projects.models import ProjectMember

User = get_user_model()


class TaskUserSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for task assignee/creator."""

    class Meta:
        model = User
        fields = ['id', 'name', 'email']


class TaskSerializer(serializers.ModelSerializer):
    """Serializer for tasks with nested user info."""
    assignee = TaskUserSerializer(read_only=True)
    creator = TaskUserSerializer(read_only=True)
    assignee_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'due_date', 'project', 'assignee', 'assignee_id',
            'creator', 'is_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'project', 'creator', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        from django.utils import timezone
        if obj.due_date and obj.status != Task.Status.DONE:
            return obj.due_date < timezone.now().date()
        return False

    def validate_assignee_id(self, value):
        if value is None:
            return value
        project_id = self.context.get('project_id')
        if project_id:
            if not ProjectMember.objects.filter(
                user_id=value,
                project_id=project_id
            ).exists():
                raise serializers.ValidationError(
                    "Assignee must be a member of the project."
                )
        return value

    def validate_status(self, value):
        if value not in dict(Task.Status.choices):
            raise serializers.ValidationError("Invalid status.")
        return value

    def validate_priority(self, value):
        if value not in dict(Task.Priority.choices):
            raise serializers.ValidationError("Invalid priority.")
        return value

    def create(self, validated_data):
        assignee_id = validated_data.pop('assignee_id', None)
        if assignee_id:
            validated_data['assignee_id'] = assignee_id
        return super().create(validated_data)

    def update(self, instance, validated_data):
        assignee_id = validated_data.pop('assignee_id', None)
        if assignee_id is not None:
            instance.assignee_id = assignee_id
        return super().update(instance, validated_data)
