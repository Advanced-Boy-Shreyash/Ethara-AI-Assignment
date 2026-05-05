'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { formatDate, isOverdue, getInitials, getAvatarColor, parseApiError } from '@/lib/utils';
import { ClipboardList, Zap, CheckCircle2, AlertTriangle, Calendar, FolderOpen, Eye } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, tasksRes, projectsRes] = await Promise.all([
          api.get('/tasks/dashboard/stats/'),
          api.get('/tasks/dashboard/my-tasks/'),
          api.get('/projects/'),
        ]);
        setStats(statsRes.data);
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data.results || []);
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data.results || []);
      } catch (err) {
        toast.error(parseApiError(err, 'Failed to load dashboard data.'));
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  const statCards = [
    { label: 'Total Tasks', value: stats?.total_tasks || 0, icon: <ClipboardList size={22} />, bg: 'var(--blue-bg)', color: 'var(--blue)' },
    { label: 'In Progress', value: stats?.in_progress || 0, icon: <Zap size={22} />, bg: 'var(--amber-bg)', color: 'var(--amber)' },
    { label: 'In Review', value: stats?.in_review || 0, icon: <Eye size={22} />, bg: 'rgba(168,85,247,0.12)', color: '#C084FC' },
    { label: 'Completed', value: stats?.done || 0, icon: <CheckCircle2 size={22} />, bg: 'var(--emerald-bg)', color: 'var(--emerald)' },
    { label: 'Overdue', value: stats?.overdue || 0, icon: <AlertTriangle size={22} />, bg: 'var(--rose-bg)', color: 'var(--rose)' },
  ];

  const todoTasks = tasks.filter(t => t.status === 'TODO');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const inReviewTasks = tasks.filter(t => t.status === 'IN_REVIEW');
  const doneTasks = tasks.filter(t => t.status === 'DONE');

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your tasks and projects</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {statCards.map(s => (
          <div key={s.label} className="stat-card slide-up">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            <FolderOpen size={20} /> Recent Projects
          </h2>
          <div className="project-grid">
            {projects.slice(0, 4).map(p => {
              const progress = p.task_count > 0 ? Math.round((p.completed_count / p.task_count) * 100) : 0;
              return (
                <Link href={`/dashboard/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card card-hover project-card">
                    <div className="project-card-header">
                      <h3>{p.name}</h3>
                      <span className={`badge badge-${p.my_role?.toLowerCase() || 'member'}`}>{p.my_role || 'Member'}</span>
                    </div>
                    <p>{p.description || 'No description'}</p>
                    <div className="project-card-footer">
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>
                      <span className="progress-text">{progress}% · {p.task_count} tasks</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Board */}
      <div className="section">
        <h2 className="section-title">
          <ClipboardList size={20} /> My Tasks
        </h2>
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <h3>No tasks yet</h3>
            <p>Create a project and add your first task to get started.</p>
            <Link href="/dashboard/projects" className="btn btn-primary">Go to Projects</Link>
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
                {col.items.map(task => (
                  <div key={task.id} className="task-card-item">
                    <h4>{task.title}</h4>
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
                ))}
                {col.items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: 20 }}>No tasks</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
