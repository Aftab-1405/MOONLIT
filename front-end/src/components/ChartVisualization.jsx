import { useState, useMemo, useEffect } from 'react';
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
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Box,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip as MuiTooltip,
  useTheme,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import PieChartOutlineRoundedIcon from '@mui/icons-material/PieChartOutlineRounded';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

// Register Chart.js components
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
  Filler
);

function ChartVisualization({ data, onClose, embedded = false }) {
  const [chartType, setChartType] = useState('bar');
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Modern color palette
  const chartColors = useMemo(() => [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
  ], []);

  const chartColorsBg = useMemo(() => chartColors.map(c => alpha(c, 0.7)), [chartColors]);

  const { columns = [], result = [] } = data || {};

  // Detect numeric and string columns
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

  // Auto-select columns when data changes
  useEffect(() => {
    if (!labelColumn && stringColumns.length) {
      setLabelColumn(stringColumns[0]);
    }
    if (!valueColumn && numericColumns.length) {
      setValueColumn(numericColumns[0]);
    }
  }, [stringColumns, numericColumns, labelColumn, valueColumn]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!labelColumn || !valueColumn || !result.length) return null;

    const labels = result.map(row => String(row[labelColumn] || ''));
    const values = result.map(row => Number(row[valueColumn]) || 0);

    return {
      labels,
      datasets: [
        {
          label: valueColumn,
          data: values,
          backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
            ? chartColorsBg.slice(0, values.length) 
            : chartColorsBg[0],
          borderColor: chartType === 'pie' || chartType === 'doughnut'
            ? chartColors.slice(0, values.length)
            : chartColors[0],
          borderWidth: 2,
          borderRadius: chartType === 'bar' ? 6 : 0,
          fill: chartType === 'line',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [labelColumn, valueColumn, result, chartType, chartColors, chartColorsBg]);

  // Chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartType === 'pie' || chartType === 'doughnut',
        position: 'right',
        labels: {
          color: theme.palette.text.primary,
          font: { family: 'Inter', size: 12 },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: isDark ? alpha('#1e293b', 0.95) : alpha('#fff', 0.95),
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: { weight: 600 },
        bodyFont: { size: 13 },
      },
    },
    scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
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
        border: { display: false },
      },
      y: {
        grid: { 
          color: alpha(theme.palette.divider, 0.5),
          drawBorder: false,
        },
        ticks: { 
          color: theme.palette.text.secondary,
          font: { size: 11 },
        },
        border: { display: false },
      },
    } : undefined,
  }), [chartType, theme, isDark]);

  const handleDownload = () => {
    const canvas = document.querySelector('.chart-container canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart.png';
      a.click();
    }
  };

  const ChartComponent = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
  }[chartType];

  if (!columns.length || !result.length) return null;
  
  if (!numericColumns.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <InsightsRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          No numeric columns available for visualization
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          m: fullscreen ? 0 : { xs: 1, sm: 2 },
          p: 2,
          borderRadius: fullscreen ? 0 : 2,
          border: fullscreen ? 'none' : '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          backgroundColor: isDark 
            ? alpha(theme.palette.background.paper, fullscreen ? 1 : 0.95)
            : theme.palette.background.paper,
          position: fullscreen ? 'fixed' : 'relative',
          top: fullscreen ? 0 : 'auto',
          left: fullscreen ? 0 : 'auto',
          right: fullscreen ? 0 : 'auto',
          bottom: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 9999 : 'auto',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.info.main, isDark ? 0.15 : 0.1),
              }}
            >
              <InsightsRoundedIcon sx={{ fontSize: 16, color: 'info.main' }} />
            </Box>
            <Typography variant="subtitle2" fontWeight={600}>
              Visualization
            </Typography>
            <Chip 
              size="small" 
              label={chartType.charAt(0).toUpperCase() + chartType.slice(1)}
              sx={{ 
                height: 22, 
                fontSize: '0.7rem',
                textTransform: 'capitalize',
                backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06),
              }}
            />
          </Box>

          {/* Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Chart Type Toggle */}
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(e, v) => v && setChartType(v)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                  },
                },
              }}
            >
              <ToggleButton value="bar">
                <MuiTooltip title="Bar Chart">
                  <BarChartRoundedIcon sx={{ fontSize: 18 }} />
                </MuiTooltip>
              </ToggleButton>
              <ToggleButton value="line">
                <MuiTooltip title="Line Chart">
                  <ShowChartRoundedIcon sx={{ fontSize: 18 }} />
                </MuiTooltip>
              </ToggleButton>
              <ToggleButton value="pie">
                <MuiTooltip title="Pie Chart">
                  <PieChartOutlineRoundedIcon sx={{ fontSize: 18 }} />
                </MuiTooltip>
              </ToggleButton>
              <ToggleButton value="doughnut">
                <MuiTooltip title="Doughnut Chart">
                  <DonutLargeRoundedIcon sx={{ fontSize: 18 }} />
                </MuiTooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <MuiTooltip title="Download PNG">
                <IconButton 
                  size="small" 
                  onClick={handleDownload}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
                  }}
                >
                  <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </MuiTooltip>
              <MuiTooltip title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton 
                  size="small" 
                  onClick={() => setFullscreen(!fullscreen)}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
                  }}
                >
                  {fullscreen ? (
                    <FullscreenExitRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <FullscreenRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </MuiTooltip>
              {onClose && !embedded && (
                <MuiTooltip title="Close">
                  <IconButton 
                    size="small" 
                    onClick={onClose}
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </MuiTooltip>
              )}
            </Box>
          </Box>
        </Box>

        {/* Column Selectors */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontSize: '0.85rem' }}>Label Column</InputLabel>
            <Select
              value={labelColumn}
              label="Label Column"
              onChange={(e) => setLabelColumn(e.target.value)}
              sx={{ fontSize: '0.85rem' }}
            >
              {columns.map(col => (
                <MenuItem key={col} value={col} sx={{ fontSize: '0.85rem' }}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontSize: '0.85rem' }}>Value Column</InputLabel>
            <Select
              value={valueColumn}
              label="Value Column"
              onChange={(e) => setValueColumn(e.target.value)}
              sx={{ fontSize: '0.85rem' }}
            >
              {numericColumns.map(col => (
                <MenuItem key={col} value={col} sx={{ fontSize: '0.85rem' }}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Chart */}
        <Box
          className="chart-container"
          sx={{
            height: fullscreen ? 'calc(100vh - 180px)' : 300,
            p: 1,
            borderRadius: 2,
            backgroundColor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.02),
          }}
        >
          {chartData && ChartComponent && (
            <ChartComponent data={chartData} options={chartOptions} />
          )}
        </Box>
      </Box>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <Box
          onClick={() => setFullscreen(false)}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.7)',
            zIndex: 9998,
          }}
        />
      )}
    </>
  );
}

export default ChartVisualization;
