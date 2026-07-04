import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import WrapTextRoundedIcon from '@mui/icons-material/WrapTextRounded';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CodeToTokenTransformStream } from '@shikijs/stream';
import { ShikiStreamRenderer } from '@shikijs/stream/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ButtonLoadingSpinner } from '@/components';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { copyToClipboard } from '@/utils/clipboard';
import { getShikiHighlighter } from '@/utils/shiki';

/**
 * CodeViewer — renders code blocks inside AI messages.
 *
 * Two rendering modes:
 *   1. Streaming (isStreaming=true): uses ShikiStreamRenderer to highlight
 *      tokens as they arrive over the SSE stream.
 *   2. Static (isStreaming=false): highlights the full code with Shiki once.
 *
 * For SQL blocks, shows a "Run query" affordance that calls `onRunQuery`.
 *
 * The Shiki highlighter is created once and cached (see utils/shiki.js).
 * Shiki + its grammars live in the `vendor-shiki` chunk (see vite.config.js)
 * so the main chat bundle stays small until a code block actually appears.
 *
 * Accessibility:
 *   - Action buttons have visible focus rings.
 *   - The "Run query" button has `aria-label="Run query"`.
 *   - The pre element uses `tabIndex={0}` only when wrap-long-lines is on,
 *     so a screen-reader user can scroll horizontally if needed.
 */

const SQL_LANGUAGES = new Set([
  'sql',
  'mysql',
  'postgresql',
  'sqlite',
  'sqlserver',
  'oracle',
  'tsql',
  'plsql',
]);

const ActionButton = memo(function ActionButton({ title, onClick, disabled, icon, active }) {
  const theme = useTheme();
  return (
    <Tooltip title={title} arrow>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          sx={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            color: active ? 'text.primary' : 'text.secondary',
            transition: 'all 0.15s ease',
            backgroundColor: 'transparent',
            border: 'none',
            [HOVER_CAPABLE_QUERY]: {
              '&:hover': {
                color: 'text.primary',
                backgroundColor: alpha(theme.palette.text.primary, 0.04),
              },
            },
            // Visible focus ring for keyboard users — was missing before.
            '&.Mui-focusVisible': {
              outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
              outlineOffset: 1,
            },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
});

function CodeViewer({
  value = '',
  language = 'sql',
  simple = false,
  transparent = false,
  onRunQuery,
  isStreaming = false,
  height = 'auto',
  style,
}) {
  const theme = useTheme();

  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [wrapLongLines, setWrapLongLines] = useState(false);
  const copyTimeoutRef = useRef(null);

  // States for static Shiki highlighting
  const [highlightedHtml, setHighlightedHtml] = useState('');
  const [loading, setLoading] = useState(true);

  // States for streaming Shiki highlighting
  const [tokensStream, setTokensStream] = useState(null);
  const controllerRef = useRef(null);
  const lastLengthRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const rawCode = value;
  const { code, detectedLanguage } = useMemo(() => {
    // Strip exactly one trailing newline to prevent layout shift between streaming and finished parsing
    const cleanRaw = rawCode.replace(/\n$/, '');
    const trimmed = rawCode.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.query === 'string') {
          return {
            code: parsed.query.replace(/\n$/, ''),
            detectedLanguage: 'sql',
          };
        }
      } catch {
        // ignore
      }
    }
    return {
      code: cleanRaw,
      detectedLanguage: language,
    };
  }, [rawCode, language]);

  const isSQL = SQL_LANGUAGES.has(detectedLanguage.toLowerCase());
  const hasLongLines = useMemo(() => code.split('\n').some((line) => line.length > 80), [code]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const handleRun = useCallback(async () => {
    if (onRunQuery && isSQL && !isRunning) {
      setIsRunning(true);
      try {
        await onRunQuery(code);
      } finally {
        setIsRunning(false);
      }
    }
  }, [onRunQuery, isSQL, isRunning, code]);

  const shikiTheme = theme.palette.mode === 'dark' ? 'dracula-soft' : 'github-light';

  // 1. Static highlighting effect (when isStreaming is false)
  useEffect(() => {
    if (isStreaming) {
      setHighlightedHtml('');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    getShikiHighlighter().then(async (highlighter) => {
      if (!active) return;
      try {
        const html = highlighter.codeToHtml(code, {
          lang: isSQL ? 'sql' : detectedLanguage || 'text',
          theme: shikiTheme,
        });
        if (active) {
          setHighlightedHtml(html);
          setLoading(false);
        }
      } catch (err) {
        console.error('Shiki static highlight error:', err);
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [code, detectedLanguage, isSQL, isStreaming, shikiTheme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: streaming highlighter is initialized once; updates are fed by a separate effect
  useEffect(() => {
    if (!isStreaming) {
      setTokensStream(null);
      controllerRef.current = null;
      lastLengthRef.current = 0;
      return;
    }

    let controller;
    let active = true;
    const rawStream = new ReadableStream({
      start(c) {
        controller = c;
        controllerRef.current = c;
      },
      cancel() {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      },
    });

    lastLengthRef.current = 0;

    getShikiHighlighter().then((highlighter) => {
      if (!active) return;
      try {
        const transformer = new CodeToTokenTransformStream({
          highlighter,
          lang: isSQL ? 'sql' : detectedLanguage || 'text',
          theme: shikiTheme,
          allowRecalls: true,
        });

        const piped = rawStream.pipeThrough(transformer);
        if (!active) return;

        setTokensStream(piped);

        if (code) {
          controller.enqueue(code);
          lastLengthRef.current = code.length;
        }
      } catch (err) {
        console.error('Shiki stream setup error:', err);
      }
    });

    return () => {
      active = false;
      if (controllerRef.current === controller) {
        try {
          controller.close();
        } catch (_) {}
        controllerRef.current = null;
      }
    };
  }, [isStreaming, detectedLanguage, isSQL]);

  // Feed new streamed characters into the stream
  useEffect(() => {
    if (isStreaming && controllerRef.current && code.length > lastLengthRef.current) {
      const delta = code.slice(lastLengthRef.current);
      try {
        controllerRef.current.enqueue(delta);
        lastLengthRef.current = code.length;
      } catch (_) {}
    }
  }, [code, isStreaming]);

  // Extract the inner HTML content of the static Shiki output (removing the outer pre and code tags)
  const innerHtml = useMemo(() => {
    if (!highlightedHtml) return '';
    return highlightedHtml
      .replace(/^<pre[^>]*>\s*<code[^>]*>/i, '')
      .replace(/<\/code>\s*<\/pre>$/i, '');
  }, [highlightedHtml]);

  // Layout styling definitions
  const containerBg = 'transparent';
  const containerBorder =
    transparent || simple ? 'transparent' : alpha(theme.palette.text.primary, 0.1);

  // Static or Simple rendering
  if (simple) {
    return (
      <Box
        sx={{
          height: height === 'auto' ? undefined : height,
          fontSize: theme.typography.uiCodeCompact?.fontSizePx ?? 12,
          fontFamily: theme.typography.fontFamilyMono,
          overflow: 'auto',
          width: '100%',
          ...style,
        }}
      >
        <Box
          component="pre"
          className={`shiki ${shikiTheme}`}
          sx={{
            background: 'transparent !important',
            margin: 0,
            padding: 0,
            whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
            overflowWrap: wrapLongLines ? 'anywhere' : 'normal',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            color: 'text.secondary',
            '& code': {
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
            },
            '& pre.shiki-stream': {
              margin: 0,
              padding: 0,
              backgroundColor: 'transparent',
            },
          }}
        >
          <code>
            {loading ? (
              code
            ) : (
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki generates safe HTML representation of code
              <span dangerouslySetInnerHTML={{ __html: innerHtml }} />
            )}
          </code>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        my: 2,
        borderRadius: '8px',
        border: simple ? 'none' : '1px solid',
        borderColor: containerBorder,
        backgroundColor: containerBg,
        overflow: 'hidden',
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      {/* Top Header Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 1.5,
          pb: 0.5,
          px: 2,
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontFamily: theme.typography.fontFamilyMono,
            fontSize: '0.8rem',
            textTransform: 'lowercase',
            opacity: 0.8,
            userSelect: 'none',
          }}
        >
          {detectedLanguage || 'code'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {hasLongLines && (
            <ActionButton
              title={wrapLongLines ? 'Unwrap lines' : 'Wrap lines'}
              onClick={() => setWrapLongLines((v) => !v)}
              active={wrapLongLines}
              icon={<WrapTextRoundedIcon sx={{ fontSize: 18 }} />}
            />
          )}
          {isSQL && onRunQuery && (
            <ActionButton
              title={isRunning ? 'Running…' : 'Run query'}
              onClick={handleRun}
              disabled={isRunning}
              icon={
                isRunning ? (
                  <ButtonLoadingSpinner size={14} />
                ) : (
                  <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
                )
              }
            />
          )}
          <ActionButton
            title={copied ? 'Copied!' : 'Copy code'}
            onClick={handleCopy}
            icon={
              copied ? (
                <CheckRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
              ) : (
                <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
              )
            }
          />
        </Box>
      </Box>

      {/* Code Text Window */}
      <Box
        sx={{
          overflowX: 'auto',
          pt: 0.5,
          pb: 2,
          px: 2,
        }}
      >
        <Box
          component="pre"
          className={`shiki ${shikiTheme}`}
          sx={{
            background: 'transparent !important',
            margin: 0,
            padding: 0,
            whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
            overflowWrap: wrapLongLines ? 'anywhere' : 'normal',
            fontSize: theme.typography.uiCodeBlock.fontSize,
            lineHeight: theme.typography.uiCodeBlock.lineHeight,
            fontFamily: theme.typography.fontFamilyMono,
            color: 'text.primary',
            '& code': {
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
            },
            '& pre.shiki-stream': {
              margin: 0,
              padding: 0,
              backgroundColor: 'transparent',
            },
          }}
        >
          <code>
            {isStreaming ? (
              tokensStream ? (
                <ShikiStreamRenderer stream={tokensStream} />
              ) : (
                code
              )
            ) : loading ? (
              code
            ) : (
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki generates safe HTML representation of code
              <span dangerouslySetInnerHTML={{ __html: innerHtml }} />
            )}
          </code>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(CodeViewer);
