'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getInitials, getAvatarColor } from '@/lib/utils';
import { LayoutDashboard, FolderKanban, LogOut, Menu } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="loading-spinner" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { href: '/dashboard/projects', label: 'Projects', icon: <FolderKanban size={20} /> },
  ];

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <div className="layout">
      {sidebarOpen && <div className="modal-overlay" style={{ zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>TaskFlow</h1>
          <p>Team Task Manager</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar" style={{ background: getAvatarColor(user.name) }}>
            {getInitials(user.name)}
          </div>
          <div className="sidebar-user-info">
            <p>{user.name}</p>
            <span>{user.email}</span>
          </div>
          <button className="btn-ghost btn-icon" onClick={handleLogout} title="Logout">
            <LogOut size={18} className="tw:text-slate-400 hover:tw:text-white" />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <button
          className="btn-ghost btn-icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          id="mobile-menu-btn"
          style={{ display: 'none', marginBottom: 16 }}
        >
          <Menu size={24} />
        </button>
        {children}
      </main>
      <style jsx>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}
