import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Fade,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { USER } from '@/api/endpoints';
import { getContextMetrics } from '@/api/user';
import { useAuth } from '@/contexts/AuthContext';

const SYSTEM_FONT_MONO = '"JetBrains Mono", "Fira Code", Monaco, Consolas, monospace';
const SYSTEM_FONT_SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const ADMIN_COLORS = {
  ink: '#f7f3ea',
  muted: '#a59f93',
  panel: '#121211',
  panelRaised: '#181715',
  line: '#34322d',
  blueprint: '#7ca7ff',
  ledger: '#a8d77b',
  amber: '#e0ad58',
  danger: '#ff8f8f',
  steel: '#b9c1cc',
};

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);

const formatLatency = (latency) => {
  if (latency === null || latency === undefined) return 'No signal';
  return `${latency} ms`;
};

const formatSeconds = (value) => {
  if (value === null || value === undefined) return 'Inactive';
  if (value <= 0) return 'Expired';

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

function getStatusTone(apiHealth) {
  if (apiHealth.checking) {
    return {
      label: 'Checking',
      color: ADMIN_COLORS.amber,
      copy: 'Verifying backend availability',
    };
  }

  if (apiHealth.online) {
    return {
      label: 'Online',
      color: ADMIN_COLORS.ledger,
      copy: `Backend responding in ${formatLatency(apiHealth.latency)}`,
    };
  }

  return {
    label: 'Offline',
    color: ADMIN_COLORS.danger,
    copy: 'Backend connection is unavailable',
  };
}

function Surface({ children, sx }) {
  return (
    <Box
      sx={{
        borderRadius: '8px',
        border: `1px solid ${alpha(ADMIN_COLORS.line, 0.82)}`,
        background: `linear-gradient(145deg, ${alpha(ADMIN_COLORS.panelRaised, 0.98)}, ${alpha(ADMIN_COLORS.panel, 0.98)})`,
        boxShadow: `0 24px 70px ${alpha('#000', 0.38)}`,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function SectionLabel({ eyebrow, title, action }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 1.75,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: ADMIN_COLORS.muted,
            fontFamily: SYSTEM_FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          sx={{
            mt: 0.35,
            color: ADMIN_COLORS.ink,
            fontFamily: SYSTEM_FONT_SANS,
            fontSize: { xs: 19, sm: 22 },
            fontWeight: 750,
            lineHeight: 1.15,
          }}
        >
          {title}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}

function StatusChip({ label, color }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.9,
        minHeight: 34,
        px: 1.25,
        borderRadius: '999px',
        border: `1px solid ${alpha(color, 0.34)}`,
        bgcolor: alpha(color, 0.08),
        color,
        fontFamily: SYSTEM_FONT_MONO,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: color,
          boxShadow: `0 0 18px ${alpha(color, 0.75)}`,
        }}
      />
      {label}
    </Box>
  );
}

function MetricTile({ icon, label, value, detail, color }) {
  const Icon = icon;

  return (
    <Surface
      sx={{
        p: { xs: 2, sm: 2.25 },
        minHeight: 150,
        display: 'grid',
        alignContent: 'space-between',
        position: 'relative',
        transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 3,
          bgcolor: color,
          opacity: 0.86,
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(color, 0.52),
          background: `linear-gradient(145deg, ${alpha(color, 0.08)}, ${alpha(ADMIN_COLORS.panel, 0.98)})`,
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography
          sx={{
            maxWidth: '13ch',
            color: ADMIN_COLORS.muted,
            fontFamily: SYSTEM_FONT_MONO,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.6,
            lineHeight: 1.35,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '8px',
            border: `1px solid ${alpha(color, 0.25)}`,
            bgcolor: alpha(color, 0.08),
            color,
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color,
            fontFamily: SYSTEM_FONT_MONO,
            fontSize: { xs: 30, sm: 34 },
            fontWeight: 850,
            letterSpacing: 0,
            lineHeight: 1,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            mt: 0.9,
            color: alpha(ADMIN_COLORS.ink, 0.62),
            fontFamily: SYSTEM_FONT_SANS,
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          {detail}
        </Typography>
      </Box>
    </Surface>
  );
}

function SignalRow({ icon, label, value, color }) {
  const Icon = icon;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 54,
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '8px',
          display: 'grid',
          placeItems: 'center',
          color,
          bgcolor: alpha(color, 0.08),
          border: `1px solid ${alpha(color, 0.2)}`,
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Typography
        sx={{
          color: ADMIN_COLORS.muted,
          fontFamily: SYSTEM_FONT_SANS,
          fontSize: 13,
          lineHeight: 1.3,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          color: ADMIN_COLORS.ink,
          fontFamily: SYSTEM_FONT_MONO,
          fontSize: 13,
          fontWeight: 800,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function CacheAperture({ hitRate, hits, misses }) {
  const missedRate = Math.max(0, 100 - hitRate);

  return (
    <Surface
      sx={{
        p: { xs: 2.25, sm: 3 },
        minHeight: '100%',
      }}
    >
      <SectionLabel eyebrow="Cache aperture" title="Context reuse quality" />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '220px minmax(0, 1fr)', md: '1fr' },
          alignItems: 'center',
          gap: { xs: 3, sm: 4, md: 3 },
        }}
      >
        <Box
          aria-label={`Cache hit rate ${hitRate}%`}
          sx={{
            mx: 'auto',
            width: { xs: 210, sm: 220 },
            maxWidth: '100%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            background: `
              conic-gradient(${ADMIN_COLORS.ledger} ${hitRate * 3.6}deg, ${alpha(ADMIN_COLORS.danger, 0.52)} 0deg),
              radial-gradient(circle, ${ADMIN_COLORS.panel} 57%, transparent 58%)
            `,
            boxShadow: `inset 0 0 0 1px ${alpha(ADMIN_COLORS.ink, 0.1)}, 0 22px 55px ${alpha('#000', 0.34)}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 13,
              borderRadius: '50%',
              border: `1px dashed ${alpha(ADMIN_COLORS.ink, 0.18)}`,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: '28%',
              borderRadius: '50%',
              border: `1px solid ${alpha(ADMIN_COLORS.blueprint, 0.22)}`,
              boxShadow: `0 0 0 34px ${alpha('#000', 0.18)}`,
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              width: '58%',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              bgcolor: alpha('#090908', 0.92),
              border: `1px solid ${alpha(ADMIN_COLORS.ink, 0.1)}`,
            }}
          >
            <Typography
              sx={{
                color: ADMIN_COLORS.ink,
                fontFamily: SYSTEM_FONT_MONO,
                fontSize: { xs: 42, sm: 46 },
                fontWeight: 900,
                lineHeight: 0.95,
              }}
            >
              {hitRate}
              <Box component="span" sx={{ color: ADMIN_COLORS.muted, fontSize: 18 }}>
                %
              </Box>
            </Typography>
            <Typography
              sx={{
                mt: -1,
                color: ADMIN_COLORS.muted,
                fontFamily: SYSTEM_FONT_MONO,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              hit rate
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.8}>
          <SignalRow
            icon={CheckCircleOutlineOutlinedIcon}
            label="Resolved from cache"
            value={formatNumber(hits)}
            color={ADMIN_COLORS.ledger}
          />
          <SignalRow
            icon={ErrorOutlineOutlinedIcon}
            label="Compiled from source"
            value={formatNumber(misses)}
            color={ADMIN_COLORS.danger}
          />
          <Divider sx={{ borderColor: alpha(ADMIN_COLORS.ink, 0.08) }} />
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.8 }}>
              <Typography sx={{ color: ADMIN_COLORS.muted, fontFamily: SYSTEM_FONT_SANS, fontSize: 13 }}>
                Miss pressure
              </Typography>
              <Typography sx={{ color: ADMIN_COLORS.ink, fontFamily: SYSTEM_FONT_MONO, fontSize: 13, fontWeight: 800 }}>
                {missedRate}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={missedRate}
              sx={{
                height: 8,
                borderRadius: '999px',
                bgcolor: alpha(ADMIN_COLORS.ink, 0.08),
                '& .MuiLinearProgress-bar': {
                  borderRadius: '999px',
                  bgcolor: missedRate > 30 ? ADMIN_COLORS.amber : ADMIN_COLORS.blueprint,
                },
              }}
            />
          </Box>
        </Stack>
      </Box>
    </Surface>
  );
}

function AdminDashboard() {
  const metricsRef = useRef(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiHealth, setApiHealth] = useState({ online: false, latency: null, checking: true });
  const [metricsError, setMetricsError] = useState(null);
  const [ttlRemaining, setTtlRemaining] = useState(null);
  const { user } = useAuth();

  const applyMetrics = useCallback((nextMetrics) => {
    metricsRef.current = nextMetrics;
    setMetrics(nextMetrics);

    const remaining = nextMetrics.config?.ttl_remaining;
    setTtlRemaining(remaining !== undefined ? remaining : null);
  }, []);

  const checkApiHealth = useCallback(async ({ initial = false } = {}) => {
    const startTime = performance.now();
    if (initial) {
      setApiHealth((prev) => ({ ...prev, checking: true }));
    } else {
      setRefreshing(true);
    }

    try {
      const healthResult = await fetch('/api/v1/')
        .then(async (res) => {
          const endTime = performance.now();
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
              return { online: true, latency: Math.round(endTime - startTime) };
            }
          }
          return { online: false, latency: null };
        })
        .catch(() => ({ online: false, latency: null }));

      setApiHealth({ ...healthResult, checking: false });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkApiHealth({ initial: true });
  }, [checkApiHealth]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setMetricsError('Sign in to view telemetry metrics.');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setMetricsError(null);

    getContextMetrics()
      .then((res) => {
        if (!active) return;
        applyMetrics(res.metrics);
        setMetricsError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Error fetching initial metrics:', err);
        setMetricsError(
          err.status
            ? `Initial metrics request failed with HTTP ${err.status}.`
            : 'Initial metrics request failed. Live telemetry will continue if Firestore is available.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyMetrics, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const events = new EventSource(USER.CONTEXT_METRICS_STREAM, {
      withCredentials: true,
    });

    events.addEventListener('metrics', (event) => {
      try {
        applyMetrics(JSON.parse(event.data));
        setMetricsError(null);
        setLoading(false);
      } catch (err) {
        console.error('Live telemetry payload error:', err);
        setMetricsError('Live telemetry payload could not be read.');
      }
    });

    events.onerror = () => {
      setMetricsError('Live telemetry stream disconnected. Refresh the page to reconnect.');
      setLoading(false);
    };

    return () => events.close();
  }, [applyMetrics, user?.uid]);

  useEffect(() => {
    if (ttlRemaining === null || ttlRemaining <= 0) return undefined;

    const timer = setInterval(() => {
      setTtlRemaining((prev) => {
        if (prev !== null && prev > 0) return prev - 1;
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [ttlRemaining]);

  const dashboardData = useMemo(() => {
    const hitRate = metrics ? Math.round(metrics.hit_rate_percent || 0) : 0;
    const hits = metrics?.hits || 0;
    const misses = metrics?.misses || 0;
    const totalQueries = hits + misses;
    const connectedDatabase = metrics?.config?.connected_database;
    const activeTableCount = metrics?.config?.active_table_count || 0;
    const remainingTables = connectedDatabase
      ? metrics?.config?.remaining_tables ?? 1000
      : metrics?.config?.schema_context_max_tables ?? 1000;

    return {
      hitRate,
      hits,
      misses,
      totalQueries,
      connectedDatabase,
      activeTableCount,
      remainingTables,
      ttlLabel: formatSeconds(ttlRemaining),
      metricsEnabled: Boolean(metrics?.metrics_enabled),
      stores: metrics?.stores || 0,
      clears: metrics?.clears || 0,
    };
  }, [metrics, ttlRemaining]);

  const statusTone = useMemo(() => getStatusTone(apiHealth), [apiHealth]);

  const summaryCards = useMemo(() => [
    {
      label: 'Cache TTL',
      value: dashboardData.ttlLabel,
      detail: ttlRemaining !== null ? 'Context cache countdown' : 'No active cache window',
      icon: TimerOutlinedIcon,
      color: ADMIN_COLORS.blueprint,
    },
    {
      label: 'Table Budget',
      value: formatNumber(dashboardData.remainingTables),
      detail: dashboardData.connectedDatabase
        ? `${dashboardData.activeTableCount} active in ${dashboardData.connectedDatabase}`
        : 'Waiting for database context',
      icon: StorageOutlinedIcon,
      color: ADMIN_COLORS.steel,
    },
    {
      label: 'Metrics Feed',
      value: dashboardData.metricsEnabled ? 'Live' : 'Quiet',
      detail: 'Realtime context instrumentation',
      icon: AutoGraphOutlinedIcon,
      color: dashboardData.metricsEnabled ? ADMIN_COLORS.ledger : ADMIN_COLORS.amber,
    },
  ], [dashboardData, ttlRemaining]);

  const operationStats = useMemo(() => [
    {
      label: 'Cache Hits',
      value: formatNumber(dashboardData.hits),
      detail: 'Served without recompilation',
      icon: CheckCircleOutlineOutlinedIcon,
      color: ADMIN_COLORS.ledger,
    },
    {
      label: 'Cache Misses',
      value: formatNumber(dashboardData.misses),
      detail: 'Required fresh context assembly',
      icon: ErrorOutlineOutlinedIcon,
      color: ADMIN_COLORS.danger,
    },
    {
      label: 'Writes',
      value: formatNumber(dashboardData.stores),
      detail: 'Stored context snapshots',
      icon: SaveOutlinedIcon,
      color: ADMIN_COLORS.blueprint,
    },
    {
      label: 'Clears',
      value: formatNumber(dashboardData.clears),
      detail: 'Cache invalidation events',
      icon: DeleteSweepOutlinedIcon,
      color: ADMIN_COLORS.amber,
    },
  ], [dashboardData]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        color: ADMIN_COLORS.ink,
        bgcolor: '#0c0c0b',
        backgroundImage: `
          linear-gradient(${alpha(ADMIN_COLORS.ink, 0.035)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(ADMIN_COLORS.ink, 0.025)} 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        fontFamily: SYSTEM_FONT_SANS,
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          minHeight: '100%',
          py: { xs: 2.25, sm: 3, lg: 4.5 },
          px: { xs: 1.5, sm: 3 },
        }}
      >
        <Fade in timeout={420}>
          <Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
                gap: { xs: 2.5, lg: 4 },
                alignItems: 'end',
                pb: { xs: 2.5, md: 3.25 },
                mb: { xs: 2.5, md: 3.5 },
                borderBottom: `1px solid ${alpha(ADMIN_COLORS.ink, 0.1)}`,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 1.5 }}>
                  <StatusChip label={statusTone.label} color={statusTone.color} />
                  <Typography
                    sx={{
                      color: ADMIN_COLORS.muted,
                      fontFamily: SYSTEM_FONT_MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.7,
                      textTransform: 'uppercase',
                    }}
                  >
                    {statusTone.copy}
                  </Typography>
                </Box>

                <Typography
                  component="h1"
                  sx={{
                    color: ADMIN_COLORS.ink,
                    fontFamily: SYSTEM_FONT_SANS,
                    fontSize: { xs: 38, sm: 56, lg: 70 },
                    fontWeight: 820,
                    letterSpacing: 0,
                    lineHeight: { xs: 0.98, sm: 0.94 },
                    maxWidth: 880,
                  }}
                >
                  Admin command surface
                </Typography>
                <Typography
                  sx={{
                    mt: { xs: 1.4, sm: 1.8 },
                    maxWidth: 660,
                    color: alpha(ADMIN_COLORS.ink, 0.68),
                    fontFamily: SYSTEM_FONT_SANS,
                    fontSize: { xs: 15, sm: 17 },
                    lineHeight: 1.55,
                  }}
                >
                  Live context-cache telemetry for the Moonlit agent runtime, shaped for quick operational reads.
                </Typography>
              </Box>

              <Surface
                sx={{
                  width: { xs: '100%', lg: 358 },
                  p: 2,
                  display: 'grid',
                  gridTemplateColumns: '42px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '8px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(statusTone.color, 0.1),
                    border: `1px solid ${alpha(statusTone.color, 0.28)}`,
                    color: statusTone.color,
                  }}
                >
                  <ApiOutlinedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: ADMIN_COLORS.ink, fontFamily: SYSTEM_FONT_MONO, fontSize: 13, fontWeight: 850 }}>
                    API relay
                  </Typography>
                  <Typography sx={{ color: ADMIN_COLORS.muted, fontFamily: SYSTEM_FONT_SANS, fontSize: 13 }}>
                    {formatLatency(apiHealth.latency)}
                  </Typography>
                </Box>
                <Tooltip title="Check API relay">
                  <span>
                    <IconButton
                      aria-label="Check API relay"
                      onClick={() => checkApiHealth()}
                      disabled={refreshing}
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '8px',
                        color: ADMIN_COLORS.ink,
                        border: `1px solid ${alpha(ADMIN_COLORS.ink, 0.12)}`,
                        '&:hover': {
                          bgcolor: alpha(ADMIN_COLORS.ink, 0.08),
                        },
                        '&.Mui-focusVisible': {
                          boxShadow: `0 0 0 4px ${alpha(ADMIN_COLORS.blueprint, 0.22)}`,
                        },
                      }}
                    >
                      {refreshing ? <CircularProgress size={17} sx={{ color: ADMIN_COLORS.ink }} /> : <RefreshRoundedIcon sx={{ fontSize: 19 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Surface>
            </Box>

            {!apiHealth.checking && !apiHealth.online && (
              <Surface
                sx={{
                  mb: 3,
                  p: { xs: 1.75, sm: 2 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderColor: alpha(ADMIN_COLORS.danger, 0.38),
                  background: `linear-gradient(135deg, ${alpha(ADMIN_COLORS.danger, 0.12)}, ${alpha(ADMIN_COLORS.panel, 0.98)})`,
                }}
              >
                <ErrorOutlineOutlinedIcon sx={{ color: ADMIN_COLORS.danger, fontSize: 22 }} />
                <Typography sx={{ color: ADMIN_COLORS.ink, fontFamily: SYSTEM_FONT_SANS, fontSize: 14, lineHeight: 1.45 }}>
                  Backend connection is offline. Metrics will resume when the API relay responds.
                </Typography>
              </Surface>
            )}

            {metricsError && apiHealth.online && (
              <Surface
                sx={{
                  mb: 3,
                  p: { xs: 1.75, sm: 2 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderColor: alpha(ADMIN_COLORS.amber, 0.38),
                  background: `linear-gradient(135deg, ${alpha(ADMIN_COLORS.amber, 0.12)}, ${alpha(ADMIN_COLORS.panel, 0.98)})`,
                }}
              >
                <ErrorOutlineOutlinedIcon sx={{ color: ADMIN_COLORS.amber, fontSize: 22 }} />
                <Typography sx={{ color: ADMIN_COLORS.ink, fontFamily: SYSTEM_FONT_SANS, fontSize: 14, lineHeight: 1.45 }}>
                  {metricsError}
                </Typography>
              </Surface>
            )}

            {loading ? (
              <Surface
                sx={{
                  minHeight: 420,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={48} thickness={3.5} sx={{ color: ADMIN_COLORS.blueprint }} />
                  <Typography
                    sx={{
                      mt: 2,
                      color: ADMIN_COLORS.muted,
                      fontFamily: SYSTEM_FONT_MONO,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Reading runtime telemetry
                  </Typography>
                </Box>
              </Surface>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 0.9fr) minmax(0, 1.35fr)' },
                  gap: { xs: 2.25, md: 3 },
                }}
              >
                <Box sx={{ display: 'grid', gap: { xs: 2.25, md: 3 }, alignContent: 'start' }}>
                  <CacheAperture
                    hitRate={dashboardData.hitRate}
                    hits={dashboardData.hits}
                    misses={dashboardData.misses}
                  />

                  <Surface sx={{ p: { xs: 2.25, sm: 3 } }}>
                    <SectionLabel eyebrow="Runtime summary" title="Current operating limits" />
                    <Stack divider={<Divider sx={{ borderColor: alpha(ADMIN_COLORS.ink, 0.08) }} />}>
                      <SignalRow
                        icon={BoltOutlinedIcon}
                        label="Total context requests"
                        value={formatNumber(dashboardData.totalQueries)}
                        color={ADMIN_COLORS.blueprint}
                      />
                      <SignalRow
                        icon={MemoryOutlinedIcon}
                        label="Metrics capture"
                        value={dashboardData.metricsEnabled ? 'Enabled' : 'Disabled'}
                        color={dashboardData.metricsEnabled ? ADMIN_COLORS.ledger : ADMIN_COLORS.amber}
                      />
                      <SignalRow
                        icon={AdminPanelSettingsOutlinedIcon}
                        label="Signed-in operator"
                        value={user?.email || 'Active'}
                        color={ADMIN_COLORS.steel}
                      />
                    </Stack>
                  </Surface>
                </Box>

                <Box sx={{ display: 'grid', gap: { xs: 2.25, md: 3 }, alignContent: 'start' }}>
                  <Box>
                    <SectionLabel
                      eyebrow="Configuration"
                      title="Foundation signals"
                      action={
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CachedOutlinedIcon />}
                          onClick={() => checkApiHealth()}
                          disabled={refreshing}
                          sx={{
                            display: { xs: 'none', sm: 'inline-flex' },
                            minHeight: 36,
                            borderRadius: '8px',
                            color: ADMIN_COLORS.ink,
                            borderColor: alpha(ADMIN_COLORS.ink, 0.16),
                            fontFamily: SYSTEM_FONT_SANS,
                            fontWeight: 750,
                            textTransform: 'none',
                            '&:hover': {
                              borderColor: alpha(ADMIN_COLORS.blueprint, 0.5),
                              bgcolor: alpha(ADMIN_COLORS.blueprint, 0.08),
                            },
                          }}
                        >
                          Check relay
                        </Button>
                      }
                    />
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                        gap: 1.5,
                      }}
                    >
                      {summaryCards.map((card) => (
                        <MetricTile key={card.label} {...card} />
                      ))}
                    </Box>
                  </Box>

                  <Box>
                    <SectionLabel eyebrow="Operations" title="Cache movement" />
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.5,
                      }}
                    >
                      {operationStats.map((stat) => (
                        <MetricTile key={stat.label} {...stat} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}

export default AdminDashboard;
