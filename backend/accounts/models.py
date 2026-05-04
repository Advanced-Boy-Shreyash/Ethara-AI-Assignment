from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with a name field."""
    name = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(unique=True)

    # Use email for authentication instead of username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return self.name or self.email
