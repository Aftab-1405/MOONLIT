import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import { Box, Paper, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

// Initialize mermaid with dark theme and suppress error rendering
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  suppressErrorRendering: true, // Don't render errors to DOM
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
  logLevel: 'fatal', // Only show fatal errors in console
});

function MermaidDiagram({ code }) {
  const containerRef = useRef(null);
  const uniqueId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;

      setLoading(true);
      setError(null);
      setSvg('');

      try {
        // Validate syntax first
        await mermaid.parse(code);
        
        // Render if valid
        const id = `mermaid-${uniqueId}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
      } catch (err) {
        console.warn('Mermaid rendering warning:', err);
        // Still try to extract useful error message
        const errorMsg = err?.message || err?.str || 'Diagram syntax error';
        setError(errorMsg.split('\n')[0]); // Just first line
      } finally {
        setLoading(false);
      }
    };

    // Clean up any orphan error elements
    const cleanup = () => {
      document.querySelectorAll('[id^="d"]').forEach(el => {
        if (el.textContent?.includes('error in text') || el.textContent?.includes('Syntax error')) {
          el.remove();
        }
      });
    };

    cleanup();
    renderDiagram();
    
    // Cleanup on unmount or re-render
    return cleanup;
  }, [code, uniqueId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show code block fallback if error
  if (error) {
    return (
      <Paper sx={{ my: 2, overflow: 'hidden', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 0.75, backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem' }}>mermaid</Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton size="small" onClick={handleCopy} sx={{ color: 'text.secondary' }}>
              <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box component="pre" sx={{ m: 0, p: 2, overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          <code>{code}</code>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        ref={containerRef}
        sx={{
          my: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          position: fullscreen ? 'fixed' : 'relative',
          inset: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 9999 : 'auto',
          m: fullscreen ? 0 : undefined,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 0.75,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.65rem' }}>
            diagram
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
              <IconButton size="small" onClick={handleCopy} sx={{ color: 'text.secondary' }}>
                <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download SVG">
              <IconButton size="small" onClick={handleDownload} disabled={!svg} sx={{ color: 'text.secondary' }}>
                <FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={fullscreen ? 'Exit' : 'Fullscreen'}>
              <IconButton size="small" onClick={() => setFullscreen(!fullscreen)} sx={{ color: 'text.secondary' }}>
                <FullscreenRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Diagram */}
        <Box
          sx={{
            p: 3,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 150,
            maxHeight: fullscreen ? '90vh' : 400,
            overflow: 'auto',
            '& svg': { maxWidth: '100%', height: 'auto' },
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'primary.main' }} />
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : null}
        </Box>
      </Paper>

      {fullscreen && (
        <Box
          onClick={() => setFullscreen(false)}
          sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9998 }}
        />
      )}
    </>
  );
}

export default MermaidDiagram;
