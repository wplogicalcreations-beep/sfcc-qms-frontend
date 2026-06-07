import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userSafeError } from '../utils/uiMessages';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(userSafeError(err, 'Login failed. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="login-brand-logo inline-flex items-center justify-center mb-4 shadow-xl">
            <img src="/silver-foundation-logo.png" alt="Silver Foundation Contracting Co. logo"
              style={{ maxHeight: '82px', width: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-black text-[var(--qms-sand)] tracking-wide">Quality Management System</h1>
          <p className="text-[color:color-mix(in_srgb,var(--qms-sand)_86%,white)] text-sm mt-1">Silver Foundation Contracting Co.</p>
          <p className="text-[color:color-mix(in_srgb,var(--qms-sand)_58%,white)] text-xs mt-0.5">Secure project quality and document control platform</p>
        </div>

        <div className="login-card rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Company Email Address</label>
              <input
                type="email" required autoFocus
                className="input"
                placeholder="yourname@silver-foundation.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-[var(--qms-charcoal)] hover:bg-[var(--qms-graphite)] text-[var(--qms-sand)] border border-[var(--qms-gold)] font-bold py-3 rounded-xl transition-colors mt-2 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-[var(--qms-graphite)] font-medium mb-2">Default credentials:</p>
            <div className="bg-[color:color-mix(in_srgb,var(--qms-sand)_45%,white)] rounded-lg p-3 text-xs text-[var(--qms-charcoal)] space-y-1 border border-[color:color-mix(in_srgb,var(--qms-soft-gold)_45%,white)]">
              <div>Admin: <span className="font-mono font-medium">admin@silverfoundation.sa</span> / <span className="font-mono">Admin@1234</span></div>
            </div>
          </div>
        </div>

        <p className="text-center text-[color:color-mix(in_srgb,var(--qms-sand)_64%,white)] text-xs mt-6">
          Quality Management System · © 2026 Silver Foundation Contracting Co.
        </p>
      </div>
    </div>
  );
}
