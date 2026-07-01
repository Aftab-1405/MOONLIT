import {
  Box,
  CircularProgress,
  Container,
  Fade,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Activity,
  BarChart3,
  Check,
  Database,
  RefreshCw,
  Save,
  Server,
  Timer,
  Trash2,
  TriangleAlert,
  UserRound,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { USER } from '@/api/endpoints';
import { getContextMetrics } from '@/api/user';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/utils/logger';

const FONT_MONO = '"JetBrains Mono", "Fira Code", Monaco, Consolas, monospace';
const FONT_SANS =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 };

const LABEL_SX = {
  color: 'text.secondary',
  fontFamily: FONT_SANS,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  lineHeight: 1.35,
  textTransform: 'uppercase',
};

const ICON_PROPS = { size: 18, strokeWidth: 1.75, 'aria-hidden': true };

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
      color: 'warning.main',
      copy: 'Verifying backend availability',
    };
  }

  if (apiHealth.online) {
    return {
      label: 'Online',
      color: 'primary.main',
      copy: 'Backend responding normally',
    };
  }

  return {
    label: 'Offline',
    color: 'warning.main',
    copy: 'Backend connection is unavailable',
  };
}

function Card({ children, sx = {}, component = 'section', ...props }) {
  return (
    <Box
      component={component}
      sx={{
        borderRadius: '8px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 1px 2px rgba(0, 0, 0, 0.35)'
            : '0 1px 3px rgba(0, 0, 0, 0.05)',
        p: `${SPACE[6]}px`,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

function CardHeader({ label, title, icon: Icon }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: `${SPACE[4]}px`,
        mb: `${SPACE[6]}px`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={LABEL_SX}>{label}</Typography>
        <Typography
          sx={{
            mt: `${SPACE[1]}px`,
            color: 'text.primary',
            fontFamily: FONT_SANS,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
      </Box>
      {Icon && (
        <Box sx={{ color: 'text.secondary', lineHeight: 0 }}>
          <Icon {...ICON_PROPS} />
        </Box>
      )}
    </Box>
  );
}

function MetricRow({ icon, label, value, detail, tone = 'neutral' }) {
  const Icon = icon;
  const color =
    tone === 'good' ? 'primary.main' : tone === 'warning' ? 'warning.main' : 'text.primary';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '32px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: `${SPACE[3]}px`,
        py: `${SPACE[3]}px`,
        minHeight: 64,
      }}
    >
      <Box sx={{ color: 'text.secondary', lineHeight: 0 }}>
        <Icon {...ICON_PROPS} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: 'text.primary',
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            mt: `${SPACE[1]}px`,
            color: 'text.secondary',
            fontFamily: FONT_SANS,
            fontSize: 12,
            lineHeight: 1.3,
          }}
        >
          {detail}
        </Typography>
      </Box>
      <Typography
        sx={{
          color,
          fontFamily: FONT_MONO,
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function HitRateCard({ hitRate, hits, misses }) {
  const missedRate = Math.max(0, 100 - hitRate);

  return (
    <Card sx={{ height: '100%', minHeight: 300 }}>
      <CardHeader label="Cache efficiency" title="Context reuse" icon={BarChart3} />
      <Typography
        aria-label={`Cache hit rate ${hitRate}%`}
        sx={{
          color: 'text.primary',
          fontFamily: FONT_MONO,
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {hitRate}
        <Box
          component="span"
          sx={{ ml: `${SPACE[1]}px`, color: 'text.secondary', fontSize: 20, fontWeight: 500 }}
        >
          %
        </Box>
      </Typography>
      <Typography sx={{ ...LABEL_SX, mt: `${SPACE[2]}px` }}>Hit rate</Typography>
      <LinearProgress
        variant="determinate"
        value={hitRate}
        sx={{
          mt: `${SPACE[6]}px`,
          height: 6,
          borderRadius: '999px',
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
          '& .MuiLinearProgress-bar': { borderRadius: '999px', bgcolor: 'primary.main' },
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE[4]}px`,
          mt: `${SPACE[6]}px`,
        }}
      >
        <Box>
          <Typography sx={LABEL_SX}>Cache hits</Typography>
          <Typography
            sx={{
              mt: `${SPACE[1]}px`,
              color: 'primary.main',
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {formatNumber(hits)}
          </Typography>
        </Box>
        <Box>
          <Typography sx={LABEL_SX}>Miss pressure</Typography>
          <Typography
            sx={{
              mt: `${SPACE[1]}px`,
              color: missedRate > 30 ? 'warning.main' : 'text.primary',
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {formatNumber(misses)} · {missedRate}%
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function ApiStatusCard({ statusTone, apiHealth, refreshing, onRefresh }) {
  return (
    <Card
      sx={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: `${SPACE[4]}px`,
        p: `${SPACE[4]}px`,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '8px',
          bgcolor: (theme) => {
            const [key] = statusTone.color.split('.');
            return alpha(theme.palette[key].main, 0.1);
          },
          color: statusTone.color,
        }}
      >
        <Server {...ICON_PROPS} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${SPACE[2]}px` }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              flex: '0 0 auto',
              borderRadius: '50%',
              bgcolor: statusTone.color,
            }}
          />
          <Typography sx={{ ...LABEL_SX, color: statusTone.color }}>
            API relay · {statusTone.label}
          </Typography>
        </Box>
        <Typography
          sx={{
            mt: `${SPACE[1]}px`,
            color: 'text.primary',
            fontFamily: FONT_MONO,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {formatLatency(apiHealth.latency)}
        </Typography>
        <Typography
          sx={{ mt: `${SPACE[1]}px`, color: 'text.secondary', fontFamily: FONT_SANS, fontSize: 12 }}
        >
          {statusTone.copy}
        </Typography>
      </Box>
      <Tooltip title="Check API relay">
        <span>
          <IconButton
            aria-label="Check API relay"
            onClick={onRefresh}
            disabled={refreshing}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              color: 'text.secondary',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
                color: 'text.primary',
              },
              '&.Mui-focusVisible': {
                boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
              },
            }}
          >
            {refreshing ? (
              <CircularProgress size={16} sx={{ color: 'text.primary' }} />
            ) : (
              <RefreshCw {...ICON_PROPS} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Card>
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
    if (!nextMetrics) return;
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
        logger.error('Error fetching initial metrics:', err);
        setMetricsError(
          err.status
            ? `Initial metrics request failed with HTTP ${err.status}.`
            : 'Initial metrics request failed. Live telemetry will continue if Firestore is available.',
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
        logger.error('Live telemetry payload error:', err);
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
    const timer = setInterval(() => {
      setTtlRemaining((prev) => {
        if (prev !== null && prev > 0) return prev - 1;
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const dashboardData = useMemo(() => {
    const hitRate = metrics ? Math.round(metrics.hit_rate_percent || 0) : 0;
    const hits = metrics?.hits || 0;
    const misses = metrics?.misses || 0;
    const totalQueries = hits + misses;
    const connectedDatabase = metrics?.config?.connected_database;
    const activeTableCount = metrics?.config?.active_table_count || 0;
    const remainingTables = connectedDatabase
      ? (metrics?.config?.remaining_tables ?? 1000)
      : (metrics?.config?.schema_context_max_tables ?? 1000);

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

  const configurationStats = useMemo(
    () => [
      {
        label: 'Cache TTL',
        value: dashboardData.ttlLabel,
        detail: ttlRemaining !== null ? 'Context cache countdown' : 'No active cache window',
        icon: Timer,
      },
      {
        label: 'Table Budget',
        value: formatNumber(dashboardData.remainingTables),
        detail: dashboardData.connectedDatabase
          ? `${dashboardData.activeTableCount} active in ${dashboardData.connectedDatabase}`
          : 'Waiting for database context',
        icon: Database,
      },
      {
        label: 'Metrics Feed',
        value: dashboardData.metricsEnabled ? 'Live' : 'Quiet',
        detail: 'Realtime context instrumentation',
        icon: Activity,
        tone: dashboardData.metricsEnabled ? 'good' : 'warning',
      },
    ],
    [dashboardData, ttlRemaining],
  );

  const operationStats = useMemo(
    () => [
      {
        label: 'Cache Hits',
        value: formatNumber(dashboardData.hits),
        detail: 'Served without recompilation',
        icon: Check,
        tone: 'good',
      },
      {
        label: 'Cache Misses',
        value: formatNumber(dashboardData.misses),
        detail: 'Required fresh context assembly',
        icon: TriangleAlert,
        tone: 'warning',
      },
      {
        label: 'Writes',
        value: formatNumber(dashboardData.stores),
        detail: 'Stored context snapshots',
        icon: Save,
      },
      {
        label: 'Clears',
        value: formatNumber(dashboardData.clears),
        detail: 'Cache invalidation events',
        icon: Trash2,
        tone: dashboardData.clears > 0 ? 'warning' : 'neutral',
      },
    ],
    [dashboardData],
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        color: 'text.primary',
        bgcolor: 'background.default',
        fontFamily: FONT_SANS,
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          minHeight: '100%',
          py: { xs: `${SPACE[6]}px`, lg: `${SPACE[8]}px` },
          px: { xs: `${SPACE[4]}px`, sm: `${SPACE[6]}px` },
        }}
      >
        <Fade in timeout={320}>
          <Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                gap: `${SPACE[6]}px`,
                alignItems: 'center',
                pb: `${SPACE[8]}px`,
                mb: `${SPACE[6]}px`,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', lg: 'span 8' } }}>
                <Typography sx={LABEL_SX}>Moonlit runtime</Typography>
                <Typography
                  component="h1"
                  sx={{
                    mt: `${SPACE[2]}px`,
                    color: 'text.primary',
                    fontFamily: FONT_SANS,
                    fontSize: { xs: 26, sm: 32 },
                    fontWeight: 650,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.15,
                  }}
                >
                  Operations overview
                </Typography>
                <Typography
                  sx={{
                    mt: `${SPACE[2]}px`,
                    maxWidth: 660,
                    color: 'text.secondary',
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Live context-cache telemetry and runtime health.
                </Typography>
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', lg: 'span 4' } }}>
                <ApiStatusCard
                  statusTone={statusTone}
                  apiHealth={apiHealth}
                  refreshing={refreshing}
                  onRefresh={() => checkApiHealth()}
                />
              </Box>
            </Box>

            {!apiHealth.checking && !apiHealth.online && (
              <Card
                role="alert"
                sx={{
                  mb: `${SPACE[6]}px`,
                  p: `${SPACE[4]}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACE[3]}px`,
                  borderColor: (theme) => alpha(theme.palette.warning.main, 0.45),
                }}
              >
                <Box sx={{ color: 'warning.main', lineHeight: 0 }}>
                  <TriangleAlert {...ICON_PROPS} />
                </Box>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  Backend connection is offline. Metrics will resume when the API relay responds.
                </Typography>
              </Card>
            )}

            {metricsError && apiHealth.online && (
              <Card
                role="alert"
                sx={{
                  mb: `${SPACE[6]}px`,
                  p: `${SPACE[4]}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACE[3]}px`,
                  borderColor: (theme) => alpha(theme.palette.warning.main, 0.45),
                }}
              >
                <Box sx={{ color: 'warning.main', lineHeight: 0 }}>
                  <TriangleAlert {...ICON_PROPS} />
                </Box>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {metricsError}
                </Typography>
              </Card>
            )}

            {loading ? (
              <Card
                sx={{
                  minHeight: 420,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={32} thickness={3.5} sx={{ color: 'primary.main' }} />
                  <Typography sx={{ ...LABEL_SX, mt: `${SPACE[4]}px` }}>
                    Reading runtime telemetry
                  </Typography>
                </Box>
              </Card>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                  gap: `${SPACE[6]}px`,
                  '& > *': { minWidth: 0 },
                }}
              >
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6', lg: 'span 4' } }}>
                  <HitRateCard
                    hitRate={dashboardData.hitRate}
                    hits={dashboardData.hits}
                    misses={dashboardData.misses}
                  />
                </Box>
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6', lg: 'span 4' } }}>
                  <Card sx={{ height: '100%', minHeight: 300 }}>
                    <CardHeader
                      label="Runtime summary"
                      title="Current operating limits"
                      icon={Zap}
                    />
                    <Box
                      sx={{
                        '& > *:not(:last-child)': {
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        },
                      }}
                    >
                      <MetricRow
                        icon={Zap}
                        label="Total context requests"
                        detail="Hits and misses combined"
                        value={formatNumber(dashboardData.totalQueries)}
                      />
                      <MetricRow
                        icon={Activity}
                        label="Metrics capture"
                        detail="Runtime instrumentation"
                        value={dashboardData.metricsEnabled ? 'Enabled' : 'Disabled'}
                        tone={dashboardData.metricsEnabled ? 'good' : 'warning'}
                      />
                      <MetricRow
                        icon={UserRound}
                        label="Signed-in operator"
                        detail="Current admin session"
                        value={user?.email || 'Active'}
                      />
                    </Box>
                  </Card>
                </Box>
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6', lg: 'span 4' } }}>
                  <Card sx={{ height: '100%', minHeight: 300 }}>
                    <CardHeader label="Configuration" title="Foundation signals" icon={Database} />
                    <Box
                      sx={{
                        '& > *:not(:last-child)': {
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        },
                      }}
                    >
                      {configurationStats.map((stat) => (
                        <MetricRow key={stat.label} {...stat} />
                      ))}
                    </Box>
                  </Card>
                </Box>
                <Card sx={{ gridColumn: '1 / -1' }}>
                  <CardHeader label="Operations" title="Cache movement" icon={Activity} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                    {operationStats.map((stat, index) => (
                      <Box
                        key={stat.label}
                        sx={{
                          gridColumn: { xs: 'span 12', sm: 'span 6', lg: 'span 3' },
                          px: { xs: 0, sm: `${SPACE[4]}px` },
                          borderLeft: {
                            sm: index % 2 === 0 ? 'none' : '1px solid',
                            lg: index === 0 ? 'none' : '1px solid',
                          },
                          borderLeftColor: 'divider',
                          borderTop: {
                            xs: index === 0 ? 'none' : '1px solid',
                            sm: index < 2 ? 'none' : '1px solid',
                            lg: 'none',
                          },
                          borderTopColor: 'divider',
                        }}
                      >
                        <MetricRow {...stat} />
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Box>
            )}
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}

export default AdminDashboard;
