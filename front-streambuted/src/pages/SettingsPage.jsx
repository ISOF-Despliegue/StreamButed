import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { catalogService } from '../services/catalogService';
import { getAssetUrl, mediaService } from '../services/mediaService';
import { FilePicker } from '../components/ui/FilePicker';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo completar la solicitud.';
}

async function waitForArtistProfile(artistId) {
  const delays = [600, 1000, 1600, 2400];

  for (const delay of delays) {
    await new Promise(resolve => window.setTimeout(resolve, delay));
    try {
      return await catalogService.getArtist(artistId);
    } catch {
      // Artist creation is eventually consistent through RabbitMQ.
    }
  }

  return null;
}

export function SettingsPage({ user, toast }) {
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
    if (!allowedTypes.includes(selectedFile.type)) {
      event.target.value = '';
      setProfileImageFile(null);
      setError('Formato de imagen invalido. Usa JPG, PNG o WEBP.');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      event.target.value = '';
      setProfileImageFile(null);
      setError('La imagen supera el maximo de 5 MB.');
      return;
    }

    setError('');
    setProfileImageFile(selectedFile);
  };

  const validateProfileChanges = () => {
    const normalizedUsername = username.trim();
    const normalizedBio = bio.trim();

    if (!normalizedUsername) return setError('Username requerido.');
    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      return setError('Username debe tener entre 3 y 50 caracteres.');
    }

    if (normalizedBio.length > 1000) {
      return setError('Bio no puede superar 1000 caracteres.');
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
        await catalogService.updateArtist(user.id, {
          displayName: payload.username,
          biography: payload.bio,
          profileImageAssetId,
        });
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
    setPromotionMessage('Promoviendo cuenta en Identity Service...');

    try {
      const promotedUser = await promoteToArtist();
      setPromotionMessage('Preparando perfil de artista en Catalog...');

      const artist = await waitForArtistProfile(promotedUser.id);
      if (artist) {
        setPromotionMessage('Perfil de artista listo.');
        toast('Modo artista activado');
      } else {
        setPromotionMessage('Catalog aun esta preparando tu perfil. Reintenta desde el dashboard en unos segundos.');
      }

      setShowPromotionModal(false);
      setTermsAccepted(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-card" style={{ maxWidth: 600 }}>
        <div className="settings-card-title">Profile</div>
        <div className="avatar-upload-row">
          <div className="avatar-upload-img">
            {profilePreviewUrl ? (
              <img
                src={profilePreviewUrl}
                alt={`Previsualizacion de foto de perfil de ${user.username || 'usuario'}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
              />
            ) : user.profileImageAssetId ? (
              <img
                src={getAssetUrl(user.profileImageAssetId)}
                alt={`Foto de perfil de ${user.username || 'usuario'}`}
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
              helperText="JPG, PNG o WEBP. Max 5 MB."
              buttonLabel="Seleccionar archivo"
            />
          </div>
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="settings-username">Username</label>
          <input
            id="settings-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            maxLength={50}
          />
        </div>
        <div className="form-group-mb">
          <label className="form-label" htmlFor="settings-bio">Bio</label>
          <textarea
            id="settings-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={4}
            maxLength={1000}
          />
          <div className="char-count">{bio.length} / 1000</div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={requestSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {user.role === 'listener' && (
        <div className="settings-card" style={{ maxWidth: 600, marginTop: 24 }}>
          <div className="settings-card-title">Become an Artist</div>
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.7 }}>
            Artist mode enables uploads and catalog management. Analytics, lives and playback metrics
            stay pending until those backend services exist.
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowPromotionModal(true)}
          >
            Start artist mode
          </button>
          {promotionMessage && (
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 12 }}>{promotionMessage}</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showSaveConfirmation}
        title="Actualizar perfil"
        message="Confirma que deseas guardar estos cambios en tu perfil. El nuevo nombre, biografia o imagen se usaran en la app."
        confirmLabel="Guardar cambios"
        tone="primary"
        isLoading={isSaving}
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirmation(false)}
      />

      <ConfirmDialog
        open={showPromotionModal}
        title="Activar modo artista"
        message="Identity Service promovera tu cuenta inmediatamente. Catalog creara el perfil de artista desde el evento de RabbitMQ, por lo que puede tardar unos segundos."
        confirmLabel="Activar modo"
        isLoading={isPromoting}
        disabled={!termsAccepted}
        onConfirm={handleConfirmPromotion}
        onCancel={() => {
          setShowPromotionModal(false);
          setTermsAccepted(false);
        }}
      >
        <div className="confirm-dialog-warning">Esta accion es permanente.</div>
        <label className="confirm-dialog-check">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
          />
          Entiendo que activar el modo artista es permanente.
        </label>
      </ConfirmDialog>
    </div>
  );
}
