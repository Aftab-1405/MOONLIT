import { memo, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import { ArtifactEmptyState, ArtifactShell } from '@/features/sidebar-right/artifact-loader';
import PerspectiveDashboard from '@/features/sidebar-right/artifacts/data-visualization/PerspectiveDashboard';

function DataVisualizationPanel({
  data,
  chrome = 'standalone',
  title = 'Data Analysis',
  onClose,
  onOpenArtifact,
  onRequestClose,
  onRequestOpenArtifact,
  isFullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  sourceQuery,
  sourceType,
  workspaceContainerRef,
}) {
  const rows = useMemo(() => {
    if (!data) return [];

    // Case 1: data itself is already an array (of objects or arrays)
    if (Array.isArray(data)) {
      return data;
    }

    // Case 2: data has a "result" field (could be array of objects, or QueryResultData object)
    if (data?.result) {
      if (Array.isArray(data.result)) {
        return data.result;
      }
      if (Array.isArray(data.result.rows)) {
        const columns = data.result.columns || data.result.fields || data.columns || [];
        const rows = data.result.rows;
        // Zip array of arrays with column names to create object representations
        if (columns.length && rows.length && Array.isArray(rows[0])) {
          return rows.map((row) => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          });
        }
        return rows;
      }
    }

    // Case 3: data has a "rows" field directly (e.g. { columns: [], rows: [[]] })
    if (Array.isArray(data?.rows)) {
      const columns = data.columns || data.fields || [];
      const rows = data.rows;
      if (columns.length && rows.length && Array.isArray(rows[0])) {
        return rows.map((row) => {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });
      }
      return rows;
    }

    // Case 4: data has "data" field
    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }, [data]);

  const requestOpenArtifact = onRequestOpenArtifact || onOpenArtifact;

  const openEditor = useCallback(() => {
    requestOpenArtifact?.({
      type: 'sql-editor',
      title: 'SQL Editor',
      props: { initialQuery: sourceQuery, initialResults: data },
    }, { preserveFullscreen: isFullscreen });
  }, [data, isFullscreen, requestOpenArtifact, sourceQuery]);

  const openTable = useCallback(() => {
    requestOpenArtifact?.({
      type: 'results',
      title: 'Query Results',
      props: { data, sourceQuery, sourceType },
    }, { preserveFullscreen: isFullscreen });
  }, [data, isFullscreen, requestOpenArtifact, sourceQuery, sourceType]);

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
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ArtifactShell
        title={title}
        icon={<AnalyticsOutlinedIcon sx={{ fontSize: 20 }} />}
        chrome={chrome}
        onClose={onClose}
        onRequestClose={onRequestClose}
        isFullscreen={isFullscreen}
        onEnterFullscreen={onEnterFullscreen}
        onExitFullscreen={onExitFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        workspaceContainerRef={workspaceContainerRef}
        bodySx={{ p: 2, display: 'flex', flexDirection: 'column' }}
        actions={[
          sourceQuery && sourceType === 'sql-editor' && requestOpenArtifact
            ? {
                key: 'editor',
                label: 'Back to editor',
                icon: <CodeEditorIcon sx={{ width: 18, height: 18 }} />,
                onClick: openEditor,
              }
            : null,
          requestOpenArtifact
            ? {
                key: 'table',
                label: 'Open as table',
                icon: <DatasetOutlinedIcon sx={{ fontSize: 18 }} />,
                onClick: openTable,
              }
            : null,
        ]}
      >
        <PerspectiveDashboard data={rows} />
      </ArtifactShell>
    </Box>
  );
}

export default memo(DataVisualizationPanel);
