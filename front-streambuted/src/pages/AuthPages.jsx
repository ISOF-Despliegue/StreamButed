import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TEXT_LIMITS } from '../constants/textLimits';
import { toUserFacingMessage } from '../utils/userFacingMessages';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = TEXT_LIMITS.email;
const USERNAME_MIN_LENGTH = TEXT_LIMITS.usernameMin;
const USERNAME_MAX_LENGTH = TEXT_LIMITS.usernameMax;
const PASSWORD_MIN_LENGTH = TEXT_LIMITS.passwordMin;
const PASSWORD_MAX_LENGTH = TEXT_LIMITS.passwordMax;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_DIGIT = /\d/;
const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;

function getErrorMessage(error) {
  if (error instanceof Error) {
    return getFriendlyErrorMessage(error.message);
  }

  return 'No se pudo completar la solicitud.';
}

function getFriendlyErrorMessage(message) {
  return toUserFacingMessage(message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object';
}

function getApiErrorPayload(error) {
  if (!isObject(error) || !('details' in error) || !isObject(error.details)) {
    return null;
  }

  return error.details;
}

function formatRemainingBanTime(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 'unos momentos';
  }

  const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? '1 minuto' : `${totalMinutes} minutos`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    const hourText = totalHours === 1 ? '1 hora' : `${totalHours} horas`;
    if (minutes === 0) {
      return hourText;
    }
    const minuteText = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
    return `${hourText} y ${minuteText}`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayText = days === 1 ? '1 día' : `${days} días`;
  if (hours === 0) {
    return dayText;
  }
  const hourText = hours === 1 ? '1 hora' : `${hours} horas`;
  return `${dayText} y ${hourText}`;
}

function getBannedAccountMessage(error) {
  const payload = getApiErrorPayload(error);
  if (!payload || (payload.code !== 'ACCOUNT_BANNED' && payload.error !== 'AccountBannedException')) {
    return '';
  }

  if (payload.banType === 'PERMANENT' || !payload.bannedUntil) {
    return 'La cuenta se encuentra suspendida permanentemente.';
  }

  return `La cuenta se encuentra suspendida. Se reactivará en ${formatRemainingBanTime(payload.remainingSeconds)}.`;
}

function validatePasswordRules(password) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return 'La contraseña debe tener entre 8 y 15 caracteres.';
  }

  if (!PASSWORD_UPPERCASE.test(password)) {
    return 'La contraseña debe incluir al menos una mayúscula.';
  }

  if (!PASSWORD_DIGIT.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (!PASSWORD_SPECIAL.test(password)) {
    return 'La contraseña debe incluir al menos un símbolo especial.';
  }

  return '';
}

function formatVerificationTtl(expiresInSeconds) {
  const seconds = Number(expiresInSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'unos momentos';
  }

  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

export function LoginPage({ onLogin, onRegister, onGoogleLogin, externalError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bannedMessage, setBannedMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim();

    setBannedMessage('');

    if (!normalizedEmail || !password) return setError('Todos los campos son obligatorios.');
    if (normalizedEmail.length > EMAIL_MAX_LENGTH) return setError('El correo supera 320 caracteres.');
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setError('Correo inválido.');
    if (password.length > PASSWORD_MAX_LENGTH) return setError('La contraseña debe tener entre 8 y 15 caracteres.');

    setError('');
    setIsSubmitting(true);

    try {
      await onLogin({ email: normalizedEmail, password });
    } catch (err) {
      const accountBanMessage = getBannedAccountMessage(err);
      if (accountBanMessage) {
        setBannedMessage(accountBanMessage);
      } else {
        setError(getErrorMessage(err));
      }
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
        <div className="auth-title">Bienvenido a StreamButed</div>
        <div className="auth-sub">Inicia sesión para escuchar y compartir música.</div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            type="email"
            placeholder="Ingresa tu correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || getFriendlyErrorMessage(externalError)}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando...' : 'Iniciar sesión'}
        </button>

        <button
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 16 }}
          type="button"
          onClick={onGoogleLogin}
        >
          Continuar con Google
        </button>

        <div className="auth-footer">
          ¿No tienes cuenta?{' '}
          <button className="auth-link" onClick={onRegister} type="button">
            Regístrate
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(bannedMessage)}
        title="Cuenta suspendida"
        message={bannedMessage}
        confirmLabel="Entendido"
        onConfirm={() => setBannedMessage('')}
        onCancel={() => setBannedMessage('')}
      />
    </div>
  );
}

export function RegisterPage({
  onStartRegistration,
  onVerifyRegistration,
  onResendCode,
  onCancelVerification,
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
  const isVerifyingRegistration = Boolean(verification);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleCreate = async () => {
    const normalizedEmail = form.email.trim();
    const normalizedUsername = form.username.trim();

    if (!normalizedEmail || !normalizedUsername || !form.password || !form.confirm) {
      return setError('Todos los campos son obligatorios.');
    }

    if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
      return setError('El correo no puede superar 320 caracteres.');
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return setError('Correo inválido.');
    }

    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH
    ) {
      return setError('El nombre de usuario debe tener entre 3 y 100 caracteres.');
    }

    const passwordError = validatePasswordRules(form.password);
    if (passwordError) {
      return setError(passwordError);
    }

    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden.');
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
      setNotice(`Código enviado a ${response.email}. Expira en ${formatVerificationTtl(response.expiresInSeconds)}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verification) return;

    const normalizedCode = verificationCode.trim();
    if (!normalizedCode) {
      return setError('Todos los campos son obligatorios.');
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      return setError('Ingresa el código de 6 dígitos.');
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
      setNotice(`Nuevo código enviado a ${response.email}. Expira en ${formatVerificationTtl(response.expiresInSeconds)}.`);
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
      setNotice('Verificación cancelada.');
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
        <div className="auth-title">Crea tu cuenta</div>
        <div className="auth-sub">
          {isVerifyingRegistration
            ? 'Ingresa el código enviado a tu correo'
            : '¡Regístrate como oyente en StreamButed!'}
        </div>

        {!isVerifyingRegistration && (['email', 'username', 'password', 'confirm']).map((key, index) => {
          const inputId = `register-${key}`;
          const isPasswordField = key === 'password' || key === 'confirm';
          let inputType = 'text';
          if (isPasswordField) {
            inputType = 'password';
          } else if (key === 'email') {
            inputType = 'email';
          }
          const placeholders = [
            'Ingresa tu correo',
            'Elige un nombre de usuario',
            'Crea una contraseña',
            'Confirma tu contraseña',
          ];
          const labels = ['Correo', 'Nombre de usuario', 'Contraseña', 'Confirmar contraseña'];
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

        {isVerifyingRegistration && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="register-code">Código de verificación</label>
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
          <output style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>
            {notice}
          </output>
        )}

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || getFriendlyErrorMessage(externalError)}
          </div>
        )}

        {isVerifyingRegistration ? (
          <>
            <button
              className="btn-primary"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={handleVerify}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verificando...' : 'Verificar código'}
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', marginBottom: 10 }}
              type="button"
              onClick={handleResend}
              disabled={isResending || isSubmitting}
            >
              {isResending ? 'Enviando...' : 'Solicitar nuevo código'}
            </button>
            <button
              className="btn-ghost"
              style={{ width: '100%', marginBottom: 16 }}
              type="button"
              onClick={handleCancel}
              disabled={isCancelling || isSubmitting}
            >
              {isCancelling ? 'Cancelando...' : 'Cancelar verificación'}
            </button>
          </>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%', marginBottom: 16 }}
            onClick={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando código...' : 'Crear cuenta'}
          </button>
        )}

        <div className="auth-footer">
          ¿Ya tienes cuenta?{' '}
          <button className="auth-link" onClick={onBack} type="button">
            Inicia sesión
          </button>
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
      return setError('Todos los campos son obligatorios.');
    }

    const passwordError = validatePasswordRules(password);
    if (passwordError) {
      return setError(passwordError);
    }

    if (password !== confirmPassword) {
      return setError('Las contraseñas no coinciden.');
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
          Define una contraseña para poder entrar también con correo y contraseña.
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-email">Correo</label>
          <input
            id="google-setup-email"
            type="email"
            value={email}
            disabled
            maxLength={EMAIL_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-password">Contraseña</label>
          <input
            id="google-setup-password"
            type="password"
            placeholder="Crea tu contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="google-setup-confirm">Confirmar contraseña</label>
          <input
            id="google-setup-confirm"
            type="password"
            placeholder="Confirma tu contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
          Debe incluir una mayúscula, un número y un símbolo especial.
        </div>

        {(error || externalError) && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            {error || getFriendlyErrorMessage(externalError)}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </div>
    </div>
  );
}

LoginPage.propTypes = {
  externalError: PropTypes.string,
  onGoogleLogin: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  onRegister: PropTypes.func.isRequired,
};

RegisterPage.propTypes = {
  externalError: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onCancelVerification: PropTypes.func.isRequired,
  onResendCode: PropTypes.func.isRequired,
  onStartRegistration: PropTypes.func.isRequired,
  onVerifyRegistration: PropTypes.func.isRequired,
};

GooglePasswordSetupPage.propTypes = {
  email: PropTypes.string.isRequired,
  externalError: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
};

