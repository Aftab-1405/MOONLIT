import { memo, useMemo, useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Typography, IconButton, Tooltip, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import WrapTextRoundedIcon from "@mui/icons-material/WrapTextRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { ButtonLoadingSpinner } from "@/components";
import { HOVER_CAPABLE_QUERY } from "@/styles/mediaQueries";
import { copyToClipboard } from "@/utils/clipboard";

const SQL_LANGUAGES = new Set([
  "sql",
  "mysql",
  "postgresql",
  "sqlite",
  "sqlserver",
  "oracle",
  "tsql",
  "plsql",
]);

// Languages rendered as interactive canvas artifacts — never shown as code blocks.
const CANVAS_LANGUAGES = new Set(["diagram-flow"]);

const REMARK_PLUGINS = [remarkGfm];
const CODE_ACTION_SIZE = 30;

const getCodeActionButtonSx = (
  theme,
  { active = false, tone = "neutral" } = {},
) => {
  const toneColor =
    tone === "success" ? theme.palette.success.main : theme.palette.text.primary;

  return {
    width: CODE_ACTION_SIZE,
    height: CODE_ACTION_SIZE,
    borderRadius: "8px",
    color: active ? toneColor : "text.secondary",
    transition: theme.transitions.create(["background-color", "color"], {
      duration: theme.transitions.duration.shorter,
    }),
    [HOVER_CAPABLE_QUERY]: {
      "&:hover": {
        color: active ? toneColor : "text.primary",
        backgroundColor: alpha(theme.palette.text.primary, 0.045),
      },
    },
    "&.Mui-disabled": {
      color: alpha(theme.palette.text.primary, 0.34),
    },
    "&:focus-visible": {
      outline: `2px solid ${alpha(
        theme.palette.text.primary,
        theme.palette.mode === "dark" ? 0.18 : 0.12,
      )}`,
      outlineOffset: 2,
    },
  };
};

const CodeBlock = memo(function CodeBlock({
  children,
  className,
  onRunQuery,
  isDarkMode,
  theme,
}) {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [wrapLongLines, setWrapLongLines] = useState(false);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const language = className?.replace("language-", "") || "";
  const rawCode = useMemo(() => {
    return Array.isArray(children)
      ? children.join("")
      : String(children || "").replace(/\n$/, "");
  }, [children]);

  const { code, detectedLanguage, rationale } = useMemo(() => {
    const trimmed = rawCode.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.query === "string") {
          return {
            code: parsed.query,
            detectedLanguage: "sql",
            rationale: parsed.rationale || null,
          };
        }
      } catch {
        // ignore and proceed with rawCode
      }
    }
    return {
      code: rawCode,
      detectedLanguage: language,
      rationale: null,
    };
  }, [rawCode, language]);

  const isSQL = SQL_LANGUAGES.has(detectedLanguage.toLowerCase());
  const lineCount = code.split("\n").length;
  const showLineNumbers = lineCount >= 4;
  const hasLongLines = useMemo(
    () => code.split("\n").some((line) => line.length > 80),
    [code],
  );

  const codeBg = alpha(theme.palette.text.primary, isDarkMode ? 0.028 : 0.018);
  const codeBorder = alpha(
    theme.palette.text.primary,
    isDarkMode ? 0.1 : 0.075,
  );
  const dividerColor = alpha(
    theme.palette.text.primary,
    isDarkMode ? 0.08 : 0.06,
  );

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

  const containerStyles = useMemo(
    () => ({
      my: { xs: 1.5, sm: 2 },
      borderRadius: "8px",
      border: "1px solid",
      borderColor: codeBorder,
      overflow: "hidden",
      backgroundColor: codeBg,
      minWidth: 0,
      width: "100%",
    }),
    [codeBg, codeBorder],
  );

  return (
    <Box sx={containerStyles}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 0.75,
          pl: { xs: 2, md: 2.5 },
          pr: 0.75,
          backgroundColor: "transparent",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minWidth: 0,
            flex: 1,
            gap: 1,
          }}
        >
          <CodeRoundedIcon
            sx={{ fontSize: 17, color: theme.palette.text.secondary }}
          />
          <Typography
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 600,
              fontFamily: theme.typography.fontFamily,
              fontSize: "0.8125rem",
              textTransform: "capitalize",
              letterSpacing: 0,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {detectedLanguage || "Code"}
            {rationale ? ` - ${rationale}` : ""}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            flexShrink: 0,
          }}
        >
          {hasLongLines && (
            <Tooltip
              title={wrapLongLines ? "Unwrap long lines" : "Wrap long lines"}
              arrow
            >
              <IconButton
                size="small"
                onClick={() => setWrapLongLines((v) => !v)}
                aria-label={
                  wrapLongLines ? "Unwrap long lines" : "Wrap long lines"
                }
                sx={getCodeActionButtonSx(theme, {
                  active: wrapLongLines,
                  tone: "success",
                })}
              >
                <WrapTextRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {isSQL && (
            <Tooltip title={isRunning ? "Running…" : "Run query"} arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={handleRun}
                  disabled={isRunning}
                  aria-label={isRunning ? "Running query" : "Run query"}
                  sx={getCodeActionButtonSx(theme, {
                    active: true,
                    tone: "success",
                  })}
                >
                  {isRunning ? (
                    <ButtonLoadingSpinner size={15} />
                  ) : (
                    <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={copied ? "Copied!" : "Copy"} arrow>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy code"}
              sx={getCodeActionButtonSx(theme, {
                active: copied,
                tone: "success",
              })}
            >
              {copied ? (
                <CheckRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          overflowX: "auto",
          minHeight: 56,
          px: { xs: 0.5, md: 1 },
          pb: { xs: 0.5, md: 1 },
        }}
      >
        <SyntaxHighlighter
          language={detectedLanguage || "text"}
          style={isDarkMode ? vscDarkPlus : vs}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: alpha(theme.palette.text.primary, isDarkMode ? 0.18 : 0.22),
            fontSize: "0.78em",
            userSelect: "none",
          }}
          customStyle={{
            margin: 0,
            padding: "12px 14px",
            fontSize: theme.typography.uiCodeBlock.fontSize,
            lineHeight: theme.typography.uiCodeBlock.lineHeight,
            background: "transparent",
            border: "none",
          }}
          wrapLines={wrapLongLines}
          wrapLongLines={wrapLongLines}
        >
          {code}
        </SyntaxHighlighter>
      </Box>
    </Box>
  );
});

const InlineCode = memo(function InlineCode({ children, theme }) {
  return (
    <Typography
      component="code"
      sx={{
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: "0.85em",
        backgroundColor:
          theme.palette.mode === "dark"
            ? alpha(theme.palette.text.primary, 0.12)
            : alpha(theme.palette.text.primary, 0.08),
        px: 0.75,
        py: 0.25,
        borderRadius: "6px",
        fontWeight: 500,
        wordBreak: "break-word",
        color:
          theme.palette.mode === "dark"
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
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  const processedContent = useMemo(() => {
    if (typeof content !== "string") return content;
    let text = content;

    // Strip canvas-language code blocks before remark parses them.
    // This covers:
    //   1. Complete blocks  — both fences present (non-greedy match)
    //   2. Partial/streaming blocks — opening fence arrived, closing fence
    //      not yet streamed in (match to end of string).
    // The `code` component still returns null as a safety net, but this
    // pre-strip is the reliable fix for the streaming race.
    for (const lang of CANVAS_LANGUAGES) {
      // Complete block (non-greedy so multiple blocks don't merge)
      text = text.replace(
        new RegExp("```" + lang + "[^\\n]*\\n[\\s\\S]*?```", "gi"),
        "",
      );
      // Partial/open block — opening fence with no matching closing fence
      text = text.replace(
        new RegExp("```" + lang + "[^\\n]*(?:\\n[\\s\\S]*)?$", "gi"),
        "",
      );
    }

    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.query === "string") {
          let header = "";
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
        const match = /language-([A-Za-z0-9_-]+)/.exec(className || "");
        const language = match ? match[1].toLowerCase() : "";

        // Canvas languages (e.g. diagram-flow) are rendered as artifact cards
        // by MessageList — never as code blocks here.
        if (CANVAS_LANGUAGES.has(language)) return null;

        const isBlock = match || String(children).includes("\n");

        if (isBlock) {
          return (
            <CodeBlock
              className={className}
              onRunQuery={onRunQuery}
              isDarkMode={isDarkMode}
              theme={theme}
            >
              {children}
            </CodeBlock>
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
            overflowX: "auto",
            my: 2,
            borderRadius: "8px",
            border: "1px solid",
            borderColor: alpha(theme.palette.text.primary, 0.075),
            backgroundColor: alpha(
              theme.palette.text.primary,
              theme.palette.mode === "dark" ? 0.022 : 0.014,
            ),
          }}
        >
          <Box
            component="table"
            sx={{
              minWidth: "max-content",
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            {children}
          </Box>
        </Box>
      ),
    }),
    [onRunQuery, isDarkMode, theme],
  );
  const containerSx = useMemo(
    () => ({
      overflowWrap: "anywhere",
      wordBreak: "break-word",

      "& p": { my: 1.2, lineHeight: 1.72 },
      "& p:first-of-type": { mt: 0 },
      "& p:last-child": { mb: 0 },
      "& ul, & ol": {
        pl: 2.5,
        my: 1.25,
      },
      "& li": { mb: 0.5, minHeight: "1.5em", lineHeight: 1.7 },
      "& a": {
        color: "text.primary",
        textDecoration: "none",
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.22)}`,
        transition: theme.transitions.create(["border-color", "color"], {
          duration: theme.transitions.duration.shorter,
        }),
        [HOVER_CAPABLE_QUERY]: {
          "&:hover": {
            color: "text.primary",
            borderBottomColor: theme.palette.text.primary,
          },
        },
      },
      "& img": {
        maxWidth: "100%",
        height: "auto",
        display: "block",
        borderRadius: "8px",
      },
      "& blockquote": {
        borderLeft: `2px solid ${alpha(theme.palette.text.primary, 0.16)}`,
        margin: 0,
        my: 1.5,
        pl: 1.5,
        py: 0.5,
        color: theme.palette.text.secondary,
      },
      "& hr": {
        border: "none",
        borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        my: 1.5,
      },
      "& table": {
        overflowWrap: "normal",
        wordBreak: "normal",
        ...theme.typography.uiBodyTable,
      },
      "& th": {
        bgcolor: alpha(
          theme.palette.text.primary,
          theme.palette.mode === "dark" ? 0.045 : 0.028,
        ),
        fontWeight: 600,
        textAlign: "left",
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.075)}`,
        whiteSpace: "nowrap",
        ...theme.typography.uiCaptionMd,
      },
      "& td": {
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
        whiteSpace: "nowrap",
      },
      "& tr:last-child td": { borderBottom: "none" },
      "& tr:hover td": {
        bgcolor: alpha(
          theme.palette.text.primary,
          theme.palette.mode === "dark" ? 0.04 : 0.024,
        ),
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
