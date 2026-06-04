import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { analyticsService } from '../../services/analyticsService';
import { catalogService } from '../../services/catalogService';
import { emitLibraryRefreshRequested } from '../../services/libraryEvents';
import { userService } from '../../services/userService';
import { formatDate, formatNumber } from '../../utils/formatters';
import { toUserFacingMessage } from '../../utils/userFacingMessages';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { InlineState } from '../../components/ui/InlineState';
import { SearchInput } from '../../components/ui/SearchInput';
import { useSearchController } from '../../hooks/useSearchController';

function getErrorMessage(error) {
  if (error instanceof Error) {
    return toUserFacingMessage(error.message);
  }

  return 'No se pudo completar la solicitud.';
}

function formatMetricNumber(value) {
  return formatNumber(Number(value ?? 0));
}

function useAdminSummary() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setSummary(await analyticsService.getAdminSummary());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return {
    error,
    isLoading,
    loadSummary,
    summary,
  };
}

export function AdminOverviewPage() {
  const { error, isLoading, loadSummary, summary } = useAdminSummary();

  return (
    <div className="page-inner">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="page-title">Resumen</div>
      </div>

      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-label">Usuarios diarios</div><div className="stat-card-value">{formatMetricNumber(summary?.dailyActiveUsers)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Usuarios mensuales</div><div className="stat-card-value">{formatMetricNumber(summary?.monthlyActiveUsers)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Reproducciones</div><div className="stat-card-value">{formatMetricNumber(summary?.totalPlays)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Analíticas</div><div className="stat-card-value">{error ? 'Error' : 'Activo'}</div></div>
      </div>

      {isLoading && <InlineState title="Cargando analíticas globales..." />}
      {error && <InlineState title="No se pudieron cargar las analíticas" message={error} onRetry={loadSummary} />}

      {!isLoading && !error && summary && (
        <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <RankingCard title="Canciones principales" rows={summary.topTracks} primaryKey="title" />
          <RankingCard title="Artistas principales" rows={summary.topArtists} primaryKey="artistName" />
        </div>
      )}
    </div>
  );
}

function RankingCard({ title, rows, primaryKey }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">{title}</div>
      <div className="chart-card-sub">Ordenado por reproducciones</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t2)' }}>Sin datos registrados.</div>
      ) : (
        <div className="chart-legend">
          {rows.slice(0, 10).map((row, index) => (
            <div className="legend-item" key={row.trackId ?? row.artistId}>
              <span className="legend-dot" style={{ background: index === 0 ? 'var(--accent)' : 'var(--border2)' }} />
              <span>{row[primaryKey]}</span>
              <span className="legend-pct">{formatMetricNumber(row.plays)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

RankingCard.propTypes = {
  primaryKey: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  title: PropTypes.string.isRequired,
};

export function AdminAnalyticsPage() {
  const { error, isLoading, loadSummary, summary } = useAdminSummary();

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Analíticas</div>
        <div className="page-subtitle">Uso global y rankings de la plataforma.</div>
      </div>

      {isLoading && <InlineState title="Cargando analíticas..." />}
      {error && <InlineState title="No se pudieron cargar las analíticas" message={error} onRetry={loadSummary} />}

      {!isLoading && !error && summary && (
        <>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-card-label">Usuarios diarios</div><div className="stat-card-value">{formatMetricNumber(summary.dailyActiveUsers)}</div></div>
            <div className="stat-card"><div className="stat-card-label">Usuarios mensuales</div><div className="stat-card-value">{formatMetricNumber(summary.monthlyActiveUsers)}</div></div>
            <div className="stat-card"><div className="stat-card-label">Reproducciones globales</div><div className="stat-card-value">{formatMetricNumber(summary.totalPlays)}</div></div>
          </div>

          <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <AnalyticsTable title="Canciones principales" rows={summary.topTracks} nameKey="title" />
            <AnalyticsTable title="Artistas principales" rows={summary.topArtists} nameKey="artistName" />
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsTable({ title, rows, nameKey }) {
  return (
    <div className="table-wrap">
      <div className="table-header">
        <div className="section-title">{title}</div>
      </div>
      {rows.length === 0 ? (
        <InlineState title="Sin métricas disponibles" />
      ) : (
        <table className="data-table">
          <thead><tr><th>Nombre</th><th>Reproducciones</th><th>Oyentes únicos</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.trackId ?? row.artistId}>
                <td>{row[nameKey]}</td>
                <td>{formatMetricNumber(row.plays)}</td>
                <td>{formatMetricNumber(row.uniqueListeners)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

AnalyticsTable.propTypes = {
  nameKey: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  title: PropTypes.string.isRequired,
};

const MODERATION_TABS = [
  ['tracks', 'Canciones'],
  ['albums', 'Álbumes'],
  ['users', 'Cuentas'],
];

const ADMIN_MODERATION_LIMIT = 10;

const DURATION_UNITS = [
  ['HOURS', 'Horas'],
  ['DAYS', 'Días'],
  ['WEEKS', 'Semanas'],
];

function normalizeBanDurationAmount(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 3650);
}

function getCatalogStatusLabel(status) {
  return status === 'RETIRADO' ? 'Retirado' : 'Publicado';
}

function getBanStatusLabel(status) {
  switch (status) {
    case 'TEMPORARY':
      return 'Suspensión temporal';
    case 'PERMANENT':
      return 'Suspensión permanente';
    case 'EXPIRED':
      return 'Suspensión expirada';
    case 'INACTIVE':
      return 'Inactiva';
    default:
      return 'Sin suspensión';
  }
}

function getRoleBadgeClass(role) {
  if (role === 'admin') return 'badge badge-admin';
  if (role === 'artist') return 'badge badge-artist';
  return 'badge badge-listener';
}

function getRoleLabel(role) {
  if (role === 'admin') return 'Administrador';
  if (role === 'artist') return 'Artista';
  return 'Oyente';
}

function getSearchPlaceholder(activeTab) {
  if (activeTab === 'tracks') {
    return 'Buscar canciones';
  }

  if (activeTab === 'albums') {
    return 'Buscar álbumes';
  }

  return 'Buscar cuentas';
}

function getBanConfirmationMessage(draft) {
  const accountLabel = `${draft.user.username} - ${draft.user.email}`;
  if (draft.banType === 'PERMANENT') {
    return `Confirma que deseas suspender permanentemente la cuenta ${accountLabel}.`;
  }

  const durationAmount = normalizeBanDurationAmount(draft.durationAmount);
  const unitLabel = DURATION_UNITS.find(([value]) => value === draft.durationUnit)?.[1]?.toLowerCase() ?? 'días';
  return `Confirma que deseas suspender la cuenta ${accountLabel} por ${durationAmount} ${unitLabel}.`;
}

function PaginationFooter({ pagination, label }) {
  return (
    <div className="pagination">
      <span>{formatMetricNumber(pagination.total)} {label}</span>
      <span>Mostrando {formatMetricNumber(pagination.dataCount)} de {formatMetricNumber(pagination.total)}</span>
    </div>
  );
}

PaginationFooter.propTypes = {
  label: PropTypes.string.isRequired,
  pagination: PropTypes.shape({
    dataCount: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }).isRequired,
};

function CatalogStatusBadge({ status }) {
  const className = status === 'RETIRADO' ? 'badge-danger-soft' : 'badge-success-soft';
  return <span className={`badge ${className}`}>{getCatalogStatusLabel(status)}</span>;
}

CatalogStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

function RetireActionButton({ disabled, onClick }) {
  return (
    <button className="btn-danger" disabled={disabled} onClick={onClick} type="button">
      Retirar
    </button>
  );
}

RetireActionButton.propTypes = {
  disabled: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

function ReinstateActionButton({ disabled, onClick }) {
  return (
    <button className="btn-ghost" disabled={disabled} onClick={onClick} type="button">
      Reingresar
    </button>
  );
}

ReinstateActionButton.propTypes = {
  disabled: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

function ModerationTable({ emptyTitle, headers, label, pagination, rows }) {
  return (
    <div className="table-wrap">
      {rows.length === 0 ? (
        <InlineState title={emptyTitle} />
      ) : (
        <table className="data-table">
          <thead>
            <tr>{headers.map(header => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => <td key={`${row.key}-${index}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <PaginationFooter label={label} pagination={pagination} />
    </div>
  );
}

ModerationTable.propTypes = {
  emptyTitle: PropTypes.string.isRequired,
  headers: PropTypes.arrayOf(PropTypes.string).isRequired,
  label: PropTypes.string.isRequired,
  pagination: PaginationFooter.propTypes.pagination,
  rows: PropTypes.arrayOf(PropTypes.shape({
    cells: PropTypes.arrayOf(PropTypes.node).isRequired,
    key: PropTypes.string.isRequired,
  })).isRequired,
};

function BanAccountPanel({ draft, isLoading, onCancel, onChange, onSubmit }) {
  if (!draft.user) {
    return null;
  }

  const isTemporary = draft.banType === 'TEMPORARY';

  return (
    <form className="moderation-action-panel" onSubmit={onSubmit}>
      <div>
        <div className="section-title">Suspender cuenta</div>
        <div style={{ color: 'var(--t2)', fontSize: 13 }}>{draft.user.username} - {draft.user.email}</div>
      </div>

      <div className="moderation-form-grid">
        <label className="form-group-mb">
          <span className="form-label">Tipo</span>
          <select value={draft.banType} onChange={(event) => onChange({ banType: event.target.value })}>
            <option value="TEMPORARY">Temporal</option>
            <option value="PERMANENT">Permanente</option>
          </select>
        </label>

        {isTemporary && (
          <>
            <label className="form-group-mb">
              <span className="form-label">Tiempo</span>
              <input
                min="1"
                max="3650"
                type="number"
                value={draft.durationAmount}
                onChange={(event) => onChange({ durationAmount: normalizeBanDurationAmount(event.target.value) })}
              />
            </label>
            <label className="form-group-mb">
              <span className="form-label">Unidad</span>
              <select value={draft.durationUnit} onChange={(event) => onChange({ durationUnit: event.target.value })}>
                {DURATION_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </>
        )}

        <label
          className="form-group-mb moderation-reason-field"
          style={{ gridColumn: isTemporary ? 'auto' : 'span 3' }}
        >
          <span className="form-label">Motivo interno</span>
          <input
            maxLength={500}
            placeholder="Opcional"
            value={draft.reason}
            onChange={(event) => onChange({ reason: event.target.value })}
          />
        </label>
      </div>

      <div className="moderation-action-buttons">
        <button className="btn-ghost" disabled={isLoading} type="button" onClick={onCancel}>Cancelar</button>
        <button className="btn-danger" disabled={isLoading} type="submit">
          {isLoading ? 'Aplicando...' : 'Confirmar suspensión'}
        </button>
      </div>
    </form>
  );
}

BanAccountPanel.propTypes = {
  draft: PropTypes.shape({
    banType: PropTypes.string.isRequired,
    durationAmount: PropTypes.number.isRequired,
    durationUnit: PropTypes.string.isRequired,
    reason: PropTypes.string.isRequired,
    user: PropTypes.object,
  }).isRequired,
  isLoading: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

function UserModerationAction({ isLoading, onBan, onUnban, user }) {
  if (user.role === 'admin') {
    return <span style={{ color: 'var(--t3)' }}>Protegida</span>;
  }

  if (user.banStatus === 'ACTIVE') {
    return (
      <button className="btn-danger" disabled={isLoading} onClick={() => onBan(user)} type="button">
        Suspender
      </button>
    );
  }

  return (
    <button className="btn-ghost" disabled={isLoading} onClick={() => onUnban(user)} type="button">
      Reactivar
    </button>
  );
}

UserModerationAction.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  onBan: PropTypes.func.isRequired,
  onUnban: PropTypes.func.isRequired,
  user: PropTypes.shape({
    banStatus: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
  }).isRequired,
};

export function AdminModerationPage({ toast }) {
  const [activeTab, setActiveTab] = useState('tracks');
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ dataCount: 0, limit: ADMIN_MODERATION_LIMIT, offset: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [moderationSearchTerm, setModerationSearchTerm] = useState('');
  const latestModerationRequestRef = useRef(0);
  const searchController = useSearchController({
    contextKey: activeTab,
    onClear: useCallback(() => setModerationSearchTerm(''), []),
    onSearch: useCallback(searchTerm => setModerationSearchTerm(searchTerm), []),
  });
  const [banDraft, setBanDraft] = useState({
    user: null,
    banType: 'TEMPORARY',
    durationAmount: 7,
    durationUnit: 'DAYS',
    reason: '',
  });

  const loadModerationItems = useCallback(async () => {
    const requestId = latestModerationRequestRef.current + 1;
    latestModerationRequestRef.current = requestId;
    setIsLoading(true);
    setError('');
    setActionError('');
    const searchParams = moderationSearchTerm ? { q: moderationSearchTerm } : {};
    const isLatestRequest = () => latestModerationRequestRef.current === requestId;

    try {
      if (activeTab === 'tracks') {
        const response = await catalogService.listAdminTracks({
          includeRetired: true,
          limit: ADMIN_MODERATION_LIMIT,
          offset: 0,
          ...searchParams,
        });
        if (!isLatestRequest()) return;
        setTracks(response.data);
        setPagination({ ...response.pagination, dataCount: response.data.length });
        return;
      }

      if (activeTab === 'albums') {
        const response = await catalogService.listAdminAlbums({
          includeRetired: true,
          limit: ADMIN_MODERATION_LIMIT,
          offset: 0,
          ...searchParams,
        });
        if (!isLatestRequest()) return;
        setAlbums(response.data);
        setPagination({ ...response.pagination, dataCount: response.data.length });
        return;
      }

      const response = await userService.listAdminUsers({
        limit: ADMIN_MODERATION_LIMIT,
        offset: 0,
        ...searchParams,
      });
      if (!isLatestRequest()) return;
      setUsers(response.data);
      setPagination({ ...response.pagination, dataCount: response.data.length });
    } catch (err) {
      if (!isLatestRequest()) return;
      setError(getErrorMessage(err));
    } finally {
      if (!isLatestRequest()) return;
      setIsLoading(false);
    }
  }, [activeTab, moderationSearchTerm]);

  useEffect(() => {
    void loadModerationItems();
  }, [loadModerationItems]);

  const retireTrack = async (track) => {
    setIsActionLoading(true);
    setActionError('');
    try {
      await catalogService.retireTrack(track.trackId);
      emitLibraryRefreshRequested();
      toast('Canción retirada.');
      setConfirmation(null);
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const retireAlbum = async (album) => {
    setIsActionLoading(true);
    setActionError('');
    try {
      await catalogService.retireAlbum(album.albumId);
      emitLibraryRefreshRequested();
      toast('Álbum retirado.');
      setConfirmation(null);
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const reinstateTrack = async (track) => {
    setIsActionLoading(true);
    setActionError('');
    try {
      await catalogService.reinstateTrack(track.trackId);
      emitLibraryRefreshRequested();
      toast('Canción reingresada.');
      setConfirmation(null);
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const reinstateAlbum = async (album) => {
    setIsActionLoading(true);
    setActionError('');
    try {
      await catalogService.reinstateAlbum(album.albumId);
      emitLibraryRefreshRequested();
      toast('Álbum reingresado.');
      setConfirmation(null);
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmRetireTrack = (track) => {
    setActionError('');
    setConfirmation({
      title: 'Retirar canción',
      message: `Confirma que deseas retirar "${track.title}".`,
      confirmLabel: 'Retirar canción',
      onConfirm: () => retireTrack(track),
    });
  };

  const confirmRetireAlbum = (album) => {
    setActionError('');
    setConfirmation({
      title: 'Retirar álbum',
      message: `Confirma que deseas retirar "${album.title}".`,
      confirmLabel: 'Retirar álbum',
      onConfirm: () => retireAlbum(album),
    });
  };

  const confirmReinstateTrack = (track) => {
    setActionError('');
    setConfirmation({
      title: 'Reingresar canción',
      message: `Confirma que deseas reingresar "${track.title}".`,
      confirmLabel: 'Reingresar canción',
      onConfirm: () => reinstateTrack(track),
    });
  };

  const confirmReinstateAlbum = (album) => {
    setActionError('');
    setConfirmation({
      title: 'Reingresar álbum',
      message: `Confirma que deseas reingresar "${album.title}".`,
      confirmLabel: 'Reingresar álbum',
      onConfirm: () => reinstateAlbum(album),
    });
  };

  const banAccount = async (draft) => {
    setIsActionLoading(true);
    setActionError('');
    const durationAmount = normalizeBanDurationAmount(draft.durationAmount);

    try {
      await userService.banUser(draft.user.id, {
        banType: draft.banType,
        durationAmount: draft.banType === 'TEMPORARY' ? durationAmount : undefined,
        durationUnit: draft.banType === 'TEMPORARY' ? draft.durationUnit : undefined,
        reason: draft.reason,
      });
      toast('Cuenta suspendida.');
      setConfirmation(null);
      setBanDraft((current) => ({ ...current, user: null }));
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBanDraftChange = (patch) => {
    setBanDraft((current) => ({ ...current, ...patch }));
  };

  const openBanPanel = (user) => {
    setActionError('');
    setBanDraft({
      user,
      banType: 'TEMPORARY',
      durationAmount: 7,
      durationUnit: 'DAYS',
      reason: '',
    });
  };

  const handleBanSubmit = async (event) => {
    event.preventDefault();
    if (!banDraft.user) {
      return;
    }

    setActionError('');
    const draft = {
      ...banDraft,
      durationAmount: normalizeBanDurationAmount(banDraft.durationAmount),
    };
    setConfirmation({
      title: 'Suspender cuenta',
      message: getBanConfirmationMessage(draft),
      confirmLabel: 'Suspender cuenta',
      onConfirm: () => banAccount(draft),
    });
  };

  const handleUnbanUser = async (user) => {
    setIsActionLoading(true);
    setActionError('');

    try {
      await userService.unbanUser(user.id);
      toast('Cuenta reactivada.');
      await loadModerationItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">Moderación</div>
        <div className="page-subtitle">Gestión operativa de canciones, álbumes y cuentas de la plataforma.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODERATION_TABS.map(([value, label]) => (
            <button
              key={value}
              className={`filter-btn${activeTab === value ? ' active' : ''}`}
              onClick={() => {
                setActiveTab(value);
                setBanDraft((current) => ({ ...current, user: null }));
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <SearchInput
          cooldownUntil={searchController.cooldownUntil}
          placeholder={getSearchPlaceholder(activeTab)}
          value={searchController.searchValue}
          onChange={searchController.setSearchValue}
          onSubmit={searchController.submitSearch}
        />
      </div>

      {isLoading && <InlineState title="Cargando moderación..." />}
      {error && <InlineState title="No se pudo cargar la moderación" message={error} onRetry={loadModerationItems} />}
      {actionError && <InlineState title="No se pudo aplicar la acción" message={actionError} />}

      {!isLoading && !error && activeTab === 'tracks' && (
        <ModerationTable
          emptyTitle={moderationSearchTerm ? 'Sin canciones para esta busqueda' : 'No hay canciones registradas'}
          headers={['Canción', 'Artista', 'Álbum', 'Estado', 'Fecha', 'Acción']}
          label="canciones"
          pagination={pagination}
          rows={tracks.map(track => ({
            key: track.trackId,
            cells: [
              <div key="track-title">
                <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{track.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{track.genre}</div>
              </div>,
              track.artistName,
              track.albumTitle ?? 'Sencillo',
              <CatalogStatusBadge key="track-status" status={track.status} />,
              <span key="track-created-at" style={{ color: 'var(--t2)' }}>{formatDate(track.createdAt)}</span>,
              track.status === 'RETIRADO' ? (
                <ReinstateActionButton
                  key="track-action"
                  disabled={isActionLoading}
                  onClick={() => confirmReinstateTrack(track)}
                />
              ) : (
                <RetireActionButton
                  key="track-action"
                  disabled={isActionLoading}
                  onClick={() => confirmRetireTrack(track)}
                />
              ),
            ],
          }))}
        />
      )}

      {!isLoading && !error && activeTab === 'albums' && (
        <ModerationTable
          emptyTitle={moderationSearchTerm ? 'Sin álbumes para esta busqueda' : 'No hay álbumes registrados'}
          headers={['Álbum', 'Artista', 'Canciones', 'Estado', 'Fecha', 'Acción']}
          label="álbumes"
          pagination={pagination}
          rows={albums.map(album => ({
            key: album.albumId,
            cells: [
              <span key="album-title" style={{ fontWeight: 600, color: 'var(--t1)' }}>{album.title}</span>,
              album.artistName,
              formatMetricNumber(album.trackCount),
              <CatalogStatusBadge key="album-status" status={album.status} />,
              <span key="album-created-at" style={{ color: 'var(--t2)' }}>{formatDate(album.createdAt)}</span>,
              album.status === 'RETIRADO' ? (
                <ReinstateActionButton
                  key="album-action"
                  disabled={isActionLoading}
                  onClick={() => confirmReinstateAlbum(album)}
                />
              ) : (
                <RetireActionButton
                  key="album-action"
                  disabled={isActionLoading}
                  onClick={() => confirmRetireAlbum(album)}
                />
              ),
            ],
          }))}
        />
      )}

      {!isLoading && !error && activeTab === 'users' && (
        <>
          <BanAccountPanel
            draft={banDraft}
            isLoading={isActionLoading}
            onCancel={() => setBanDraft((current) => ({ ...current, user: null }))}
            onChange={handleBanDraftChange}
            onSubmit={handleBanSubmit}
          />

          <ModerationTable
            emptyTitle={moderationSearchTerm ? 'Sin cuentas para esta busqueda' : 'No hay cuentas registradas'}
            headers={['Cuenta', 'Rol', 'Estado', 'Suspensión', 'Alta', 'Acción']}
            label="cuentas"
            pagination={pagination}
            rows={users.map(user => ({
              key: user.id,
              cells: [
                <div key="user-identity">
                  <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{user.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{user.email}</div>
                </div>,
                <span key="user-role" className={getRoleBadgeClass(user.role)}>{getRoleLabel(user.role)}</span>,
                <span key="user-state">
                  <span className={`status-dot ${user.isActive ? 'status-active' : 'status-suspended'}`} />
                  {user.isActive ? 'Activa' : 'Inactiva'}
                </span>,
                <div key="user-ban-status">
                  <div>{getBanStatusLabel(user.banStatus)}</div>
                  {user.bannedUntil && (
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>Hasta {formatDate(user.bannedUntil)}</div>
                  )}
                </div>,
                <span key="user-created-at" style={{ color: 'var(--t2)' }}>{formatDate(user.createdAt)}</span>,
                <UserModerationAction
                  key="user-action"
                  isLoading={isActionLoading}
                  onBan={openBanPanel}
                  onUnban={handleUnbanUser}
                  user={user}
                />,
              ],
            }))}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        message={confirmation?.message ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirmar'}
        isLoading={isActionLoading}
        onConfirm={() => confirmation?.onConfirm()}
        onCancel={() => setConfirmation(null)}
      />
    </div>
  );
}

AdminModerationPage.propTypes = {
  toast: PropTypes.func,
};

AdminModerationPage.defaultProps = {
  toast: () => {},
};
