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

/**
 * Build a Perspective schema object from the data's column_types (or fall
 * back to sample-based inference). Returns `{ schema, columns, types }`.
 */
function buildSchema(data) {
  const schema = {};
  if (data.column_types && Object.keys(data.column_types).length > 0) {
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
  return { schema, columns: [...data.columns], types: { ...schema } };
}

/**
 * Check whether two schemas are equivalent (same column names in the same
 * order, same types). Used to decide between `table.replace()` (fast path)
 * and creating a new table (schema changed).
 */
function schemaEquals(a, b) {
  if (!a || !b) return false;
  if (a.columns.length !== b.columns.length) return false;
  for (let i = 0; i < a.columns.length; i++) {
    if (a.columns[i] !== b.columns[i]) return false;
    if (a.types[a.columns[i]] !== b.types[b.columns[i]]) return false;
  }
  return true;
}

const PerspectiveDashboard = forwardRef(function PerspectiveDashboard(
  { data, storageKey, onReadyChange, onSelectionChange },
  ref,
) {
  const theme = useTheme();
  const viewerRef = useRef(null);

  // ── Refs for Perspective resources ────────────────────────────────────────
  // These persist across data changes. The worker is created once on mount
  // and terminated on unmount. The table is recreated only when the schema
  // changes; otherwise `table.replace()` is used for efficient data updates.
  const workerRef = useRef(null);
  const tableRef = useRef(null);
  const schemaRef = useRef(null); // { columns: string[], types: { [col]: type } }
  const prevStorageKeyRef = useRef(storageKey);
  const configSaveTimerRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  // `initialized` flips to true once the worker + Perspective modules are
  // loaded. The data-loading effect waits for this before proceeding.
  const [initialized, setInitialized] = useState(false);

  const perspectiveTheme = theme.palette.mode === 'dark' ? 'Pro Dark' : 'Pro Light';
  const perspectiveThemeRef = useRef(perspectiveTheme);
  perspectiveThemeRef.current = perspectiveTheme;

  const hasData = Boolean(data?.columns?.length && data?.rows?.length);

  // ── Config persistence ────────────────────────────────────────────────────
  const persistConfig = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer?.save || !storageKey) return false;
    const config = await viewer.save();
    return saveAnalysisConfig(storageKey, config);
  }, [storageKey]);

  // ── Imperative handle (toolbar actions) ───────────────────────────────────
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

  // ── Notify parent of ready state ──────────────────────────────────────────
  useEffect(() => {
    onReadyChange?.(status === 'ready');
  }, [onReadyChange, status]);

  // ── Event listeners on the viewer element ─────────────────────────────────
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

  // ── Resize observer ───────────────────────────────────────────────────────
  // `hasData` is in the deps so the observer re-attaches when the viewer
  // element first mounts (it's only rendered when hasData is true).
  // biome-ignore lint/correctness/useExhaustiveDependencies: hasData controls viewer element mount
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
  }, [hasData]);

  // ── Theme sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (viewer.setAttribute) {
      viewer.setAttribute('theme', perspectiveTheme);
    }
    if (viewer.restore) {
      Promise.resolve(viewer.restore({ theme: perspectiveTheme })).catch(() => {});
    }
    if (viewer.restyleElement) {
      Promise.resolve(viewer.restyleElement()).catch(() => {});
    }
  }, [perspectiveTheme]);

  // ── Phase 1: One-time initialization (load modules + create worker) ───────
  // Runs once on mount. The worker persists across data changes — it is only
  // terminated on unmount. This eliminates the ~500ms-1s worker-creation cost
  // on every subsequent query. hasData is intentionally excluded: if data
  // arrives after mount, the init effect has already run and the worker is
  // ready. The data effect (Phase 2) handles the actual data loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time init, hasData excluded by design
  useEffect(() => {
    if (!hasData) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    let cancelled = false;

    async function initPerspective() {
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

        const viewer = viewerRef.current;
        if (!viewer?.load) {
          throw new Error('Perspective viewer element is not ready.');
        }

        setLoadingMessage('Creating Perspective worker');
        const worker = await withTimeout(
          perspective.worker(),
          PERSPECTIVE_INIT_TIMEOUT_MS,
          'creating the Perspective worker',
        );

        if (cancelled) {
          cleanupPerspectiveResources({ worker });
          return;
        }

        workerRef.current = worker;
        setInitialized(true);
        // Don't set status to 'ready' here — the data-loading effect (Phase 2)
        // will do that after loading data into the table.
      } catch (initError) {
        cleanupPerspectiveResources({
          viewer: viewerRef.current,
          table: tableRef.current,
          worker: workerRef.current,
        });
        if (!cancelled) {
          setError(initError);
          setStatus('error');
        }
      }
    }

    initPerspective();

    return () => {
      cancelled = true;
      // Full cleanup only on unmount — NOT on data changes.
      // The worker and table persist across data changes for performance.
      cleanupPerspectiveResources({
        viewer: viewerRef.current,
        table: tableRef.current,
        worker: workerRef.current,
      });
      workerRef.current = null;
      tableRef.current = null;
      schemaRef.current = null;
      setInitialized(false);
    };
  }, []);

  // ── Phase 2: Load / replace data ──────────────────────────────────────────
  // Runs when `data` or `storageKey` changes, AFTER the worker is initialized.
  // Two paths:
  //   - Schema changed (or first load): create new table, load into viewer,
  //     restore saved config. ~200-500ms.
  //   - Schema unchanged: `table.replace(newData)` on the existing table.
  //     The viewer auto-updates without losing its configuration. ~50-100ms.
  useEffect(() => {
    if (!hasData) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    // Wait for Phase 1 to complete.
    if (!initialized) return undefined;

    let cancelled = false;

    async function loadData() {
      const worker = workerRef.current;
      const viewer = viewerRef.current;
      if (!worker || !viewer) return;

      // Build the explicit schema from column_types (or fall back to inference)
      const { schema, columns, types } = buildSchema(data);
      const newSchemaInfo = { columns, types };

      // Detect whether the schema changed (different columns or types).
      const schemaChanged = !schemaRef.current || !schemaEquals(schemaRef.current, newSchemaInfo);

      // Detect whether the storageKey changed (different query/database).
      const storageKeyChanged = prevStorageKeyRef.current !== storageKey;
      prevStorageKeyRef.current = storageKey;

      // Convert data to Perspective's columnar format with type-aware coercion.
      const columnar = toColumnar(data.columns, data.rows, data.column_types || {});

      if (schemaChanged || !tableRef.current) {
        // ── Slow path: schema changed (or first load) ───────────────────────
        // Create a new table with the new schema, load it into the viewer,
        // and restore the saved config for the new storageKey.
        setStatus('loading');
        setLoadingMessage(`Loading ${data.rows.length.toLocaleString()} rows`);

        // Delete the old table if it exists (different schema).
        if (tableRef.current) {
          try {
            await tableRef.current.delete();
          } catch (e) {
            console.warn('Warning deleting old table:', e);
          }
          tableRef.current = null;
        }

        // Create new table with explicit schema.
        const table = await withTimeout(
          worker.table(schema),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'creating the Perspective table',
        );

        if (cancelled) {
          cleanupPerspectiveResources({ table });
          return;
        }

        // Load data into the new table.
        await withTimeout(
          table.update(columnar),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'loading rows into the Perspective table',
        );

        if (cancelled) {
          cleanupPerspectiveResources({ table });
          return;
        }

        tableRef.current = table;
        schemaRef.current = newSchemaInfo;

        // Load the table into the viewer (associates table ↔ viewer).
        setLoadingMessage('Rendering analytics workspace');
        await withTimeout(
          viewer.load(table),
          PERSPECTIVE_LOAD_TIMEOUT_MS,
          'rendering the Perspective viewer',
        );

        if (cancelled) return;

        // Restore saved config (or default to Datagrid).
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
        if (viewer.flush) await viewer.flush();
        if (viewer.resize) await viewer.resize();

        if (!cancelled) setStatus('ready');
      } else {
        // ── Fast path: schema unchanged ─────────────────────────────────────
        // Replace data in the existing table. The viewer auto-updates without
        // losing its current configuration (sort, filter, pivot, column
        // widths, scroll position). This is the key performance win: no
        // worker recreation, no table recreation, no viewer recreation.
        setLoadingMessage(`Updating ${data.rows.length.toLocaleString()} rows`);

        try {
          await withTimeout(
            tableRef.current.replace(columnar),
            PERSPECTIVE_LOAD_TIMEOUT_MS,
            'replacing rows in the Perspective table',
          );
          if (viewer.flush) await viewer.flush();

          // If the storageKey changed (different query, same schema), restore
          // the saved config for the new key. If the storageKey is the same
          // (re-ran the same query), preserve the current view — the user's
          // in-progress analysis is uninterrupted.
          if (storageKeyChanged && viewer.restore) {
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

          if (!cancelled) setStatus('ready');
        } catch (replaceError) {
          if (!cancelled) {
            setError(replaceError);
            setStatus('error');
          }
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [data, hasData, storageKey, initialized]);

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
      {/* The <perspective-viewer> element is NEVER remounted across data
          changes. It stays in the DOM for the lifetime of the component,
          preserving all UI-ephemeral state (column widths, scroll position,
          expanded groups). Data updates flow through table.replace() which
          the viewer picks up automatically. */}
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
