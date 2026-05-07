import { useState } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo completar la solicitud.';
}

export function LoginPage({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) return setError('Email requerido.');
    if (!EMAIL_PATTERN.test(email)) return setError('Email invalido.');
    if (!password) return setError('Password requerido.');

    setError('');
    setIsSubmitting(true);

    try {
      await onLogin({ email: email.trim(), password });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
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
        <div className="auth-sub">Sign in with your backend account</div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16, opacity: 0.55, cursor: 'not-allowed' }}
          type="button"
          disabled
          title="Proveedor OAuth no configurado"
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

export function RegisterPage({ onRegister, onBack }) {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleCreate = async () => {
    if (!form.email.trim() || !form.username.trim() || !form.password) {
      return setError('Todos los campos son requeridos.');
    }

    if (!EMAIL_PATTERN.test(form.email)) {
      return setError('Email invalido.');
    }

    if (form.password.length < 8) {
      return setError('El password debe tener al menos 8 caracteres.');
    }

    if (form.password !== form.confirm) {
      return setError('Los passwords no coinciden.');
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onRegister({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow" style={{ top: '-100px', right: '0' }} />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">S</div>
        </div>
        <div className="auth-title">Create your account</div>
        <div className="auth-sub">New accounts start as listeners</div>

        {(['email', 'username', 'password', 'confirm']).map((key, index) => (
          <div className="form-group" key={key}>
            <label className="form-label">
              {['Email', 'Username', 'Password', 'Confirm password'][index]}
            </label>
            <input
              type={key.includes('password') || key === 'confirm' ? 'password' : key === 'email' ? 'email' : 'text'}
              placeholder={
                [
                  'Enter your email',
                  'Choose a username',
                  'Create a password',
                  'Confirm your password',
                ][index]
              }
              value={form[key]}
              onChange={set(key)}
              autoComplete={key === 'confirm' ? 'new-password' : key}
            />
          </div>
        ))}

        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Account'}
        </button>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16, opacity: 0.55, cursor: 'not-allowed' }}
          type="button"
          disabled
          title="Proveedor OAuth no configurado"
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
