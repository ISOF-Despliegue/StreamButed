import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PasswordField } from '../components/ui/PasswordField';
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

function PasswordResetDialog({
  isOpen,
  onCancel,
  onCompletePasswordReset,
  onResendPasswordResetCode,
  onStartPasswordReset,
  onVerifyPasswordResetCode,
}) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeDialog = () => {
    setStep('request');
    setEmail('');
    setVerification(null);
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setNotice('');
    setError('');
    setIsSubmitting(false);
    onCancel();
  };

  const startReset = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return setError('Todos los campos son obligatorios.');
    }
    if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
      return setError('El correo no puede superar 320 caracteres.');
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return setError('Correo inválido.');
    }

    setError('');
    setIsSubmitting(true);
    try {
      const response = await onStartPasswordReset({ email: normalizedEmail });
      setVerification(response);
      setStep('verify');
      setCode('');
      setNotice(`Código enviado a ${response.email}. Expira en ${formatVerificationTtl(response.expiresInSeconds)}.`);
    } catch (startError) {
      setError(getErrorMessage(startError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!verification) return;

    setError('');
    setIsSubmitting(true);
    try {
      const response = await onResendPasswordResetCode({
        attemptId: verification.attemptId,
        email: verification.email,
      });
      setVerification(response);
      setCode('');
      setNotice(`Nuevo código enviado a ${response.email}. Expira en ${formatVerificationTtl(response.expiresInSeconds)}.`);
    } catch (resendError) {
      setError(getErrorMessage(resendError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!verification) return;

    const normalizedCode = code.trim();
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
      await onVerifyPasswordResetCode({
        attemptId: verification.attemptId,
        email: verification.email,
        code: normalizedCode,
      });
      setStep('complete');
      setNotice('Código verificado. Define tu nueva contraseña.');
    } catch (verifyError) {
      setError(getErrorMessage(verifyError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeReset = async () => {
    if (!verification) return;
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
    setNotice('');
    setIsSubmitting(true);
    try {
      await onCompletePasswordReset({
        attemptId: verification.attemptId,
        email: verification.email,
        password,
        confirmPassword,
      });
      closeDialog();
    } catch (completeError) {
      setError(getErrorMessage(completeError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      open={isOpen}
      title="Recuperar contraseña"
      message=""
      confirmLabel={step === 'complete' ? 'Actualizar contraseña' : step === 'verify' ? 'Verificar código' : 'Enviar código'}
      cancelLabel="Cerrar"
      tone="primary"
      isLoading={isSubmitting}
      disabled={false}
      onConfirm={() => {
        if (step === 'request') {
          void startReset();
          return;
        }
        if (step === 'verify') {
          void verifyCode();
          return;
        }
        void completeReset();
      }}
      onCancel={closeDialog}
    >
      {step === 'request' && (
        <div className="form-group">
          <label className="form-label" htmlFor="reset-email">Correo</label>
          <input
            id="reset-email"
            data-dialog-autofocus
            type="email"
            placeholder="Ingresa tu correo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
          />
        </div>
      )}

      {step === 'verify' && verification && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-code">Código de recuperación</label>
            <input
              id="reset-code"
              data-dialog-autofocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => event.key === 'Enter' && void verifyCode()}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
            Correo: {verification.email}
          </div>
          <button className="btn-ghost" type="button" onClick={() => void resendCode()} disabled={isSubmitting}>
            Solicitar nuevo código
          </button>
        </>
      )}

      {step === 'complete' && verification && (
        <>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
            Correo: {verification.email}
          </div>
          <PasswordField
            id="reset-password"
            label="Nueva contraseña"
            placeholder="Ingresa tu nueva contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
          <PasswordField
            id="reset-confirm-password"
            label="Confirmar nueva contraseña"
            placeholder="Confirma tu nueva contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void completeReset()}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </>
      )}

      {notice && (
        <output role="status" style={{ display: 'block', fontSize: 13, color: 'var(--success)', marginTop: 12 }}>
          {notice}
        </output>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginTop: 12 }}>
          {error}
        </div>
      )}
    </ConfirmDialog>
  );
}

export function LoginPage({
  onLogin,
  onRegister,
  onGoogleLogin,
  onStartPasswordReset = async (_request) => ({ attemptId: '', email: '', expiresInSeconds: 0 }),
  onResendPasswordResetCode = async (_request) => ({ attemptId: '', email: '', expiresInSeconds: 0 }),
  onVerifyPasswordResetCode = async (_request) => {},
  onCompletePasswordReset = async (_request) => {},
  externalError = '',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bannedMessage, setBannedMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);

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

        <PasswordField
          id="login-password"
          label="Contraseña"
          placeholder="Ingresa tu contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void handleLogin()}
          autoComplete="current-password"
          maxLength={PASSWORD_MAX_LENGTH}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="auth-link auth-inline-link"
            onClick={() => setIsPasswordResetOpen(true)}
            type="button"
          >
            ¿Olvidaste tu contraseña?
          </button>
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

      <PasswordResetDialog
        isOpen={isPasswordResetOpen}
        onCancel={() => setIsPasswordResetOpen(false)}
        onCompletePasswordReset={onCompletePasswordReset}
        onResendPasswordResetCode={onResendPasswordResetCode}
        onStartPasswordReset={onStartPasswordReset}
        onVerifyPasswordResetCode={onVerifyPasswordResetCode}
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

        {!isVerifyingRegistration && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="register-email">Correo</label>
              <input
                id="register-email"
                type="email"
                placeholder="Ingresa tu correo"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="register-username">Nombre de usuario</label>
              <input
                id="register-username"
                type="text"
                placeholder="Elige un nombre de usuario"
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
                maxLength={USERNAME_MAX_LENGTH}
              />
            </div>
            <PasswordField
              id="register-password"
              label="Contraseña"
              placeholder="Crea una contraseña"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordField
              id="register-confirm"
              label="Confirmar contraseña"
              placeholder="Confirma tu contraseña"
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              minLength={PASSWORD_MIN_LENGTH}
            />
          </>
        )}

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
          <output role="status" style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>
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

        <PasswordField
          id="google-setup-password"
          label="Contraseña"
          placeholder="Crea tu contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
        />

        <PasswordField
          id="google-setup-confirm"
          label="Confirmar contraseña"
          placeholder="Confirma tu contraseña"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
        />

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

PasswordResetDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onCompletePasswordReset: PropTypes.func.isRequired,
  onResendPasswordResetCode: PropTypes.func.isRequired,
  onStartPasswordReset: PropTypes.func.isRequired,
  onVerifyPasswordResetCode: PropTypes.func.isRequired,
};

LoginPage.propTypes = {
  externalError: PropTypes.string,
  onCompletePasswordReset: PropTypes.func.isRequired,
  onGoogleLogin: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  onRegister: PropTypes.func.isRequired,
  onResendPasswordResetCode: PropTypes.func.isRequired,
  onStartPasswordReset: PropTypes.func.isRequired,
  onVerifyPasswordResetCode: PropTypes.func.isRequired,
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
