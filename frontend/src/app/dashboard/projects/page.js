'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadProjects = async () => {
    try {
      const { data } = await api.get('/projects/');
      setProjects(Array.isArray(data) ? data : data.results || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    setCreating(true);
    setError('');
    try {
      await api.post('/projects/', form);
      setShowModal(false);
      setForm({ name: '', description: '' });
      loadProjects();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || 'Failed to create project.');
    }
    setCreating(false);
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            placeholder="Search projects..."
            style={{ width: 240 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📁</div>
          <h3>{search ? 'No matching projects' : 'No projects yet'}</h3>
          <p>{search ? 'Try a different search term.' : 'Create your first project to get started.'}</p>
          {!search && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Project</button>}
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map(p => {
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
                    <span className="progress-text">{progress}% · {p.task_count} tasks · {p.member_count} members</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Project</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {error && <div className="error-text">{error}</div>}
                <div className="input-group">
                  <label>Project Name</label>
                  <input className="input" placeholder="e.g. Marketing Campaign" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Description</label>
                  <textarea className="input" placeholder="What's this project about?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
