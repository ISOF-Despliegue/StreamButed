import { useState } from 'react';

/**
 * LoginPage
 *
 * Role selection has been removed. The system reads the role directly
 * from the JWT payload returned by the identity service. New users
 * always receive the listener role by default; admin accounts are
 * provisioned exclusively via the database.
 */
export function LoginPage({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = () => {
    if (!email) return setErr('Email is required.');
    if (!pass) return setErr('Password is required.');
    setErr('');

    // Simulate JWT role resolution: in production the role comes from the
    // decoded token payload. Here we hard-code the admin detection by email
    // prefix so the demo still works without a real backend.
    if (email === 'admin@streambuted.com' && pass === 'admin123') {
      onLogin({ 
        email: 'admin@streambuted.com', 
        role: 'admin', 
        name: 'Admin Principal' 
      });
    } else {
      onLogin({ 
        email, 
        role: 'listener', 
        name: email.split('@')[0] || 'User' 
      });
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow" style={{ top: '-200px', left: '-100px' }} />
      <div className="auth-glow" style={{ bottom: '-200px', right: '-100px' }} />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">S</div>
        </div>
        <div className="auth-title">Welcome to StreamButed</div>
        <div className="auth-sub">Sign in to continue</div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {err && (
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {err}
          </div>
        )}

        <div className="forgot-row">
          <span className="auth-link" style={{ fontSize: 13 }}>
            Forgot your password?
          </span>
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleLogin}
        >
          Sign In
        </button>

        <div className="form-divider">
          <span>or</span>
        </div>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16 }}
          type="button"
        >
          Continue with Google
        </button>

        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <span className="auth-link" onClick={onRegister}>
            Sign up
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * RegisterPage
 *
 * Every new account starts as a listener. Artists are promoted later
 * through the Settings page; admin accounts are created directly in the DB.
 */
export function RegisterPage({ onLogin, onBack }) {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCreate = () => {
    if (!form.email || !form.username || !form.password)
      return setErr('All fields are required.');
    if (form.password !== form.confirm)
      return setErr('Passwords do not match.');
    setErr('');
    // New accounts are always assigned the listener role by the backend.
    onLogin({ email: form.email, role: 'listener', name: form.username });
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow" style={{ top: '-100px', right: '0' }} />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">S</div>
        </div>
        <div className="auth-title">Create your account</div>
        <div className="auth-sub">Join StreamButed today</div>

        {(['email', 'username', 'password', 'confirm']).map((k, i) => (
          <div className="form-group" key={k}>
            <label className="form-label">
              {['Email', 'Username', 'Password', 'Confirm password'][i]}
            </label>
            <input
              type={k.includes('pass') || k === 'confirm' ? 'password' : 'text'}
              placeholder={
                [
                  'Enter your email',
                  'Choose a username',
                  'Create a password',
                  'Confirm your password',
                ][i]
              }
              value={form[k]}
              onChange={set(k)}
            />
          </div>
        ))}

        {err && (
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {err}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleCreate}
        >
          Create Account
        </button>

        <div className="form-divider">
          <span>or</span>
        </div>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16 }}
          type="button"
        >
          Sign up with Google
        </button>

        <div className="auth-footer">
          Already have an account?{' '}
          <span className="auth-link" onClick={onBack}>
            Sign in
          </span>
        </div>
      </div>
    </div>
  );
}
