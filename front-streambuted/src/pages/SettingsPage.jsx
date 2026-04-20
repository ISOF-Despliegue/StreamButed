import { useState } from 'react';

/**
 * SettingsPage
 *
 * Shows a profile editor for all users.
 * Listeners additionally see a "Become an Artist" section with a
 * confirmation modal that explains the irreversibility of the action.
 */
export function SettingsPage({ user, toast, onUpdateUser }) {
  const [username, setUsername] = useState(user.name);
  const [bio, setBio] = useState('');

  // Controls visibility of the artist promotion modal.
  const [showPromotionModal, setShowPromotionModal] = useState(false);

  // The confirm button stays disabled until the user checks the terms checkbox,
  // reinforcing that the action is deliberate and irreversible.
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSave = () => {
    toast('Changes saved ✓');
  };

  const handleConfirmPromotion = () => {
    // In production this would call the backend to update the JWT role.
    // Here we propagate the change to the parent via onUpdateUser.
    onUpdateUser({ ...user, role: 'artist' });
    setShowPromotionModal(false);
    toast('Welcome to your artist profile! 🎤');
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      {/* ── Profile card ──────────────────────────────────────────── */}
      <div className="settings-card" style={{ maxWidth: 600 }}>
        <div className="settings-card-title">Profile</div>
        <div className="avatar-upload-row">
          <div className="avatar-upload-img">{user.name[0]?.toUpperCase()}</div>
          <div>
            <button className="btn-ghost" style={{ fontSize: 13 }}>
              ↑ Upload photo
            </button>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              JPG or PNG. Max 5 MB.
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
          />
          <div className="char-count">{bio.length} / 300</div>
        </div>
        <button className="btn-primary" onClick={handleSave}>
          Save Changes
        </button>
      </div>

      {/* ── Become an Artist (listener only) ──────────────────────── */}
      {user.role === 'listener' && (
        <div className="settings-card" style={{ maxWidth: 600, marginTop: 24 }}>
          <div className="settings-card-title">Become an Artist</div>
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16 }}>
            Unlock the ability to upload tracks, manage albums, view analytics
            and go live. Artist status is permanent — once activated it cannot
            be reverted.
          </p>
          <button
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            onClick={() => setShowPromotionModal(true)}
          >
            🎤 Start my artist journey
          </button>
        </div>
      )}

      {/* ── Promotion confirmation modal ───────────────────────────── */}
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
            // Close when clicking the backdrop, not the modal itself.
            if (e.target === e.currentTarget) setShowPromotionModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 480,
              width: '90%',
            }}
          >
            <div
              style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}
            >
              🎤 Activate Artist Mode
            </div>

            <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
              As an artist you will be able to:
            </p>
            <ul
              style={{
                fontSize: 14,
                color: 'var(--t2)',
                marginBottom: 16,
                paddingLeft: 20,
                lineHeight: 1.8,
              }}
            >
              <li>Upload and manage your tracks and albums</li>
              <li>Access detailed streaming analytics</li>
              <li>Go live and connect with your audience</li>
              <li>Appear in artist search results</li>
            </ul>

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
              ⚠️ This action is irreversible. Once you become an artist your
              account cannot be downgraded back to listener.
            </div>

            {/* Checkbox must be ticked before the confirm button becomes active. */}
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
                style={{ marginTop: 2, accentColor: '#7c3aed' }}
              />
              I understand that activating artist mode is permanent and I accept
              the StreamButed Artist Terms of Service.
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
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  opacity: termsAccepted ? 1 : 0.45,
                  cursor: termsAccepted ? 'pointer' : 'not-allowed',
                }}
                disabled={!termsAccepted}
                onClick={handleConfirmPromotion}
              >
                Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
