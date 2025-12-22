import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, IconButton, Tooltip, Paper, CircularProgress, useTheme as useMuiTheme } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import MermaidDiagram from './MermaidDiagram';

// Custom code block component with copy and run buttons
function CodeBlock({ children, className, onRunQuery }) {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const muiTheme = useMuiTheme();
  const isDarkMode = muiTheme.palette.mode === 'dark';
  
  const language = className?.replace('language-', '') || '';
  const code = String(children).replace(/\n$/, '');
  const isSQL = ['sql', 'mysql', 'postgresql', 'sqlite'].includes(language.toLowerCase());
  const isMermaid = language.toLowerCase() === 'mermaid';

  // Render Mermaid diagrams with special component
  if (isMermaid) {
    return <MermaidDiagram code={code} />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (onRunQuery && isSQL && !isRunning) {
      setIsRunning(true);
      try {
        await onRunQuery(code);
      } finally {
        setIsRunning(false);
      }
    }
  };

  return (
    <Paper
      sx={{
        position: 'relative',
        my: 2,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: isDarkMode ? '#1E1E1E' : '#f8f8f8',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
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
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          borderBottom: '1px solid',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: '0.65rem',
          }}
        >
          {language || 'text'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isSQL && (
            <Tooltip title={isRunning ? "Running query..." : "Run query"}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleRun}
                  disabled={isRunning}
                  sx={{ 
                    color: isRunning ? 'text.secondary' : 'success.main', 
                    '&:hover': { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                    minWidth: 28,
                    minHeight: 28,
                  }}
                >
                  {isRunning ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <PlayArrowRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{ 
                color: copied ? 'success.main' : 'text.secondary', 
                '&:hover': { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } 
              }}
            >
              {copied ? (
                <CheckRoundedIcon sx={{ fontSize: 14 }} />
              ) : (
                <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Code Content with Syntax Highlighting */}
      <Box sx={{ m: 0, overflow: 'auto' }}>
        <SyntaxHighlighter
          language={language || 'text'}
          style={isDarkMode ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: '16px',
            backgroundColor: 'transparent',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
          }}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </Box>
    </Paper>
  );
}

// Inline code component
function InlineCode({ children }) {
  const muiTheme = useMuiTheme();
  const isDarkMode = muiTheme.palette.mode === 'dark';
  
  return (
    <Box
      component="code"
      sx={{
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        color: 'primary.light',
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
        fontSize: '0.85em',
        fontFamily: '"Fira Code", "Monaco", monospace',
      }}
    >
      {children}
    </Box>
  );
}

function MarkdownRenderer({ content, onRunQuery }) {
  const muiTheme = useMuiTheme();
  const isDarkMode = muiTheme.palette.mode === 'dark';
  
  // Memoize the components object to prevent unnecessary re-renders
  const components = useMemo(() => ({
    // Handle code blocks vs inline code
    code({ node, className, children, ...props }) {
      // Check if it's inside a <pre> tag (code block) or standalone (inline)
      const isCodeBlock = node?.position?.start?.line !== node?.position?.end?.line ||
                          className?.startsWith('language-') ||
                          String(children).includes('\n');
      
      if (isCodeBlock || className) {
        return (
          <CodeBlock className={className} onRunQuery={onRunQuery}>
            {children}
          </CodeBlock>
        );
      }
      
      // Inline code
      return <InlineCode {...props}>{children}</InlineCode>;
    },
    // Ensure pre tags don't add extra wrapper
    pre({ children }) {
      return <>{children}</>;
    },
  }), [onRunQuery]);

  // Memoize remarkPlugins to prevent unnecessary re-renders
  const remarkPlugins = useMemo(() => [remarkGfm], []);

  return (
    <Box
      sx={{
        '& p': { my: 1, lineHeight: 1.7 },
        '& h1, & h2, & h3, & h4': { mt: 2.5, mb: 1, fontWeight: 600 },
        '& h1': { fontSize: '1.5rem' },
        '& h2': { fontSize: '1.25rem' },
        '& h3': { fontSize: '1.1rem' },
        '& ul, & ol': { pl: 2.5, my: 1 },
        '& li': { my: 0.25 },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          pl: 2,
          ml: 0,
          my: 1.5,
          color: 'text.secondary',
        },
        '& hr': { 
          border: 'none', 
          borderTop: '1px solid',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          my: 2 
        },
        '& table': { width: '100%', borderCollapse: 'collapse', my: 2 },
        '& th, & td': { 
          border: '1px solid',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          px: 1.5, 
          py: 0.75, 
          textAlign: 'left' 
        },
        '& th': { 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
          fontWeight: 600 
        },
        '& a': { color: 'primary.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        '& strong': { fontWeight: 600 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}

export default MarkdownRenderer;
