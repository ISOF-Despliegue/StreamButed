import { useState } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 320;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

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
    const normalizedEmail = email.trim();

    if (!normalizedEmail) return setError('Email requerido.');
    if (normalizedEmail.length > EMAIL_MAX_LENGTH) return setError('Email supera 320 caracteres.');
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setError('Email invalido.');
    if (!password) return setError('Password requerido.');
    if (password.length > PASSWORD_MAX_LENGTH) return setError('Password supera 128 caracteres.');

    setError('');
    setIsSubmitting(true);

    try {
      await onLogin({ email: normalizedEmail, password });
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
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
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
    const normalizedEmail = form.email.trim();
    const normalizedUsername = form.username.trim();

    if (!normalizedEmail || !normalizedUsername || !form.password) {
      return setError('Todos los campos son requeridos.');
    }

    if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
      return setError('El email no puede superar 320 caracteres.');
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return setError('Email invalido.');
    }

    if (normalizedUsername.length < USERNAME_MIN_LENGTH || normalizedUsername.length > USERNAME_MAX_LENGTH) {
      return setError('El username debe tener entre 3 y 50 caracteres.');
    }

    if (form.password.length < PASSWORD_MIN_LENGTH || form.password.length > PASSWORD_MAX_LENGTH) {
      return setError('El password debe tener entre 8 y 128 caracteres.');
    }

    if (form.password !== form.confirm) {
      return setError('Los passwords no coinciden.');
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onRegister({
        email: normalizedEmail,
        username: normalizedUsername,
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

        {(['email', 'username', 'password', 'confirm']).map((key, index) => {
          const inputId = `register-${key}`;
          const isPasswordField = key === 'password' || key === 'confirm';
          let inputType = 'text';
          if (isPasswordField) {
            inputType = 'password';
          } else if (key === 'email') {
            inputType = 'email';
          }
          const placeholders = [
            'Enter your email',
            'Choose a username',
            'Create a password',
            'Confirm your password',
          ];
          const labels = ['Email', 'Username', 'Password', 'Confirm password'];
          let maxLength = PASSWORD_MAX_LENGTH;
          if (key === 'email') {
            maxLength = EMAIL_MAX_LENGTH;
          } else if (key === 'username') {
            maxLength = USERNAME_MAX_LENGTH;
          }

          return (
            <div className="form-group" key={key}>
              <label className="form-label" htmlFor={inputId}>
                {labels[index]}
              </label>
              <input
                id={inputId}
                type={inputType}
                placeholder={placeholders[index]}
                value={form[key]}
                onChange={set(key)}
                autoComplete={key === 'confirm' ? 'new-password' : key}
                maxLength={maxLength}
                minLength={isPasswordField ? PASSWORD_MIN_LENGTH : undefined}
              />
            </div>
          );
        })}

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
