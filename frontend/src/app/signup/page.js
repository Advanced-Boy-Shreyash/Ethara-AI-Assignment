'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { parseApiError } from '@/lib/utils';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signup(name, email, password, confirmPassword);
      router.push('/dashboard');
    } catch (err) {
      setError(parseApiError(err, 'Something went wrong. Please try again.'));
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <h1>TaskFlow</h1>
          <p>Join your team and start managing projects efficiently today.</p>
        </div>
      </div>
      <div className="auth-right">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Create account</h2>
          <p className="subtitle">Get started with TaskFlow for free</p>
          {error && <div className="toast-error" style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 8, fontSize: '0.85rem' }}>{error}</div>}
          <div className="form-fields">
            <div className="input-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" className="input" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" className="input" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input id="confirm-password" type="password" className="input" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
          <p className="auth-footer">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
