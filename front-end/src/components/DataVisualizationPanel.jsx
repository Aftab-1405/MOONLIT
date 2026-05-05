import { useState, useMemo, useRef, memo, useCallback, useEffect } from 'react';
import {
  Chart as ChartJS,
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
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AppPopover from './AppPopover';
import {
  ArtifactActions,
  ArtifactBody,
  ArtifactCommandBar,
  ArtifactEmptyState,
  ArtifactIconButton,
  ArtifactSurface,
  ArtifactToolbar,
} from './ArtifactLayout';
import { artifactControlButtonSx } from './artifactLayoutStyles';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import PieChartOutlineRoundedIcon from '@mui/icons-material/PieChartOutlineRounded';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import {
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
} from '../styles/shared';
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
  Colors
);

function DataVisualizationPanel({ data, chrome = 'standalone', onControlsChange }) {
  const [chartType, setChartType] = useState('bar');
  const [labelColumnOverride, setLabelColumn] = useState(null);
  const [valueColumnOverride, setValueColumn] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [labelAnchorEl, setLabelAnchorEl] = useState(null);
  const [valueAnchorEl, setValueAnchorEl] = useState(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  const { columns = [], result = [] } = data || {};
  const { numericColumns, stringColumns } = useMemo(() => {
    if (!result.length || !columns.length) return { numericColumns: [], stringColumns: [] };

    const numeric = [];
    const strings = [];

    columns.forEach(col => {
      const sampleValue = result.find(row => row[col] !== null)?.[col];
      if (typeof sampleValue === 'number') {
        numeric.push(col);
      } else {
        strings.push(col);
      }
    });

    return { numericColumns: numeric, stringColumns: strings };
  }, [columns, result]);
  const labelColumn = labelColumnOverride || stringColumns[0] || columns[0] || '';
  const valueColumn = valueColumnOverride || numericColumns[0] || '';

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const resizeChart = () => {
      chart.resize();
    };

    const rafId = requestAnimationFrame(resizeChart);
    const timeoutId = setTimeout(resizeChart, 120);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [fullscreen, chartType, labelColumn, valueColumn, result.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);
  const chartData = useMemo(() => {
    if (!labelColumn || !valueColumn || !result.length) return null;

    const labels = result.slice(0, 50).map(row => String(row[labelColumn] ?? ''));
    const values = result.slice(0, 50).map(row => Number(row[valueColumn]) || 0);

    const isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';

    return {
      labels,
      datasets: [{
        label: valueColumn,
        data: values,
        borderWidth: isPieOrDoughnut ? 2 : 2,
        borderRadius: chartType === 'bar' ? 4 : 0,
        fill: chartType === 'line',
        tension: 0.3,
      }],
    };
  }, [labelColumn, valueColumn, result, chartType]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 8, right: 8, bottom: 0, left: 8 },
    },
    plugins: {
      legend: {
        display: chartType === 'pie' || chartType === 'doughnut',
        position: isCompactMobile ? 'bottom' : 'right',
        labels: {
          color: theme.palette.text.secondary,
          font: { size: 11 },
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: theme.palette.background.elevated,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: 600 },
      },
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
      x: {
        grid: { color: theme.palette.divider },
        ticks: { color: theme.palette.text.secondary, font: { size: 11 } },
      },
      y: {
        grid: { color: theme.palette.divider },
        ticks: { color: theme.palette.text.secondary, font: { size: 11 } },
        beginAtZero: true,
      },
    },
  }), [chartType, theme, isCompactMobile]);

  const handleDownload = useCallback(() => {
    if (chartRef.current) {
      const canvas = chartRef.current.canvas;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `chart-${chartType}-${Date.now()}.png`;
      a.click();
    }
  }, [chartType]);

  const ChartComponent = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
  }[chartType];

  const columnButtonSx = useMemo(() => artifactControlButtonSx(theme, { height: 30 }), [theme]);
  const columnControls = useMemo(() => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, overflow: 'hidden' }}>
      <Box
        component="button"
        onClick={(e) => setLabelAnchorEl(e.currentTarget)}
        aria-haspopup="listbox"
        sx={columnButtonSx}
      >
        <Typography component="span" sx={{ ...theme.typography.uiCaption2xs, color: 'text.disabled', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>Label</Typography>
        <Typography component="span" noWrap sx={{ ...theme.typography.uiCaptionMd, color: 'text.primary', flex: 1, minWidth: 0, lineHeight: 1, textAlign: 'left' }}>{labelColumn || '-'}</Typography>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
      </Box>
      <Box
        component="button"
        onClick={(e) => setValueAnchorEl(e.currentTarget)}
        aria-haspopup="listbox"
        sx={columnButtonSx}
      >
        <Typography component="span" sx={{ ...theme.typography.uiCaption2xs, color: 'text.disabled', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>Value</Typography>
        <Typography component="span" noWrap sx={{ ...theme.typography.uiCaptionMd, color: 'text.primary', flex: 1, minWidth: 0, lineHeight: 1, textAlign: 'left' }}>{valueColumn || '-'}</Typography>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
      </Box>
    </Box>
  ), [
    columnButtonSx,
    labelColumn,
    theme.typography.uiCaption2xs,
    theme.typography.uiCaptionMd,
    valueColumn,
  ]);
  const chartTypeControls = useMemo(() => (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        p: 0.25,
        borderRadius: '10px',
        bgcolor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.06),
        border: '1px solid',
        borderColor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08),
      }}
    >
      <ToggleButtonGroup
        value={chartType}
        exclusive
        onChange={(e, v) => v && setChartType(v)}
        size="small"
        sx={{
          gap: 0.25,
          '& .MuiToggleButton-root': {
            border: 'none',
            borderRadius: '8px',
            px: 0.5,
            py: 0,
            minWidth: 30,
            height: 28,
            color: 'text.secondary',
            '&.Mui-selected': {
              color: 'text.primary',
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.95 : 1),
              boxShadow: `0 0 0 1px ${alpha(theme.palette.text.primary, 0.08)}, 0 1px 2px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.08)}`,
            },
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.06),
            },
          },
        }}
      >
        <ToggleButton value="bar" aria-label="Bar chart">
          <MuiTooltip title="Bar chart">
            <BarChartRoundedIcon sx={{ fontSize: 17 }} />
          </MuiTooltip>
        </ToggleButton>
        <ToggleButton value="line" aria-label="Line chart">
          <MuiTooltip title="Line chart">
            <ShowChartRoundedIcon sx={{ fontSize: 17 }} />
          </MuiTooltip>
        </ToggleButton>
        <ToggleButton value="pie" aria-label="Pie chart">
          <MuiTooltip title="Pie chart">
            <PieChartOutlineRoundedIcon sx={{ fontSize: 17 }} />
          </MuiTooltip>
        </ToggleButton>
        <ToggleButton value="doughnut" aria-label="Doughnut chart">
          <MuiTooltip title="Doughnut chart">
            <DonutLargeRoundedIcon sx={{ fontSize: 17 }} />
          </MuiTooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  ), [chartType, isDark, theme]);
  const chartActions = useMemo(() => (
    <ArtifactActions>
      <ArtifactIconButton title="Download PNG" ariaLabel="Download chart as PNG" onClick={handleDownload}>
        <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
      </ArtifactIconButton>
      <ArtifactIconButton
        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        ariaLabel={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onClick={() => setFullscreen(!fullscreen)}
      >
        {fullscreen ? (
          <FullscreenExitRoundedIcon sx={{ fontSize: 18 }} />
        ) : (
          <FullscreenRoundedIcon sx={{ fontSize: 18 }} />
        )}
      </ArtifactIconButton>
    </ArtifactActions>
  ), [fullscreen, handleDownload]);
  const chartToolbar = (
    <ArtifactToolbar
      leading={columnControls}
      center={chartTypeControls}
      sx={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
    />
  );
  const containedControls = useMemo(() => ({
    trailing: numericColumns.length ? chartActions : null,
  }), [chartActions, numericColumns.length]);

  useEffect(() => {
    if (chrome !== 'contained') return;
    onControlsChange?.(containedControls);
  }, [chrome, containedControls, onControlsChange]);

  useEffect(() => {
    if (chrome !== 'contained') return undefined;
    return () => onControlsChange?.(null);
  }, [chrome, onControlsChange]);

  if (!columns.length || !result.length) return null;

  if (!numericColumns.length) {
    const emptyState = (
      <ArtifactEmptyState
        icon={InsightsRoundedIcon}
        title="No numeric columns"
        subtitle="This result set does not contain numeric data for charting."
      />
    );
    return chrome === 'contained' ? emptyState : <ArtifactSurface>{emptyState}</ArtifactSurface>;
  }

  const chartBody = (
    <ArtifactBody
      className="chart-container"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        px: { xs: 2, md: 3 },
        py: 1.5,
        boxSizing: 'border-box',
      }}
    >
      {chartData && ChartComponent && (
        <ChartComponent ref={chartRef} data={chartData} options={chartOptions} />
      )}
    </ArtifactBody>
  );

  const fullscreenScrim = fullscreen && (
    <Box
      onClick={() => setFullscreen(false)}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: alpha(theme.palette.background.default, isDark ? 0.9 : 0.7),
        zIndex: 9998,
      }}
    />
  );

  const columnPopovers = (
    <>
      <AppPopover
        anchorEl={labelAnchorEl}
        open={Boolean(labelAnchorEl)}
        onClose={() => setLabelAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        width={180}
        paperSx={{ mt: 0.5 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          Label Column
        </Typography>
        <Box sx={{ maxHeight: 220, overflowY: 'auto', mt: 0.5 }}>
          {columns.map((col) => {
            const isActive = col === labelColumn;
            return (
              <Box
                component="div"
                role="option"
                aria-selected={isActive}
                key={col}
                onClick={() => { setLabelColumn(col); setLabelAnchorEl(null); }}
                sx={getSelectableMenuItemSx(theme, { isActive, columns: 'minmax(0, 1fr) auto' })}
              >
                <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                  {col}
                </Typography>
                {isActive && <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Box>
      </AppPopover>
      <AppPopover
        anchorEl={valueAnchorEl}
        open={Boolean(valueAnchorEl)}
        onClose={() => setValueAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        width={180}
        paperSx={{ mt: 0.5 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          Value Column
        </Typography>
        <Box sx={{ maxHeight: 220, overflowY: 'auto', mt: 0.5 }}>
          {numericColumns.map((col) => {
            const isActive = col === valueColumn;
            return (
              <Box
                component="div"
                role="option"
                aria-selected={isActive}
                key={col}
                onClick={() => { setValueColumn(col); setValueAnchorEl(null); }}
                sx={getSelectableMenuItemSx(theme, { isActive, columns: 'minmax(0, 1fr) auto' })}
              >
                <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                  {col}
                </Typography>
                {isActive && <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Box>
      </AppPopover>
    </>
  );

  if (chrome === 'contained') {
    return (
      <>
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            position: fullscreen ? 'fixed' : 'relative',
            inset: fullscreen ? 0 : 'auto',
            zIndex: fullscreen ? 9999 : 'auto',
            backgroundColor: fullscreen ? theme.palette.background.default : 'transparent',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {chartToolbar}
          {chartBody}
        </Box>
        {fullscreenScrim}
        {columnPopovers}
      </>
    );
  }

  return (
    <>
      <ArtifactSurface
        ref={containerRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          position: fullscreen ? 'fixed' : 'relative',
          inset: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 9999 : 'auto',
          backgroundColor: fullscreen ? theme.palette.background.default : 'transparent',
          alignSelf: 'stretch',
          height: '100%',
          minHeight: 0,
        }}
      >
        {chartToolbar}
        {chartBody}
        <ArtifactCommandBar
          trailing={chartActions}
        />
      </ArtifactSurface>
      {fullscreenScrim}
      {columnPopovers}
    </>
  );
}

export default memo(DataVisualizationPanel);
