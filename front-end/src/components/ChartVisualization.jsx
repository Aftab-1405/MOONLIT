import { useState, useMemo } from 'react';
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
  Paper,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip as MuiTooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DownloadIcon from '@mui/icons-material/Download';

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

// Color palette matching theme
const CHART_COLORS = [
  'rgba(139, 92, 246, 0.8)',   // Violet
  'rgba(6, 182, 212, 0.8)',    // Cyan
  'rgba(16, 185, 129, 0.8)',   // Emerald
  'rgba(245, 158, 11, 0.8)',   // Amber
  'rgba(244, 63, 94, 0.8)',    // Rose
  'rgba(59, 130, 246, 0.8)',   // Blue
  'rgba(168, 85, 247, 0.8)',   // Purple
  'rgba(34, 211, 238, 0.8)',   // Lighter cyan
];

const CHART_COLORS_BORDER = CHART_COLORS.map(c => c.replace('0.8', '1'));

function ChartVisualization({ data, onClose }) {
  const [chartType, setChartType] = useState('bar');
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

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

  // Auto-select columns on mount
  useMemo(() => {
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
            ? CHART_COLORS.slice(0, values.length) 
            : CHART_COLORS[0],
          borderColor: chartType === 'pie' || chartType === 'doughnut'
            ? CHART_COLORS_BORDER.slice(0, values.length)
            : CHART_COLORS_BORDER[0],
          borderWidth: 1,
          fill: chartType === 'line',
        },
      ],
    };
  }, [labelColumn, valueColumn, result, chartType]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartType === 'pie' || chartType === 'doughnut',
        position: 'right',
        labels: {
          color: '#f8fafc',
          font: { family: 'Inter' },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(139, 92, 246, 0.3)',
        borderWidth: 1,
      },
    },
    scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8' },
      },
    } : undefined,
  };

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
      <Paper sx={{ m: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography color="text.secondary">
          No numeric columns available for chart visualization.
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        sx={{
          m: { xs: 1, sm: 2 },
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          position: fullscreen ? 'fixed' : 'relative',
          top: fullscreen ? 16 : 'auto',
          left: fullscreen ? 16 : 'auto',
          right: fullscreen ? 16 : 'auto',
          bottom: fullscreen ? 16 : 'auto',
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
            px: 2,
            py: 1.5,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderBottom: '1px solid',
            borderColor: 'rgba(139, 92, 246, 0.2)',
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            Chart Visualization
          </Typography>

          {/* Chart Type Toggle */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(e, v) => v && setChartType(v)}
            size="small"
          >
            <ToggleButton value="bar">
              <MuiTooltip title="Bar Chart">
                <BarChartIcon fontSize="small" />
              </MuiTooltip>
            </ToggleButton>
            <ToggleButton value="line">
              <MuiTooltip title="Line Chart">
                <ShowChartIcon fontSize="small" />
              </MuiTooltip>
            </ToggleButton>
            <ToggleButton value="pie">
              <MuiTooltip title="Pie Chart">
                <PieChartIcon fontSize="small" />
              </MuiTooltip>
            </ToggleButton>
            <ToggleButton value="doughnut">
              <MuiTooltip title="Doughnut Chart">
                <DonutLargeIcon fontSize="small" />
              </MuiTooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <MuiTooltip title="Download PNG">
              <IconButton size="small" onClick={handleDownload}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
            <MuiTooltip title="Fullscreen">
              <IconButton size="small" onClick={() => setFullscreen(!fullscreen)}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
            <MuiTooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          </Box>
        </Box>

        {/* Column Selectors */}
        <Box sx={{ display: 'flex', gap: 2, p: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Labels</InputLabel>
            <Select
              value={labelColumn}
              label="Labels"
              onChange={(e) => setLabelColumn(e.target.value)}
            >
              {columns.map(col => (
                <MenuItem key={col} value={col}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Values</InputLabel>
            <Select
              value={valueColumn}
              label="Values"
              onChange={(e) => setValueColumn(e.target.value)}
            >
              {numericColumns.map(col => (
                <MenuItem key={col} value={col}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Chart */}
        <Box
          className="chart-container"
          sx={{
            p: 2,
            height: fullscreen ? 'calc(100vh - 200px)' : 350,
          }}
        >
          {chartData && ChartComponent && (
            <ChartComponent data={chartData} options={chartOptions} />
          )}
        </Box>
      </Paper>

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
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9998,
          }}
        />
      )}
    </>
  );
}

export default ChartVisualization;
