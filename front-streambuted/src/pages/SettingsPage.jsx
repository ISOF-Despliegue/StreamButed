import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { catalogService } from '../services/catalogService';
import { getAssetUrl, mediaService } from '../services/mediaService';

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
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUsername(user.username);
    setBio(user.bio ?? '');
  }, [user]);

  const handleSave = async () => {
    if (!username.trim()) {
      return setError('Username requerido.');
    }

    setIsSaving(true);
    setError('');

    try {
      let profileImageAssetId = user.profileImageAssetId;

      if (profileImageFile) {
        const upload = await mediaService.uploadProfileImage(profileImageFile);
        profileImageAssetId = upload.assetId;
      }

      await updateProfile({
        username: username.trim(),
        bio: bio.trim() || null,
        profileImageAssetId,
      });

      setProfileImageFile(null);
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
            {user.profileImageAssetId ? (
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
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={event => setProfileImageFile(event.target.files?.[0] ?? null)}
            />
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              {profileImageFile ? profileImageFile.name : 'JPG, PNG o WEBP. Max 5 MB.'}
            </div>
          </div>
        </div>
        <div className="form-group-mb">
          <label className="form-label">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />
        </div>
        <div className="form-group-mb">
          <label className="form-label">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={4}
            maxLength={300}
          />
          <div className="char-count">{bio.length} / 300</div>
        </div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
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

      {showPromotionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPromotionModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 32,
              maxWidth: 480,
              width: '90%',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              Activate Artist Mode
            </div>

            <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.7 }}>
              Identity Service promotes your account immediately. Catalog creates the artist profile
              asynchronously from the RabbitMQ event, so it can take a few seconds to appear.
            </p>

            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#ef4444',
                marginBottom: 20,
              }}
            >
              This action is irreversible.
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 13,
                color: 'var(--t2)',
                marginBottom: 24,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#E8960A' }}
              />
              I understand that activating artist mode is permanent.
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowPromotionModal(false);
                  setTermsAccepted(false);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{
                  flex: 1,
                  opacity: termsAccepted && !isPromoting ? 1 : 0.45,
                  cursor: termsAccepted && !isPromoting ? 'pointer' : 'not-allowed',
                }}
                disabled={!termsAccepted || isPromoting}
                onClick={handleConfirmPromotion}
              >
                {isPromoting ? 'Activating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
