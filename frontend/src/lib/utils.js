export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getAvatarColor(name) {
  const colors = ['#6366F1','#10B981','#F59E0B','#F43F5E','#8B5CF6','#06B6D4','#EC4899','#14B8A6'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === 'DONE') return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export const statusLabels = { TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done' };
export const priorityLabels = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

/**
 * Extract a user-friendly error message from an Axios error.
 * Works with the backend's { detail, errors, code } envelope.
 */
export function parseApiError(err, fallback = 'Something went wrong. Please try again.') {
  // No response — network issue
  if (!err.response) {
    if (err.code === 'ERR_NETWORK') return 'Unable to reach the server. Check your internet connection.';
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    return fallback;
  }

  const data = err.response.data;

  // Backend returns { detail: "..." }
  if (data?.detail && typeof data.detail === 'string') {
    return data.detail;
  }

  // Field-level errors: { errors: { email: ["..."], name: ["..."] } }
  if (data?.errors && typeof data.errors === 'object') {
    const messages = [];
    for (const [field, errs] of Object.entries(data.errors)) {
      const label = field === 'non_field_errors' ? '' : field.replace(/_/g, ' ');
      const errList = Array.isArray(errs) ? errs : [errs];
      errList.forEach(e => {
        messages.push(label ? `${label}: ${e}` : String(e));
      });
    }
    return messages.join(' ') || fallback;
  }

  // Legacy DRF — plain dict of { field: ["error"] }
  if (typeof data === 'object' && data !== null) {
    const messages = [];
    for (const [field, errs] of Object.entries(data)) {
      if (field === 'detail') continue;
      const errList = Array.isArray(errs) ? errs : [errs];
      errList.forEach(e => messages.push(String(e)));
    }
    if (messages.length) return messages.join(' ');
  }

  // String response
  if (typeof data === 'string') return data;

  // HTTP status fallbacks
  const statusMap = {
    400: 'Invalid request. Please check your input.',
    401: 'Session expired. Please log in again.',
    403: 'You don\'t have permission to do this.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with existing data.',
    429: 'Too many requests. Please slow down.',
    500: 'Server error. Please try again later.',
  };
  return statusMap[err.response.status] || fallback;
}
