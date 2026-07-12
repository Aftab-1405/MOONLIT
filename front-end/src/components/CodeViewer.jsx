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
 * SINGLE RENDER PATH: ShikiStreamRenderer is used for BOTH streaming and
 * static code. This is a deliberate architectural choice:
 *
 *   - Streaming code: fed into the ReadableStream incrementally as it
 *     arrives over SSE. Tokens render as they're tokenized.
 *   - Static code: fed into the ReadableStream all at once on mount. The
 *     ShikiStreamRenderer tokenizes synchronously and renders the same
 *     `<span>`-based DOM as a streaming render.
 *
 * Using one render path for both modes means the DOM structure is identical
 * whether the code arrived in one chunk or fifty — so there is NEVER a
 * layout shift when streaming completes. The previous dual-path
 * implementation (ShikiStream for streaming, `codeToHtml` +
 * `dangerouslySetInnerHTML` for static) produced structurally different DOM
 * in the two modes, which caused the visible "height shrink" when streaming
 * finished and the component flipped to static mode.
 *
 * For SQL blocks, shows a "Run query" affordance that calls `onRunQuery`.
 *
 * The Shiki highlighter is created once and cached (see utils/shiki.js).
 * Shiki + its grammars live in the `vendor-shiki` chunk (see vite.config.js)
 * so the main chat bundle stays small until a code block actually appears.
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

  // ShikiStream state — the single render path for both streaming and static.
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
    // Strip exactly one trailing newline to prevent a trailing empty line.
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

  // ── Single ShikiStream setup effect ──────────────────────────────────────
  // This runs for BOTH streaming and static code. The stream is created once
  // per (language, theme) combination; code is fed into it either
  // incrementally (streaming) or all at once (static) by the feed effect
  // below.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: the stream is initialized once per (language, theme); code updates are fed by the separate feed effect below.
  useEffect(() => {
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

        // For static code (isStreaming=false) OR when the full code is
        // already present at mount, feed the entire code into the stream
        // immediately. The ShikiStreamRenderer tokenizes synchronously
        // and renders the same DOM as a streaming render — just without
        // the incremental arrivals.
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
        } catch (_) { }
        controllerRef.current = null;
      }
    };
  }, [isStreaming, detectedLanguage, isSQL, shikiTheme]);

  // ── Feed effect — incremental code arrival ───────────────────────────────
  // For streaming code: feeds only the NEW characters (delta) into the stream
  // as they arrive. For static code: this effect runs once (code doesn't
  // change) and the full code was already fed by the setup effect above, so
  // the delta check (`code.length > lastLengthRef.current`) is false and
  // nothing happens.
  useEffect(() => {
    if (controllerRef.current && code.length > lastLengthRef.current) {
      const delta = code.slice(lastLengthRef.current);
      try {
        controllerRef.current.enqueue(delta);
        lastLengthRef.current = code.length;
      } catch (_) { }
    }
  }, [code]);

  // Layout styling definitions
  const containerBg = 'transparent';
  const containerBorder =
    transparent || simple ? 'transparent' : alpha(theme.palette.text.primary, 0.1);

  // Shared sx for the outer <pre> — used by both the simple and full variants.
  // Forces the nested pre.shiki-stream (rendered by ShikiStreamRenderer) to
  // inherit ALL typography from the outer pre so streaming and static modes
  // render at identical metrics.
  const preSx = useMemo(
    () => ({
      background: 'transparent !important',
      margin: 0,
      padding: 0,
      whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
      overflowWrap: wrapLongLines ? 'anywhere' : 'normal',
      '& code': {
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: 'inherit',
      },
      // ShikiStreamRenderer renders <pre className="shiki shiki-stream"> with
      // browser-default typography. Force it to inherit the outer pre's
      // metrics so the rendered height is identical regardless of token
      // count or streaming state.
      '& pre.shiki-stream': {
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: 'inherit',
        letterSpacing: 'inherit',
        fontVariant: 'inherit',
        fontFeatureSettings: 'inherit',
        fontStretch: 'inherit',
        whiteSpace: 'inherit',
        overflowWrap: 'inherit',
        wordBreak: 'inherit',
        color: 'inherit',
        '& code': {
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        },
        '& span': {
          lineHeight: 'inherit',
          fontSize: 'inherit',
          fontFamily: 'inherit',
        },
      },
    }),
    [wrapLongLines],
  );

  // The stream might not be ready yet (highlighter still loading). Fall back
  // to plain text so the user sees the code immediately — Shiki will swap in
  // highlighted tokens as soon as the stream is piped.
  const renderCode = () => {
    if (tokensStream) {
      return <ShikiStreamRenderer stream={tokensStream} />;
    }
    return code;
  };

  // ── Simple variant (used by UserDBContextManagerForAI, StepTimelineItems)
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
            ...preSx,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            color: 'text.secondary',
          }}
        >
          <code>{renderCode()}</code>
        </Box>
      </Box>
    );
  }

  // ── Full variant (used by MarkdownRenderer for code blocks in AI messages)
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
            ...preSx,
            fontSize: theme.typography.uiCodeBlock.fontSize,
            lineHeight: theme.typography.uiCodeBlock.lineHeight,
            fontFamily: theme.typography.fontFamilyMono,
            color: 'text.primary',
          }}
        >
          <code>{renderCode()}</code>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(CodeViewer);
