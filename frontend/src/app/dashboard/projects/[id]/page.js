'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate, isOverdue, getInitials, getAvatarColor } from '@/lib/utils';
import {
  Play, Eye, CheckCircle2, RotateCcw, Trash2, Plus, Users,
  ListTodo, Calendar, ChevronLeft, ChevronRight, Undo2, AlertTriangle
} from 'lucide-react';

/* ── Reusable Confirmation Modal ── */
function ConfirmModal({ open, title, message, icon, confirmLabel, confirmColor, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: confirmColor === 'danger' ? 'var(--rose-bg)' : 'rgba(99,102,241,0.12)',
            color: confirmColor === 'danger' ? 'var(--rose)' : 'var(--accent)',
            marginBottom: 4
          }}>
            {icon}
          </div>
          <h2 style={{ fontSize: '1.15rem' }}>{title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ minWidth: 100 }}>Cancel</button>
          <button
            className={`btn ${confirmColor === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            style={{ minWidth: 100 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage({ params }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', due_date: '', assignee_id: '' });
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', icon: null, confirmLabel: '', confirmColor: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));
  const isAdmin = project?.my_role === 'ADMIN';

  const statusOrder = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const statusLabels = { TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done' };

  const loadData = async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/projects/${id}/`),
        api.get(`/tasks/projects/${id}/tasks/`),
      ]);
      setProject(projRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data.results || []);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 404 || err.response?.status === 403) router.push('/dashboard/projects');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) { setError('Task title is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...taskForm };
      if (!payload.assignee_id) delete payload.assignee_id;
      else payload.assignee_id = parseInt(payload.assignee_id);
      if (!payload.due_date) delete payload.due_date;

      if (editingTask) {
        await api.put(`/tasks/projects/${id}/tasks/${editingTask.id}/`, payload);
      } else {
        await api.post(`/tasks/projects/${id}/tasks/`, payload);
      }
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', due_date: '', assignee_id: '' });
      setEditingTask(null);
      loadData();
    } catch (err) {
      const data = err.response?.data;
      setError(data ? (typeof data === 'string' ? data : Object.values(data).flat().join(' ')) : 'Failed to save task.');
    }
    setSaving(false);
  };

  const doStatusChange = async (task, newStatus) => {
    try {
      await api.patch(`/tasks/projects/${id}/tasks/${task.id}/`, { status: newStatus });
      loadData();
    } catch (err) {
      console.error('Status change failed:', err);
    }
  };

  const handleMoveForward = (task) => {
    const currentIdx = statusOrder.indexOf(task.status);
    if (currentIdx < statusOrder.length - 1) {
      doStatusChange(task, statusOrder[currentIdx + 1]);
    }
  };

  const handleMoveBack = (task) => {
    const currentIdx = statusOrder.indexOf(task.status);
    if (currentIdx > 0) {
      const prevStatus = statusOrder[currentIdx - 1];
      setConfirmModal({
        open: true,
        title: 'Move Back?',
        message: `Move "${task.title}" back to ${statusLabels[prevStatus]}?`,
        icon: <Undo2 size={26} />,
        confirmLabel: `Move to ${statusLabels[prevStatus]}`,
        confirmColor: 'primary',
        onConfirm: () => { closeConfirm(); doStatusChange(task, prevStatus); },
      });
    }
  };

  const handleDeleteTask = (task) => {
    setConfirmModal({
      open: true,
      title: 'Delete Task?',
      message: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      icon: <AlertTriangle size={26} />,
      confirmLabel: 'Delete',
      confirmColor: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          await api.delete(`/tasks/projects/${id}/tasks/${task.id}/`);
          loadData();
        } catch (err) {
          console.error('Delete failed:', err);
        }
      },
    });
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post(`/projects/${id}/members/`, { email: memberEmail, role: memberRole });
      setShowMemberModal(false);
      setMemberEmail('');
      setMemberRole('MEMBER');
      loadData();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.detail || data?.email?.[0] || 'Failed to add member.');
    }
    setSaving(false);
  };

  const handleRemoveMember = (member) => {
    setConfirmModal({
      open: true,
      title: 'Remove Member?',
      message: `Remove ${member.user.name} from this project? They will lose access to all project tasks.`,
      icon: <AlertTriangle size={26} />,
      confirmLabel: 'Remove',
      confirmColor: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          await api.delete(`/projects/${id}/members/${member.user.id}/`);
          loadData();
        } catch (err) { console.error(err); }
      },
    });
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/projects/${id}/members/${userId}/`, { role: newRole });
      loadData();
    } catch (err) { console.error(err); }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      due_date: task.due_date || '',
      assignee_id: task.assignee?.id?.toString() || '',
    });
    setError('');
    setShowTaskModal(true);
  };

  const openNewTask = () => {
    setEditingTask(null);
    setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', due_date: '', assignee_id: '' });
    setError('');
    setShowTaskModal(true);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!project) return null;

  const members = project.members || [];
  const todoTasks = tasks.filter(t => t.status === 'TODO');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const inReviewTasks = tasks.filter(t => t.status === 'IN_REVIEW');
  const doneTasks = tasks.filter(t => t.status === 'DONE');

  const getForwardIcon = (status) => {
    switch(status) {
      case 'TODO':        return <Play size={15} />;
      case 'IN_PROGRESS': return <Eye size={15} />;
      case 'IN_REVIEW':   return <CheckCircle2 size={15} />;
      default:            return null;
    }
  };

  const getForwardBtnClass = (status) => {
    switch(status) {
      case 'TODO':        return 'icon-btn icon-btn-move';
      case 'IN_PROGRESS': return 'icon-btn icon-btn-review';
      case 'IN_REVIEW':   return 'icon-btn icon-btn-done';
      default:            return 'icon-btn icon-btn-move';
    }
  };

  const getForwardTooltip = (status) => {
    switch(status) {
      case 'TODO':        return 'Start → In Progress';
      case 'IN_PROGRESS': return 'Send → In Review';
      case 'IN_REVIEW':   return 'Mark → Done';
      default:            return '';
    }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/projects')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h1>{project.name}</h1>
            {isAdmin && <span className="badge badge-admin">Admin</span>}
          </div>
          <p>{project.description || 'No description'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setShowMemberModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} /> Add Member
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openNewTask} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Add Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListTodo size={16} /> Tasks ({tasks.length})
        </button>
        <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} /> Members ({members.length})
        </button>
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        tasks.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>No tasks yet</h3>
            <p>Create your first task for this project.</p>
            <button className="btn btn-primary" onClick={openNewTask}>Add Task</button>
          </div>
        ) : (
          <div className="task-columns">
            {[
              { key: 'TODO', label: 'To Do', items: todoTasks, color: 'var(--blue)' },
              { key: 'IN_PROGRESS', label: 'In Progress', items: inProgressTasks, color: 'var(--amber)' },
              { key: 'IN_REVIEW', label: 'In Review', items: inReviewTasks, color: '#C084FC' },
              { key: 'DONE', label: 'Done', items: doneTasks, color: 'var(--emerald)' },
            ].map(col => (
              <div key={col.key} className="task-column">
                <div className="task-column-header">
                  <h3 style={{ color: col.color }}>{col.label}</h3>
                  <span className="task-column-count">{col.items.length}</span>
                </div>
                {col.items.map(task => {
                  const currentIdx = statusOrder.indexOf(task.status);
                  const canMoveForward = currentIdx < statusOrder.length - 1;
                  const canMoveBack = currentIdx > 0;

                  return (
                    <div key={task.id} className="task-card-item" onClick={() => openEditTask(task)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ flex: 1 }}>{task.title}</h4>
                        <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                          {/* Move Back Button */}
                          {canMoveBack && (
                            <button
                              className="icon-btn icon-btn-reset"
                              title={`Move back to ${statusLabels[statusOrder[currentIdx - 1]]}`}
                              onClick={(e) => { e.stopPropagation(); handleMoveBack(task); }}
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                          {/* Move Forward Button */}
                          {canMoveForward && (
                            <button
                              className={getForwardBtnClass(task.status)}
                              title={getForwardTooltip(task.status)}
                              onClick={(e) => { e.stopPropagation(); handleMoveForward(task); }}
                            >
                              {getForwardIcon(task.status)}
                            </button>
                          )}
                          {/* Delete Button */}
                          {isAdmin && (
                            <button
                              className="icon-btn icon-btn-delete"
                              title="Delete task"
                              onClick={(e) => { e.stopPropagation(); handleDeleteTask(task); }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {task.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>{task.description.slice(0, 80)}{task.description.length > 80 ? '...' : ''}</p>}
                      <div className="task-card-meta">
                        <span className={`badge badge-${task.priority?.toLowerCase()}`}>{task.priority}</span>
                        {task.assignee && (
                          <div className="avatar avatar-sm" style={{ background: getAvatarColor(task.assignee.name) }} title={task.assignee.name}>
                            {getInitials(task.assignee.name)}
                          </div>
                        )}
                        {task.due_date && (
                          <span className={`task-due ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: 20 }}>No tasks</p>}
              </div>
            ))}
          </div>
        )
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="member-list">
          {members.map(m => (
            <div key={m.id} className="member-item">
              <div className="avatar" style={{ background: getAvatarColor(m.user.name) }}>{getInitials(m.user.name)}</div>
              <div className="member-info">
                <p>{m.user.name} {m.user.id === user?.id ? '(You)' : ''}</p>
                <span>{m.user.email}</span>
              </div>
              <span className={`badge badge-${m.role.toLowerCase()}`}>{m.role}</span>
              {isAdmin && m.user.id !== project.owner?.id && (
                <div className="member-actions">
                  <select
                    className="input"
                    style={{ width: 110, padding: '4px 8px', fontSize: '0.8rem' }}
                    value={m.role}
                    onChange={e => handleRoleChange(m.user.id, e.target.value)}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m)}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        icon={confirmModal.icon}
        confirmLabel={confirmModal.confirmLabel}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'New Task'}</h2>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                {error && <div className="error-text">{error}</div>}
                <div className="input-group">
                  <label>Title</label>
                  <input className="input" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Description</label>
                  <textarea className="input" placeholder="Task description..." value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label>Priority</label>
                    <select className="input" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Status</label>
                    <select className="input" value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value})}>
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label>Due Date</label>
                    <input type="date" className="input" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Assignee</label>
                    <select className="input" value={taskForm.assignee_id} onChange={e => setTaskForm({...taskForm, assignee_id: e.target.value})}>
                      <option value="">Unassigned</option>
                      {members.map(m => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Member</h2>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                {error && <div className="error-text">{error}</div>}
                <div className="input-group">
                  <label>Member Email</label>
                  <input className="input" type="email" placeholder="colleague@example.com" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select className="input" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                    <option value="MEMBER">Member — can view & create tasks</option>
                    <option value="ADMIN">Admin — full project control</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
