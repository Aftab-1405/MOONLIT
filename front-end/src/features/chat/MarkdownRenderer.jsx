import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { TRANSITIONS } from '@/theme/themeEffects';
import { CodeViewer } from '@/components';

// Languages rendered as interactive canvas artifacts — never shown as code blocks.
const CANVAS_LANGUAGES = new Set(['diagram-flow']);
const REMARK_PLUGINS = [remarkGfm];

const InlineCode = memo(function InlineCode({ children, theme }) {
  return (
    <Typography
      component="code"
      sx={{
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: '0.85em',
        backgroundColor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.text.primary, 0.12)
            : alpha(theme.palette.text.primary, 0.08),
        px: 0.75,
        py: 0.25,
        borderRadius: '6px',
        fontWeight: 500,
        wordBreak: 'break-word',
        color:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.text.primary, 0.9)
            : alpha(theme.palette.text.primary, 0.85),
      }}
    >
      {children}
    </Typography>
  );
});

const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  onRunQuery,
  isStreaming = false,
}) {
  const theme = useTheme();

  const processedContent = useMemo(() => {
    if (typeof content !== 'string') return content;
    let text = content;

    // Strip canvas-language code blocks before remark parses them.
    // This covers:
    //   1. Complete blocks  — both fences present (non-greedy match)
    //   2. Partial/streaming blocks — opening fence arrived, closing fence
    //      not yet streamed in (match to end of string).
    for (const lang of CANVAS_LANGUAGES) {
      // Complete block (non-greedy so multiple blocks don't merge)
      text = text.replace(new RegExp(`\`\`\`${lang}[^\\n]*\\n[\\s\\S]*?\`\`\``, 'gi'), '');
      // Partial/open block — opening fence with no matching closing fence
      text = text.replace(new RegExp(`\`\`\`${lang}[^\\n]*(?:\\n[\\s\\S]*)?$`, 'gi'), '');
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.query === 'string') {
          let header = '';
          if (parsed.rationale) {
            header = `> **Rationale**: ${parsed.rationale}\n\n`;
          }
          return `${header}\`\`\`sql\n${parsed.query}\n\`\`\``;
        }
      } catch {
        // ignore
      }
    }
    return text;
  }, [content]);

  const components = useMemo(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-([A-Za-z0-9_-]+)/.exec(className || '');
        const language = match ? match[1].toLowerCase() : '';

        // Canvas languages (e.g. diagram-flow) are rendered as artifact cards
        // by MessageList — never as code blocks here.
        if (CANVAS_LANGUAGES.has(language)) return null;

        const isBlock = match || String(children).includes('\n');

        if (isBlock) {
          return (
            <CodeViewer
              value={Array.isArray(children) ? children.join('') : String(children || '')}
              language={language}
              onRunQuery={onRunQuery}
              isStreaming={isStreaming}
            />
          );
        }
        return (
          <InlineCode theme={theme} {...props}>
            {children}
          </InlineCode>
        );
      },
      pre: ({ children }) => <>{children}</>,
      table: ({ children }) => (
        <Box
          sx={{
            overflowX: 'auto',
            my: 2,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.075),
            backgroundColor: alpha(
              theme.palette.text.primary,
              theme.palette.mode === 'dark' ? 0.022 : 0.014,
            ),
          }}
        >
          <Box
            component="table"
            sx={{
              minWidth: 'max-content',
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            {children}
          </Box>
        </Box>
      ),
    }),
    [onRunQuery, isStreaming, theme],
  );

  const containerSx = useMemo(
    () => ({
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',

      '& p': { my: 1.2, lineHeight: 1.72 },
      '& p:first-of-type': { mt: 0 },
      '& p:last-child': { mb: 0 },
      '& ul, & ol': {
        pl: 2.5,
        my: 1.25,
      },
      '& li': { mb: 0.5, minHeight: '1.5em', lineHeight: 1.7 },
      '& a': {
        color: 'text.primary',
        textDecoration: 'none',
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.22)}`,
        transition: TRANSITIONS.default,
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            color: 'text.primary',
            borderBottomColor: theme.palette.text.primary,
          },
        },
      },
      '& img': {
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '8px',
      },
      '& blockquote': {
        borderLeft: `2px solid ${alpha(theme.palette.text.primary, 0.16)}`,
        margin: 0,
        my: 1.5,
        pl: 1.5,
        py: 0.5,
        color: theme.palette.text.secondary,
      },
      '& hr': {
        border: 'none',
        borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        my: 1.5,
      },
      '& h1, & h2, & h3': {
        fontFamily: theme.typography.h1.fontFamily,
        color: theme.palette.text.primary,
        lineHeight: 1.3,
        mt: 2.5,
        mb: 1,
      },
      '& h1': { fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' },
      '& h2': { fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.015em' },
      '& h3': { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em' },
      '& h4, & h5, & h6': {
        fontSize: '0.95rem',
        fontWeight: 600,
        color: theme.palette.text.primary,
        mt: 1.5,
        mb: 0.5,
        lineHeight: 1.4,
      },
      '& table': {
        overflowWrap: 'normal',
        wordBreak: 'normal',
        ...theme.typography.uiBodyTable,
      },
      '& th': {
        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.045 : 0.028),
        fontWeight: 600,
        textAlign: 'left',
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.075)}`,
        whiteSpace: 'nowrap',
        ...theme.typography.uiCaptionMd,
      },
      '& td': {
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
        whiteSpace: 'nowrap',
      },
      '& tr:last-child td': { borderBottom: 'none' },
      '& tr:hover td': {
        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.024),
      },
    }),
    [theme],
  );

  return (
    <Box sx={containerSx}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {processedContent}
      </ReactMarkdown>
    </Box>
  );
});

export default MarkdownRenderer;
