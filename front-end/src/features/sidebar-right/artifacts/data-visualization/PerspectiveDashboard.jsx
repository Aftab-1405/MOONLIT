import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ArtifactEmptyState } from '@/features/sidebar-right/artifact-loader';
import {
  clearAnalysisConfig,
  inferColumnType,
  loadAnalysisConfig,
  saveAnalysisConfig,
  toColumnar,
} from '@/features/sidebar-right/artifacts/data-visualization/perspectiveAnalysis';

import '@perspective-dev/viewer/themes';

const PERSPECTIVE_LOAD_TIMEOUT_MS = 60000;
const PERSPECTIVE_INIT_TIMEOUT_MS = 15000;

function getErrorMessage(error) {
  if (!error) return 'Unable to load the analytics workspace.';
  return error instanceof Error ? error.message : String(error);
}

async function cleanupPerspectiveResources({ viewer, table, worker }) {
  if (viewer?.delete) {
    try {
      await viewer.delete();
    } catch (e) {
      console.warn('Warning during viewer cleanup:', e);
    }
  }
  if (table?.delete) {
    try {
      await table.delete();
    } catch (e) {
      console.warn('Warning during table cleanup:', e);
    }
  }
  if (worker?.terminate) {
    try {
      await worker.terminate();
    } catch (e) {
      console.warn('Warning during worker cleanup:', e);
    }
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

const PerspectiveDashboard = forwardRef(function PerspectiveDashboard(
  { data, storageKey, onReadyChange, onSelectionChange },
  ref,
) {
  const theme = useTheme();
  const viewerRef = useRef(null);
  const previousInputRef = useRef({ data, storageKey });
  const viewerVersionRef = useRef(0);
  const configSaveTimerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const perspectiveTheme = theme.palette.mode === 'dark' ? 'Pro Dark' : 'Pro Light';
  const perspectiveThemeRef = useRef(perspectiveTheme);
  perspectiveThemeRef.current = perspectiveTheme;

  const hasData = Boolean(data?.columns?.length && data?.rows?.length);

  if (
    previousInputRef.current.data !== data ||
    previousInputRef.current.storageKey !== storageKey
  ) {
    previousInputRef.current = { data, storageKey };
    viewerVersionRef.current += 1;
  }
  const viewerVersion = viewerVersionRef.current;

  const persistConfig = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer?.save || !storageKey) return false;
    const config = await viewer.save();
    return saveAnalysisConfig(storageKey, config);
  }, [storageKey]);

  useImperativeHandle(
    ref,
    () => ({
      save: persistConfig,
      copy: () => viewerRef.current?.copy?.('csv'),
      download: () => viewerRef.current?.download?.('csv'),
      exportVisualization: () => viewerRef.current?.download?.('plugin'),
      applyConfig: (config) => viewerRef.current?.restore?.(config),
      reset: async () => {
        const viewer = viewerRef.current;
        if (!viewer?.reset) return;
        clearAnalysisConfig(storageKey);
        await viewer.reset(true);
        await viewer.restore({ plugin: 'Datagrid', theme: perspectiveTheme });
        await persistConfig();
      },
    }),
    [persistConfig, perspectiveTheme, storageKey],
  );

  useEffect(() => {
    onReadyChange?.(status === 'ready');
  }, [onReadyChange, status]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;

    const handleConfigUpdate = () => {
      if (configSaveTimerRef.current) window.clearTimeout(configSaveTimerRef.current);
      configSaveTimerRef.current = window.setTimeout(() => {
        persistConfig().catch(() => {});
      }, 300);
    };
    const handleClick = (event) => onSelectionChange?.(event.detail || null);

    viewer.addEventListener('perspective-config-update', handleConfigUpdate);
    viewer.addEventListener('perspective-click', handleClick);
    return () => {
      viewer.removeEventListener('perspective-config-update', handleConfigUpdate);
      viewer.removeEventListener('perspective-click', handleClick);
      if (configSaveTimerRef.current) {
        window.clearTimeout(configSaveTimerRef.current);
        configSaveTimerRef.current = null;
      }
    };
  }, [onSelectionChange, persistConfig]);

  // Handle parent container resizing
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || typeof ResizeObserver === 'undefined') return undefined;

    let frameId = null;
    const observer = new ResizeObserver(() => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(async () => {
        if (viewer.resize) {
          try {
            await viewer.resize();
          } catch (e) {
            console.warn('Warning during viewer resize:', e);
          }
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
    if (!hasData) {
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
            import('@perspective-dev/viewer/inline'),
            import('@perspective-dev/viewer-datagrid'),
            import('@perspective-dev/viewer-charts'),
            import('@perspective-dev/client/inline'),
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

        // 1. Build the explicit schema
        const schema = {};
        if (data.column_types) {
          data.columns.forEach((col) => {
            schema[col] = data.column_types[col] || 'string';
          });
        } else {
          // Fallback to sample-based inference for backward compatibility
          const sampleSize = Math.min(data.rows.length, 100);
          const sampleRows = data.rows.slice(0, sampleSize);
          data.columns.forEach((col, colIdx) => {
            const sampleValues = sampleRows.map((row) => row[colIdx]);
            schema[col] = inferColumnType(sampleValues);
          });
        }

        setLoadingMessage(`Loading ${data.rows.length.toLocaleString()} rows`);
        table = await withTimeout(
          worker.table(schema),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'creating the Perspective table',
        );

        const columnar = toColumnar(data.columns, data.rows);
        await withTimeout(
          table.update(columnar),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'loading rows into the Perspective table',
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

        if (viewer.restore) {
          const savedConfig = loadAnalysisConfig(storageKey);
          try {
            await viewer.restore(
              savedConfig
                ? { ...savedConfig, theme: perspectiveThemeRef.current }
                : { plugin: 'Datagrid', theme: perspectiveThemeRef.current },
            );
          } catch {
            clearAnalysisConfig(storageKey);
            await viewer.restore({ plugin: 'Datagrid', theme: perspectiveThemeRef.current });
          }
        }
        if (viewer.flush) {
          await viewer.flush();
        }
        if (viewer.resize) {
          await viewer.resize();
        }
        if (!cancelled) setStatus('ready');
      } catch (loadError) {
        cleanupPerspectiveResources({ viewer, table, worker });
        if (!cancelled) {
          setError(loadError);
          setStatus('error');
        }
      }
    }

    loadPerspective();

    return () => {
      cancelled = true;
      cleanupPerspectiveResources({ viewer, table, worker });
    };
  }, [data, hasData, storageKey]);

  if (!hasData) {
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
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.08)}, 0 8px 40px ${alpha('#000', 0.5)}`
            : `0 1px 2px ${alpha('#000', 0.06)}, 0 6px 24px ${alpha('#000', 0.07)}`,
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.6)
            : theme.palette.background.paper,
        '& perspective-viewer': {
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: 0,
        },
      }}
    >
      <perspective-viewer
        key={viewerVersion}
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
              theme.palette.mode === 'dark' ? 0.55 : 0.7,
            ),
            zIndex: 1,
          }}
        >
          <CircularProgress size={28} thickness={3} sx={{ color: theme.palette.primary.main }} />
          <Typography
            sx={{
              ...theme.typography.uiCaptionMd,
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: 0,
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
});

export default memo(PerspectiveDashboard);
