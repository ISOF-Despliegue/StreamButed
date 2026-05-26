import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/apiClient';
import { catalogService } from '../services/catalogService';
import {
  getAssetUrl,
  getUploadFileHelperText,
  getUploadFileNameError,
  mediaService,
} from '../services/mediaService';
import { FilePicker } from '../components/ui/FilePicker';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import LogoutButton from '../components/layout/LogoutButton';
import { TEXT_LIMITS } from '../constants/textLimits';
import { browserLogger } from '../utils/browserLogger';
import { reloadCurrentPage } from '../utils/navigation';
import { toUserFacingMessage } from '../utils/userFacingMessages';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return 'No se pudo completar la solicitud.';
}

const PROFILE_IMAGE_FILE_HELPER = `JPG, PNG o WEBP. Máximo 5 MB. ${getUploadFileHelperText('foto-perfil-01.png')}`;

async function waitForArtistProfile(artistId) {
  const delays = [600, 1000, 1600, 2400];

  for (const delay of delays) {
    await new Promise(resolve => globalThis.setTimeout(resolve, delay));
    try {
      return await catalogService.getArtist(artistId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
      browserLogger.warn('Artist profile is not ready yet. Retrying.', error);
    }
  }

  return null;
}

function buildArtistProfileSyncPayload(user) {
  return {
    displayName: user.username,
    biography: user.bio ?? null,
    profileImageAssetId: user.profileImageAssetId ?? null,
  };
}

export function SettingsPage({
  user,
  toast,
  reloadPage = reloadCurrentPage,
  onRequestLogout = () => {},
}) {
  const { updateProfile, promoteToArtist } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? '');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState('');
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUsername(user.username);
    setBio(user.bio ?? '');
  }, [user]);

  useEffect(() => {
    if (!profileImageFile) {
      setProfilePreviewUrl('');
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      setProfilePreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfilePreviewUrl(previewUrl);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [profileImageFile]);

  const handleProfileImageChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      setProfileImageFile(null);
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const fileNameError = getUploadFileNameError(selectedFile, 'foto-perfil-01.png');
    if (fileNameError) {
      event.target.value = '';
      setProfileImageFile(null);
      setError(fileNameError);
      return;
    }

    if (!allowedTypes.includes(selectedFile.type)) {
      event.target.value = '';
      setProfileImageFile(null);
      setError('Formato de imagen inválido. Usa JPG, PNG o WEBP.');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      event.target.value = '';
      setProfileImageFile(null);
      setError('La imagen supera el máximo de 5 MB.');
      return;
    }

    setError('');
    setProfileImageFile(selectedFile);
  };

  const validateProfileChanges = () => {
    const normalizedUsername = username.trim();
    const normalizedBio = bio.trim();

    if (!normalizedUsername) return setError('Todos los campos son obligatorios.');
    if (
      normalizedUsername.length < TEXT_LIMITS.usernameMin ||
      normalizedUsername.length > TEXT_LIMITS.usernameMax
    ) {
      return setError('El nombre de usuario debe tener entre 3 y 100 caracteres.');
    }

    if (normalizedBio.length > TEXT_LIMITS.biography) {
      return setError('La biografía no puede superar 1000 caracteres.');
    }

    return {
      username: normalizedUsername,
      bio: normalizedBio || null,
    };
  };

  const requestSave = () => {
    const payload = validateProfileChanges();
    if (!payload) return;

    setError('');
    setShowSaveConfirmation(true);
  };

  const handleSave = async () => {
    const payload = validateProfileChanges();
    if (!payload) return;

    setIsSaving(true);
    setError('');

    try {
      let profileImageAssetId = user.profileImageAssetId;

      if (profileImageFile) {
        const upload = await mediaService.uploadProfileImage(profileImageFile);
        profileImageAssetId = upload.assetId;
      }

      await updateProfile({
        ...payload,
        profileImageAssetId,
      });

      if (user.role === 'artist') {
        try {
          await catalogService.updateArtist(user.id, {
            displayName: payload.username,
            biography: payload.bio,
            profileImageAssetId,
          });
        } catch (catalogError) {
          browserLogger.error('Failed to sync public artist profile after profile update.', catalogError);
          const syncMessage = 'Perfil actualizado, pero no se pudo actualizar tu perfil público de artista. Intenta guardar de nuevo.';
          setProfileImageFile(null);
          setShowSaveConfirmation(false);
          setError(syncMessage);
          toast(syncMessage);
          return;
        }
      }

      setProfileImageFile(null);
      setShowSaveConfirmation(false);
      toast('Perfil actualizado');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPromotion = async () => {
    setIsPromoting(true);
    setError('');
    setPromotionMessage('Activando modo artista...');

    try {
      const promotedUser = await promoteToArtist();
      setPromotionMessage('Preparando tu perfil de artista...');

      const artist = await waitForArtistProfile(promotedUser.id);
      if (artist) {
        try {
          await catalogService.updateArtist(
            promotedUser.id,
            buildArtistProfileSyncPayload(promotedUser)
          );
        } catch (catalogError) {
          browserLogger.warn('Artist profile was created, but initial public profile sync failed.', catalogError);
        }
        setPromotionMessage('Perfil de artista listo.');
        toast('Modo artista activado');
        setShowPromotionModal(false);
        setTermsAccepted(false);
      } else {
        setPromotionMessage('Tu perfil de artista aún se está preparando. Reintenta en unos segundos.');
        setShowPromotionModal(false);
        setTermsAccepted(false);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPromoting(false);
    }
  };

  const profileImageUrl = profilePreviewUrl ||
    (user.profileImageAssetId ? getAssetUrl(user.profileImageAssetId) : '');
  const profileImageAlt = profilePreviewUrl
    ? `Previsualización de foto de perfil de ${user.username || 'usuario'}`
    : `Foto de perfil de ${user.username || 'usuario'}`;

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Ajustes</div>
      </div>

      <div className="settings-card" style={{ maxWidth: 600 }}>
        <div className="settings-card-title">Perfil</div>
        <div className="avatar-upload-row">
          <div className="avatar-upload-img">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={profileImageAlt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
              />
            ) : (
              user.username[0]?.toUpperCase()
            )}
          </div>
          <div>
            <FilePicker
              accept="image/png,image/jpeg,image/webp"
              file={profileImageFile}
              onChange={handleProfileImageChange}
              helperText={PROFILE_IMAGE_FILE_HELPER}
              buttonLabel="Seleccionar archivo"
            />
          </div>
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="settings-username">Nombre de usuario</label>
          <input
            id="settings-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nombre de usuario"
            maxLength={TEXT_LIMITS.usernameMax}
          />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="settings-bio">Biografía</label>
          <textarea
            id="settings-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Cuéntanos sobre ti"
            rows={4}
            maxLength={TEXT_LIMITS.biography}
          />
          <div className="char-count">{bio.length} / {TEXT_LIMITS.biography}</div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={requestSave} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {user.role === 'listener' && (
        <div className="settings-card" style={{ maxWidth: 600, marginTop: 24 }}>
          <div className="settings-card-title">Convertirte en artista</div>
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.7 }}>
            El modo artista te permite subir canciones, crear álbumes, transmitir en vivo y revisar tus estadísticas.
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowPromotionModal(true)}
          >
            Activar modo artista
          </button>
          {promotionMessage && (
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 12 }}>{promotionMessage}</div>
          )}
        </div>
      )}

      <div className="settings-logout-row" style={{ maxWidth: 600 }}>
        <LogoutButton onLogout={onRequestLogout} />
      </div>

      <ConfirmDialog
        open={showSaveConfirmation}
        title="Actualizar perfil"
        message="Confirma que deseas guardar estos cambios en tu perfil. El nuevo nombre, biografía o imagen se usarán en la app."
        confirmLabel="Guardar cambios"
        tone="primary"
        isLoading={isSaving}
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirmation(false)}
      />

      <ConfirmDialog
        open={showPromotionModal}
        title="Activar modo artista"
        message="Activaremos tu perfil de artista. Este cambio es permanente y puede tardar unos segundos en reflejarse."
        confirmLabel="Activar modo"
        isLoading={isPromoting}
        disabled={!termsAccepted}
        onConfirm={handleConfirmPromotion}
        onCancel={() => {
          setShowPromotionModal(false);
          setTermsAccepted(false);
        }}
      >
        <div className="confirm-dialog-warning">Esta acción es permanente.</div>
        <label className="confirm-dialog-check">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
          />
          <span>Entiendo que activar el modo artista es permanente.</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}

SettingsPage.propTypes = {
  onRequestLogout: PropTypes.func,
  reloadPage: PropTypes.func,
  toast: PropTypes.func.isRequired,
  user: PropTypes.shape({
    bio: PropTypes.string,
    id: PropTypes.string,
    profileImageAssetId: PropTypes.string,
    role: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
};
