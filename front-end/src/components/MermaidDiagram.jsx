import { useEffect, useRef, useState, useId, useCallback, memo } from 'react';
import mermaid from 'mermaid';
import { Box, Paper, IconButton, Tooltip, Typography, CircularProgress, Slider } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

// Initialize mermaid with dark theme and suppress error rendering
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  suppressErrorRendering: true,
  themeVariables: {
    primaryColor: '#10b981',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#059669',
    lineColor: '#94a3b8',
    secondaryColor: '#14b8a6',
    tertiaryColor: '#1e293b',
    background: 'transparent',
    mainBkg: '#1e293b',
    nodeBorder: '#10b981',
    clusterBkg: '#1e293b',
    clusterBorder: '#475569',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#1e293b',
  },
  fontFamily: '"Inter", "SF Pro Display", sans-serif',
  securityLevel: 'loose',
  logLevel: 'fatal',
});

function MermaidDiagram({ code }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const containerRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const uniqueId = useId().replace(/:/g, '');
  
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  
  // Pan state for drag-to-move
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;

      setLoading(true);
      setError(null);
      setSvg('');

      try {
        const parseResult = await mermaid.parse(code, { suppressErrors: true });
        
        if (parseResult === false) {
          setError('Diagram contains syntax that cannot be rendered');
          setLoading(false);
          return;
        }
        
        const id = `mermaid-${uniqueId}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
      } catch (err) {
        console.warn('Mermaid rendering warning:', err);
        const errorMsg = err?.message || err?.str || 'Diagram syntax error';
        setError(errorMsg.split('\n')[0]);
      } finally {
        setLoading(false);
      }
    };

    const cleanup = () => {
      document.querySelectorAll('[id^="d"]').forEach(el => {
        if (el.textContent?.includes('error in text') || el.textContent?.includes('Syntax error')) {
          el.remove();
        }
      });
    };

    cleanup();
    renderDiagram();
    return cleanup;
  }, [code, uniqueId]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(100);
    setPanPosition({ x: 0, y: 0 }); // Reset pan position too
  }, []);

  const handleZoomChange = useCallback((_, value) => {
    setZoom(value);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen(prev => !prev);
    setZoom(100);
    setPanPosition({ x: 0, y: 0 }); // Reset pan when toggling fullscreen
  }, []);

  // Pan handlers for drag-to-move
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  }, [panPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setPanPosition({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Error fallback - show raw code
  if (error) {
    return (
      <Paper 
        sx={{ 
          my: 2, 
          overflow: 'hidden', 
          bgcolor: isDark ? alpha('#000', 0.3) : alpha('#000', 0.02),
          border: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1),
          borderRadius: 2,
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          px: 2, 
          py: 0.75, 
          backgroundColor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03),
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
        }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 500 }}>
            mermaid
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box component="pre" sx={{ m: 0, p: 2, overflow: 'auto', fontSize: '0.8rem', fontFamily: '"Fira Code", monospace' }}>
          <code>{code}</code>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        ref={containerRef}
        elevation={fullscreen ? 8 : 0}
        sx={{
          my: fullscreen ? 0 : 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
          borderRadius: fullscreen ? 0 : 2,
          position: fullscreen ? 'fixed' : 'relative',
          inset: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 9999 : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header - monochrome style */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 0.75,
            backgroundColor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03),
            borderBottom: '1px solid',
            borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary', 
              textTransform: 'uppercase', 
              fontSize: '0.65rem', 
              fontWeight: 500,
              letterSpacing: 0.5,
            }}
          >
            diagram
          </Typography>

          {/* Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Zoom controls */}
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= 25}>
                <ZoomOutRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            
            <Box sx={{ width: 80, mx: 0.5, display: { xs: 'none', sm: 'block' } }}>
              <Slider
                value={zoom}
                onChange={handleZoomChange}
                min={25}
                max={300}
                size="small"
                sx={{
                  color: 'success.main',
                  '& .MuiSlider-thumb': { width: 12, height: 12 },
                  '& .MuiSlider-track': { height: 3 },
                  '& .MuiSlider-rail': { height: 3, opacity: 0.3 },
                }}
              />
            </Box>
            
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', minWidth: 35, textAlign: 'center' }}>
              {zoom}%
            </Typography>
            
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= 300}>
                <ZoomInRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Reset zoom">
              <IconButton size="small" onClick={handleResetZoom}>
                <RestartAltRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            <Box sx={{ width: 1, height: 16, bgcolor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1), mx: 0.5 }} />

            {/* Action buttons */}
            <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
              <IconButton size="small" onClick={handleCopy}>
                {copied ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Download SVG">
              <span>
                <IconButton size="small" onClick={handleDownload} disabled={!svg}>
                  <FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <IconButton size="small" onClick={toggleFullscreen}>
                {fullscreen ? <FullscreenExitRoundedIcon sx={{ fontSize: 16 }} /> : <FullscreenRoundedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Diagram with zoom and pan */}
        <Box
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: fullscreen ? 'calc(100vh - 60px)' : 200,
            maxHeight: fullscreen ? 'calc(100vh - 60px)' : 450,
            overflow: 'hidden',
            backgroundColor: 'transparent',
            cursor: isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {loading ? (
            <Box sx={{ textAlign: 'center', cursor: 'default' }}>
              <CircularProgress size={24} sx={{ color: 'primary.main' }} />
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                Rendering diagram...
              </Typography>
            </Box>
          ) : svg ? (
            <Box
              sx={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.2s ease',
                '& svg': { 
                  maxWidth: '100%', 
                  height: 'auto',
                  filter: isDark ? 'none' : `drop-shadow(0 2px 8px ${alpha(theme.palette.common.black, 0.08)})`,
                  pointerEvents: 'none',
                },
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : null}
        </Box>
      </Paper>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <Box
          onClick={toggleFullscreen}
          sx={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: alpha(theme.palette.common.black, isDark ? 0.9 : 0.8), 
            zIndex: 9998,
            cursor: 'pointer',
          }}
        />
      )}
    </>
  );
}

export default memo(MermaidDiagram);
