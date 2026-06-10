import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { ArtifactEmptyState } from '@/features/sidebar-right/artifact-loader';

import '@finos/perspective-viewer/dist/css/themes.css';
import '@finos/perspective-viewer-datagrid/dist/css/perspective-viewer-datagrid.css';
import '@finos/perspective-viewer-d3fc/dist/css/perspective-viewer-d3fc.css';

const PERSPECTIVE_LOAD_TIMEOUT_MS = 60000;
const PERSPECTIVE_INIT_TIMEOUT_MS = 15000;

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error) {
  if (!error) return 'Unable to load the analytics workspace.';
  return error instanceof Error ? error.message : String(error);
}

function cleanupPerspectiveResources({ table, worker }) {
  if (table?.delete) {
    Promise.resolve(table.delete()).catch(() => {});
  }
  if (worker?.terminate) {
    Promise.resolve(worker.terminate()).catch(() => {});
  }
}

function withTimeout(promise, timeoutMs, stage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Timed out while ${stage}.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function PerspectiveDashboard({ data }) {
  const theme = useTheme();
  const viewerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const perspectiveTheme = theme.palette.mode === 'dark' ? 'Pro Dark' : 'Pro Light';

  const rows = useMemo(() => (
    Array.isArray(data) ? data.filter(isRecord) : []
  ), [data]);

  // Handle parent container resizing
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || typeof ResizeObserver === 'undefined') return undefined;

    let frameId = null;
    const observer = new ResizeObserver(() => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (viewer.resize) {
          Promise.resolve(viewer.resize()).catch(() => {});
        }
      });
    });

    if (viewer.parentElement) {
      observer.observe(viewer.parentElement);
    } else {
      observer.observe(viewer);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      if (viewer.setAttribute) {
        viewer.setAttribute('theme', perspectiveTheme);
      }
      if (viewer.restore) {
        Promise.resolve(viewer.restore({ theme: perspectiveTheme })).catch(() => {});
      }
      if (viewer.restyleElement) {
        Promise.resolve(viewer.restyleElement()).catch(() => {});
      }
    }
  }, [perspectiveTheme]);

  useEffect(() => {
    if (!rows.length) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    let cancelled = false;
    let table = null;
    let worker = null;
    let viewer = null;

    async function loadPerspective() {
      setStatus('loading');
      setError(null);
      setLoadingMessage('Loading Perspective modules');

      try {
        const modules = await withTimeout(
          Promise.all([
            import('@finos/perspective-viewer/dist/esm/perspective-viewer.inline.js'),
            import('@finos/perspective-viewer-datagrid'),
            import('@finos/perspective-viewer-d3fc'),
            import('@finos/perspective/dist/esm/perspective.inline.js'),
          ]),
          PERSPECTIVE_INIT_TIMEOUT_MS,
          'loading Perspective modules',
        );
        const { default: perspective } = modules[3];

        if (cancelled) return;

        await customElements.whenDefined('perspective-viewer');

        if (cancelled) return;

        viewer = viewerRef.current;
        if (!viewer?.load) {
          throw new Error('Perspective viewer element is not ready.');
        }

        setLoadingMessage('Creating Perspective worker');
        worker = await withTimeout(
          perspective.worker(),
          PERSPECTIVE_INIT_TIMEOUT_MS,
          'creating the Perspective worker',
        );

        if (cancelled) {
          cleanupPerspectiveResources({ worker });
          return;
        }

        setLoadingMessage(`Loading ${rows.length.toLocaleString()} rows`);
        table = await withTimeout(
          worker.table(rows),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'creating the Perspective table',
        );

        if (cancelled) {
          cleanupPerspectiveResources({ table, worker });
          return;
        }

        setLoadingMessage('Rendering analytics workspace');
        await withTimeout(
          viewer.load(table),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'rendering the Perspective viewer',
        );

        if (cancelled) return;

        if (!cancelled) setStatus('ready');

        if (viewer.restore) {
          Promise.resolve(viewer.restore({ plugin: 'Datagrid' })).catch(() => {});
        }
        if (viewer.flush) {
          Promise.resolve(viewer.flush()).catch(() => {});
        }
        if (viewer.resize) {
          Promise.resolve(viewer.resize()).catch(() => {});
        }
      } catch (loadError) {
        cleanupPerspectiveResources({ table, worker });
        if (!cancelled) {
          setError(loadError);
          setStatus('error');
        }
      }
    }

    loadPerspective();

    return () => {
      cancelled = true;
      if (viewer?.delete) {
        Promise.resolve(viewer.delete()).catch(() => {});
      }
      cleanupPerspectiveResources({ table, worker });
    };
  }, [rows]);

  if (!rows.length) {
    return (
      <ArtifactEmptyState
        icon={<InsightsRoundedIcon sx={{ fontSize: 48 }} />}
        title="No data available for analysis"
      />
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 600,
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        boxShadow: theme.palette.mode === 'dark'
          ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.08)}, 0 8px 40px ${alpha('#000', 0.5)}`
          : `0 1px 2px ${alpha('#000', 0.06)}, 0 6px 24px ${alpha('#000', 0.07)}`,
        background: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.6)
          : theme.palette.background.paper,
        '& perspective-viewer': {
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: 600,
        },
      }}
    >
      <perspective-viewer
        ref={viewerRef}
        theme={perspectiveTheme}
        style={{
          '--psp-font-family': theme.typography.fontFamily,
          '--psp-datagrid--font-size': '13px',
          '--psp-datagrid-pos-color': theme.palette.success.main,
          '--psp-datagrid-neg-color': theme.palette.error.main,
        }}
      />

      {status === 'loading' ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{
            position: 'absolute',
            inset: 0,
            backdropFilter: 'blur(6px)',
            bgcolor: alpha(
              theme.palette.background.paper,
              theme.palette.mode === 'dark' ? 0.55 : 0.70,
            ),
            zIndex: 1,
          }}
        >
          <CircularProgress
            size={28}
            thickness={3}
            sx={{ color: theme.palette.primary.main }}
          />
          <Typography
            sx={{
              ...theme.typography.uiCaptionMd,
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {loadingMessage || 'Loading analytics workspace'}
          </Typography>
        </Stack>
      ) : null}

      {status === 'error' ? (
        <ArtifactEmptyState
          icon={<InsightsRoundedIcon sx={{ fontSize: 40 }} />}
          title="Unable to load analytics workspace"
          message={getErrorMessage(error)}
          sx={{
            position: 'absolute',
            inset: 0,
            backdropFilter: 'blur(6px)',
            bgcolor: alpha(
              theme.palette.background.paper,
              theme.palette.mode === 'dark' ? 0.75 : 0.88,
            ),
            zIndex: 2,
          }}
        />
      ) : null}
    </Box>
  );
}

export default memo(PerspectiveDashboard);