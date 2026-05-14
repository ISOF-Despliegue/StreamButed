import { useState } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 320;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_DIGIT = /\d/;
const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo completar la solicitud.';
}

function validatePasswordRules(password) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return 'El password debe tener entre 8 y 128 caracteres.';
  }

  if (!PASSWORD_UPPERCASE.test(password)) {
    return 'El password debe incluir al menos una mayuscula.';
  }

  if (!PASSWORD_DIGIT.test(password)) {
    return 'El password debe incluir al menos un numero.';
  }

  if (!PASSWORD_SPECIAL.test(password)) {
    return 'El password debe incluir al menos un simbolo especial.';
  }

  return '';
}

export function LoginPage({ onLogin, onRegister, onGoogleLogin, externalError = '' }) {
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

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || externalError}
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
          style={{ width: '100%', marginBottom: 16 }}
          type="button"
          onClick={onGoogleLogin}
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

export function RegisterPage({
  onStartRegistration,
  onVerifyRegistration,
  onResendCode,
  onCancelVerification,
  onGoogleRegister,
  onBack,
  externalError = '',
}) {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [verification, setVerification] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH
    ) {
      return setError('El username debe tener entre 3 y 50 caracteres.');
    }

    const passwordError = validatePasswordRules(form.password);
    if (passwordError) {
      return setError(passwordError);
    }

    if (form.password !== form.confirm) {
      return setError('Los passwords no coinciden.');
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await onStartRegistration({
        email: normalizedEmail,
        username: normalizedUsername,
        password: form.password,
      });
      setVerification(response);
      setVerificationCode('');
      setNotice(`Codigo enviado a ${response.email}. Expira en 15 minutos.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verification) return;

    const normalizedCode = verificationCode.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      return setError('Ingresa el codigo de 6 digitos.');
    }

    setError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      await onVerifyRegistration({
        attemptId: verification.attemptId,
        email: verification.email,
        code: normalizedCode,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!verification) return;

    setError('');
    setIsResending(true);

    try {
      const response = await onResendCode({
        attemptId: verification.attemptId,
        email: verification.email,
      });
      setVerification(response);
      setVerificationCode('');
      setNotice(`Nuevo codigo enviado a ${response.email}. Expira en 15 minutos.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  const handleCancel = async () => {
    if (!verification) return;

    setError('');
    setIsCancelling(true);

    try {
      await onCancelVerification({
        attemptId: verification.attemptId,
        email: verification.email,
      });
      setVerification(null);
      setVerificationCode('');
      setNotice('Verificacion cancelada.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
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
        <div className="auth-sub">
          {verification ? 'Enter the code sent to your email' : 'New accounts start as listeners'}
        </div>

        {!verification && (['email', 'username', 'password', 'confirm']).map((key, index) => {
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

        {verification && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="register-code">Codigo de verificacion</label>
              <input
                id="register-code"
                value={verificationCode}
                onChange={(event) => {
                  setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                onKeyDown={(event) => event.key === 'Enter' && handleVerify()}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
              Correo: {verification.email}
            </div>
          </>
        )}

        {notice && (
          <div role="status" style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>
            {notice}
          </div>
        )}

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || externalError}
          </div>
        )}

        {!verification ? (
          <button
            className="btn-primary"
            style={{ width: '100%', marginBottom: 16 }}
            onClick={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending code...' : 'Create Account'}
          </button>
        ) : (
          <>
            <button
              className="btn-primary"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={handleVerify}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verificando...' : 'Verificar codigo'}
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', marginBottom: 10 }}
              type="button"
              onClick={handleResend}
              disabled={isResending || isSubmitting}
            >
              {isResending ? 'Enviando...' : 'Solicitar nuevo codigo'}
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', marginBottom: 16 }}
              type="button"
              onClick={handleCancel}
              disabled={isCancelling || isSubmitting}
            >
              {isCancelling ? 'Cancelando...' : 'Cancelar verificacion'}
            </button>
          </>
        )}

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16 }}
          type="button"
          onClick={onGoogleRegister}
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

export function GooglePasswordSetupPage({ email, onSubmit, externalError = '' }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      return setError('Completa ambos campos de password.');
    }

    const passwordError = validatePasswordRules(password);
    if (passwordError) {
      return setError(passwordError);
    }

    if (password !== confirmPassword) {
      return setError('Los passwords no coinciden.');
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({ password, confirmPassword });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">S</div>
        </div>
        <div className="auth-title">Completa tu registro</div>
        <div className="auth-sub">
          Define un password para poder entrar tambien con email y password.
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-email">Email</label>
          <input
            id="google-setup-email"
            type="email"
            value={email}
            disabled
            maxLength={EMAIL_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-password">Password</label>
          <input
            id="google-setup-password"
            type="password"
            placeholder="Crea tu password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-confirm">Confirmar password</label>
          <input
            id="google-setup-confirm"
            type="password"
            placeholder="Confirma tu password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
          Debe incluir una mayuscula, un numero y un simbolo especial.
        </div>

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || externalError}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar password'}
        </button>
      </div>
    </div>
  );
}
