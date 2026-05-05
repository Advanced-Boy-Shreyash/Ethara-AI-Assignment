"""
Global exception handler for the Django REST Framework API.

Ensures every error response follows a consistent shape:
{
    "detail": "Human-readable message",
    "errors": { ... }       # optional field-level errors
    "code": "error_code"    # optional machine-readable code
}
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import (
    ValidationError as DRFValidationError,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
)

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Central error handler that normalises every API error into a predictable
    JSON envelope so the frontend can rely on a single parsing strategy.
    """

    # Let DRF handle the standard cases first
    response = exception_handler(exc, context)

    # ── Unhandled server errors (500) ──
    if response is None:
        # Django model ValidationError (not DRF)
        if isinstance(exc, DjangoValidationError):
            data = {
                'detail': 'Validation error.',
                'errors': exc.message_dict if hasattr(exc, 'message_dict') else {'non_field_errors': exc.messages},
                'code': 'validation_error',
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)

        # Log unexpected errors — never leak stack traces to the client
        view = context.get('view', None)
        logger.error(
            'Unhandled exception in %s: %s',
            view.__class__.__name__ if view else 'unknown',
            str(exc),
            exc_info=True,
        )
        data = {
            'detail': 'An unexpected error occurred. Please try again later.',
            'code': 'server_error',
        }
        return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ── Normalise DRF responses ──

    error_data = response.data

    # DRF ValidationError can return a list or a dict
    if isinstance(exc, DRFValidationError):
        if isinstance(error_data, list):
            response.data = {
                'detail': ' '.join(str(e) for e in error_data),
                'errors': {'non_field_errors': error_data},
                'code': 'validation_error',
            }
        elif isinstance(error_data, dict):
            # Build a human-readable summary from field errors
            messages = []
            for field, errs in error_data.items():
                if isinstance(errs, list):
                    for e in errs:
                        label = field.replace('_', ' ').title() if field != 'non_field_errors' else ''
                        messages.append(f'{label}: {e}'.strip(': ') if label else str(e))
                else:
                    messages.append(str(errs))
            response.data = {
                'detail': ' '.join(messages) if messages else 'Validation error.',
                'errors': error_data,
                'code': 'validation_error',
            }
        return response

    # Auth errors
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        response.data = {
            'detail': error_data.get('detail', 'Authentication required.'),
            'code': 'authentication_error',
        }
        return response

    # Permission errors
    if isinstance(exc, PermissionDenied):
        response.data = {
            'detail': error_data.get('detail', 'You do not have permission to perform this action.'),
            'code': 'permission_denied',
        }
        return response

    # Not found
    if isinstance(exc, (NotFound, Http404)):
        response.data = {
            'detail': error_data.get('detail', 'The requested resource was not found.'),
            'code': 'not_found',
        }
        return response

    # Fallback — wrap any remaining DRF errors
    if isinstance(error_data, dict) and 'detail' not in error_data:
        response.data = {
            'detail': str(error_data),
            'errors': error_data,
            'code': 'error',
        }

    return response
