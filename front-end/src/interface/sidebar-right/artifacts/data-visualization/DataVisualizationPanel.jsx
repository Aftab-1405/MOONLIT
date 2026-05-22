import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Colors,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PieChartOutlineRoundedIcon from '@mui/icons-material/PieChartOutlineRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import CodeEditorIcon from '../../../../components/icons/CodeEditorIcon';
import { ArtifactEmptyState, ArtifactShell } from '../../artifact-loader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  Colors,
);

const CHART_COMPONENTS = {
  bar: Bar,
  line: Line,
  pie: Pie,
  doughnut: Doughnut,
};

function isFiniteNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim()) return Number.isFinite(Number(value));
  return false;
}

function formatCompactNumber(value) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value;
}

function DataVisualizationPanel({
  data,
  chrome = 'standalone',
  title = 'Data Visualization',
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const chartRef = useRef(null);
  const chartHostRef = useRef(null);

  const [chartType, setChartType] = useState('bar');
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [chartReadySignature, setChartReadySignature] = useState('');

  const { columns = [], result = [] } = data || {};
  const requestOpenArtifact = onRequestOpenArtifact || onOpenArtifact;

  const { numericColumns, labelColumns } = useMemo(() => {
    if (!Array.isArray(columns) || !Array.isArray(result) || !columns.length || !result.length) {
      return { numericColumns: [], labelColumns: [] };
    }

    const numeric = [];
    const labels = [];

    columns.forEach((column) => {
      const sample = result
        .map((row) => row?.[column])
        .filter((value) => value != null)
        .slice(0, 20);
      const numericCount = sample.filter(isFiniteNumericValue).length;
      if (sample.length > 0 && numericCount / sample.length >= 0.7) {
        numeric.push(column);
      } else {
        labels.push(column);
      }
    });

    return { numericColumns: numeric, labelColumns: labels.length ? labels : columns };
  }, [columns, result]);

  const selectedLabelColumn = labelColumn || labelColumns[0] || '';
  const selectedValueColumn = valueColumn || numericColumns[0] || '';

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;

    let firstFrame = null;
    let secondFrame = null;
    const observer = new ResizeObserver(() => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          chartRef.current?.resize();
        });
      });
    });

    observer.observe(host);
    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      observer.disconnect();
    };
  }, []);

  const chartData = useMemo(() => {
    if (!selectedLabelColumn || !selectedValueColumn || !Array.isArray(result) || !result.length) return null;

    const rows = result.slice(0, 50);
    return {
      labels: rows.map((row) => String(row?.[selectedLabelColumn] ?? '')),
      datasets: [
        {
          label: selectedValueColumn,
          data: rows.map((row) => {
            const value = row?.[selectedValueColumn];
            return isFiniteNumericValue(value) ? Number(value) : 0;
          }),
          borderWidth: chartType === 'pie' || chartType === 'doughnut' ? 2 : 2,
          borderRadius: chartType === 'bar' ? 6 : 0,
          fill: chartType === 'line',
          tension: 0.4,
        },
      ],
    };
  }, [chartType, result, selectedLabelColumn, selectedValueColumn]);

  const chartSignature = `${isFullscreen ? 'full' : 'inline'}-${chartType}-${selectedLabelColumn}-${selectedValueColumn}`;
  const chartReady = chartReadySignature === chartSignature;

  useEffect(() => {
    if (!chartData) return undefined;

    let firstFrame = null;
    let secondFrame = null;
    let revealFrame = null;

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        chartRef.current?.resize();
        revealFrame = requestAnimationFrame(() => {
          setChartReadySignature(chartSignature);
        });
      });
    });

    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (revealFrame) cancelAnimationFrame(revealFrame);
    };
  }, [chartData, chartSignature]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 16, right: 16, bottom: 8, left: 16 },
    },
    plugins: {
      legend: {
        display: chartType === 'pie' || chartType === 'doughnut',
        position: isMobile ? 'bottom' : 'right',
        labels: {
          color: theme.palette.text.secondary,
          font: { size: 12, weight: 500 },
          padding: 16,
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      title: {
        display: Boolean(selectedLabelColumn && selectedValueColumn),
        text: `${selectedValueColumn} by ${selectedLabelColumn}`,
        color: theme.palette.text.primary,
        font: { size: 14, weight: 600 },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: alpha(theme.palette.background.elevated, 0.98),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        borderColor: theme.palette.border.subtle,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { weight: 600, size: 13 },
        bodyFont: { size: 12 },
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        usePointStyle: true,
      },
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
      x: {
        grid: {
          color: alpha(theme.palette.divider, 0.5),
          drawBorder: false,
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          maxRotation: 45,
        },
        title: {
          display: true,
          text: selectedLabelColumn,
          color: theme.palette.text.secondary,
          font: { size: 12, weight: 600 },
          padding: { top: 8 },
        },
      },
      y: {
        grid: {
          color: alpha(theme.palette.divider, 0.5),
          drawBorder: false,
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          callback: formatCompactNumber,
        },
        title: {
          display: true,
          text: selectedValueColumn,
          color: theme.palette.text.secondary,
          font: { size: 12, weight: 600 },
          padding: { bottom: 8 },
        },
        beginAtZero: true,
      },
    },
  }), [chartType, isMobile, selectedLabelColumn, selectedValueColumn, theme]);

  const handleDownload = useCallback(() => {
    const canvas = chartRef.current?.canvas;
    if (!canvas) return;

    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `chart-${chartType}-${Date.now()}.png`;
    anchor.click();
  }, [chartType]);

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

  if (!columns.length || !result.length) {
    return (
      <ArtifactEmptyState
        icon={<InsightsRoundedIcon sx={{ fontSize: 48 }} />}
        title="No data available for visualization"
      />
    );
  }

  if (!numericColumns.length) {
    return (
      <ArtifactEmptyState
        icon={<InsightsRoundedIcon sx={{ fontSize: 48 }} />}
        title="No numeric columns"
        message="Select a result set with at least one numeric column to create a chart."
      />
    );
  }

  const ChartComponent = CHART_COMPONENTS[chartType];
  const controls = (
    <Stack spacing={2}>
      <Stack direction={isMobile ? 'column' : 'row'} spacing={2} sx={{ width: '100%' }}>
        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 220, flex: 1 }}>
          <InputLabel id="label-column-label">X-axis / Label</InputLabel>
          <Select
            labelId="label-column-label"
            value={selectedLabelColumn}
            label="X-axis / Label"
            onChange={(event) => setLabelColumn(event.target.value)}
            sx={{
              bgcolor: 'background.paper',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.border.subtle,
              },
            }}
          >
            {labelColumns.map((column) => (
              <MenuItem key={column} value={column}>
                {column}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 220, flex: 1 }}>
          <InputLabel id="value-column-label">Y-axis / Value</InputLabel>
          <Select
            labelId="value-column-label"
            value={selectedValueColumn}
            label="Y-axis / Value"
            onChange={(event) => setValueColumn(event.target.value)}
            sx={{
              bgcolor: 'background.paper',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.border.subtle,
              },
            }}
          >
            {numericColumns.map((column) => (
              <MenuItem key={column} value={column}>
                {column}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box>
        <Typography sx={{ ...theme.typography.uiCaptionSm, color: 'text.secondary', mb: 1, fontWeight: 600 }}>
          Chart Type
        </Typography>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(event, value) => value && setChartType(value)}
          size="small"
          aria-label="Chart type"
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            '& .MuiToggleButtonGroup-grouped': {
              border: '1px solid',
              borderColor: theme.palette.border.subtle,
              borderRadius: '8px !important',
              ml: 0,
              '&:not(:first-of-type)': { ml: 0 },
              '&.Mui-selected': {
                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                borderColor: theme.palette.primary.main,
                color: 'primary.main',
              },
            },
          }}
        >
          <ToggleButton value="bar" aria-label="Bar chart" sx={{ px: 2, py: 1, gap: 1 }}>
            <BarChartRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ ...theme.typography.uiCaptionMd, fontWeight: 600 }}>Bar</Typography>
          </ToggleButton>
          <ToggleButton value="line" aria-label="Line chart" sx={{ px: 2, py: 1, gap: 1 }}>
            <ShowChartRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ ...theme.typography.uiCaptionMd, fontWeight: 600 }}>Line</Typography>
          </ToggleButton>
          <ToggleButton value="pie" aria-label="Pie chart" sx={{ px: 2, py: 1, gap: 1 }}>
            <PieChartOutlineRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ ...theme.typography.uiCaptionMd, fontWeight: 600 }}>Pie</Typography>
          </ToggleButton>
          <ToggleButton value="doughnut" aria-label="Doughnut chart" sx={{ px: 2, py: 1, gap: 1 }}>
            <DonutLargeRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ ...theme.typography.uiCaptionMd, fontWeight: 600 }}>Doughnut</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Stack>
  );

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
        subtitle="Configure and preview chart from query results"
        icon={<TimelineRoundedIcon sx={{ fontSize: 20 }} />}
        chrome={chrome}
        onClose={onClose}
        onRequestClose={onRequestClose}
        isFullscreen={isFullscreen}
        onEnterFullscreen={onEnterFullscreen}
        onExitFullscreen={onExitFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        workspaceContainerRef={workspaceContainerRef}
        controls={controls}
        bodySx={{ p: isMobile ? 1.5 : 2, display: 'flex', flexDirection: 'column' }}
        actions={[
          sourceQuery && sourceType === 'sql-editor' && requestOpenArtifact
            ? {
                key: 'editor',
                label: 'Back to editor',
                icon: <CodeEditorIcon sx={{ width: 18, height: 18 }} />,
                onClick: openEditor,
              }
            : null,
          {
            key: 'download',
            label: 'Download PNG',
            icon: <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDownload,
            disabled: !chartData,
          },
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
        {!selectedLabelColumn || !selectedValueColumn ? (
          <ArtifactEmptyState
            icon={<InsightsRoundedIcon sx={{ fontSize: 40 }} />}
            title="Select chart columns"
            message="Choose label and value columns to generate a chart."
            sx={{
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.02 : 0.01),
              borderRadius: '12px',
              border: '1px dashed',
              borderColor: theme.palette.border.subtle,
            }}
          />
        ) : (
          <Box
            ref={chartHostRef}
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.02 : 0.01),
              borderRadius: '12px',
              border: '1px solid',
              borderColor: theme.palette.border.subtle,
              p: isMobile ? 1 : 2,
              position: 'relative',
              opacity: chartReady ? 1 : 0,
              transition: chartReady ? 'opacity 120ms ease' : 'none',
            }}
          >
            {chartData && ChartComponent ? (
              <ChartComponent ref={chartRef} data={chartData} options={chartOptions} />
            ) : null}
          </Box>
        )}
      </ArtifactShell>
    </Box>
  );
}

export default memo(DataVisualizationPanel);
