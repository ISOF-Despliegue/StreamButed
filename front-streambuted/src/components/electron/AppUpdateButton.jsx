import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const DEFAULT_STATUS = {
  state: 'idle',
  message: '',
};

function getUpdatesApi() {
  return globalThis.window.streambuted?.updates ?? null;
}

function getButtonLabel(status, isChecking, isInstalling) {
  if (isInstalling) return 'Instalando...';
  if (status.state === 'downloaded') return 'Reiniciar e instalar';
  if (isChecking || status.state === 'checking') return 'Buscando...';
  if (status.state === 'downloading') return 'Descargando...';
  return 'Buscar actualizaciones';
}

export function AppUpdateButton({ fullWidth = false }) {
  const updatesApi = getUpdatesApi();
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!updatesApi?.onStatus) return undefined;

    return updatesApi.onStatus((nextStatus) => {
      setStatus(nextStatus);
    });
  }, [updatesApi]);

  if (!updatesApi) {
    return null;
  }

  const isBusy = isChecking || isInstalling || status.state === 'checking' || status.state === 'downloading';

  const handleClick = async () => {
    if (status.state === 'downloaded') {
      setIsInstalling(true);
      try {
        await updatesApi.install();
      } catch (error) {
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'No se pudo instalar la actualizacion.',
        });
        setIsInstalling(false);
      }
      return;
    }

    setIsChecking(true);
    try {
      const nextStatus = await updatesApi.check();
      setStatus(nextStatus);
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'No se pudo buscar actualizaciones.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="app-update-control" style={{ width: fullWidth ? '100%' : undefined }}>
      <button
        className={status.state === 'downloaded' ? 'btn-primary' : 'btn-ghost'}
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        style={{ width: fullWidth ? '100%' : undefined }}
      >
        {getButtonLabel(status, isChecking, isInstalling)}
      </button>
      {status.message && (
        status.state === 'error' ? (
          <div className="app-update-status" role="alert">
            {status.message}
          </div>
        ) : (
          <output className="app-update-status">
            {status.message}
          </output>
        )
      )}
    </div>
  );
}

AppUpdateButton.propTypes = {
  fullWidth: PropTypes.bool,
};
