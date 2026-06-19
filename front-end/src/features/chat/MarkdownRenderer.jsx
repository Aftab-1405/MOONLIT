import { memo, useMemo, useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Typography, IconButton, Tooltip, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import WrapTextRoundedIcon from "@mui/icons-material/WrapTextRounded";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { ButtonLoadingSpinner } from "@/components";
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

  // Check if the code block content is a JSON containing 'query'
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
  // Only show the wrap toggle when there are actually long lines worth wrapping.
  const hasLongLines = useMemo(
    () => code.split("\n").some((line) => line.length > 80),
    [code],
  );

  // Use the same surface level as the page — no dark pit, consistent with tables
  const codeBg = theme.palette.background.elevated;
  const headerBg = isDarkMode
    ? alpha(theme.palette.background.elevated, 0.9)
    : alpha(theme.palette.background.paper, 0.95);

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
      my: { xs: 1.25, sm: 1.5 },
      borderRadius: "10px",
      overflow: "hidden",
      backgroundColor: codeBg,
      border: "1px solid",
      borderColor: theme.palette.border.subtle,
      minWidth: 0, // CRITICAL: Prevents flexbox overflow issues during streaming
      width: "100%",
      transition: "border-color 140ms ease, box-shadow 140ms ease",
      "&:hover": {
        borderColor: alpha(
          theme.palette.text.secondary,
          isDarkMode ? 0.18 : 0.14,
        ),
        boxShadow: `0 8px 22px ${alpha(theme.palette.common.black, isDarkMode ? 0.18 : 0.06)}`,
      },
    }),
    [theme, codeBg, isDarkMode],
  );

  return (
    <Box sx={containerStyles}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 1.1, sm: 1.35 },
          minHeight: { xs: 34, sm: 36 },
          borderBottom: "1px solid",
          borderColor: theme.palette.border.subtle,
          backgroundColor: headerBg,
          gap: 0.75,
        }}
      >
        {/* Language label */}
        <Box
          sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}
        >
          <Typography
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 500,
              fontFamily: theme.typography.fontFamilyMono,
              ...theme.typography.uiCaption2xs,
              textTransform: "lowercase",
              letterSpacing: 0,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {detectedLanguage || "code"}
            {rationale ? ` - ${rationale}` : ""}
          </Typography>
        </Box>

        {/* Action buttons */}
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
                color={wrapLongLines ? "success" : "primary"}
                aria-label={
                  wrapLongLines ? "Unwrap long lines" : "Wrap long lines"
                }
              >
                <WrapTextRoundedIcon sx={{ fontSize: 14 }} />
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
                  color="success"
                  aria-label={isRunning ? "Running query" : "Run query"}
                >
                  {isRunning ? (
                    <ButtonLoadingSpinner size={13} />
                  ) : (
                    <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={copied ? "Copied!" : "Copy"} arrow>
            <IconButton
              size="small"
              onClick={handleCopy}
              color={copied ? "success" : "primary"}
              aria-label={copied ? "Copied" : "Copy code"}
              sx={{ transition: "color 120ms ease" }}
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

      {/* Code body */}
      <Box
        sx={{
          overflowX: "auto",
          minHeight: 56,
        }}
      >
        <SyntaxHighlighter
          language={detectedLanguage || "text"}
          style={isDarkMode ? vscDarkPlus : vs}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: isDarkMode ? alpha("#ffffff", 0.18) : alpha("#000000", 0.22),
            fontSize: "0.78em",
            userSelect: "none",
          }}
          customStyle={{
            margin: 0,
            padding: "12px 14px",
            fontSize: theme.typography.uiCodeBlock.fontSize,
            lineHeight: theme.typography.uiCodeBlock.lineHeight,
            background: "transparent",
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
        fontSize: theme.typography.uiCodeBlock.fontSize,
        backgroundColor: theme.palette.code.background,
        px: 0.6,
        py: 0.15,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: theme.palette.code.border,
        fontWeight: 500,
        wordBreak: "break-word", // CRITICAL: Prevents inline code from causing horizontal overflow
        color:
          theme.palette.mode === "dark"
            ? alpha(theme.palette.text.primary, 0.88)
            : alpha(theme.palette.text.primary, 0.82),
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
        const match = /language-(\w+)/.exec(className || "");
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
            borderRadius: "12px",
            border: "1px solid",
            borderColor: theme.palette.border.subtle,
            minHeight: 96,
            transition: "border-color 0.18s ease",
            "&:hover": {
              borderColor: alpha(
                theme.palette.text.secondary,
                isDarkMode ? 0.18 : 0.14,
              ),
            },
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
      overflowWrap: "anywhere", // CRITICAL: Breaks long strings (URLs/tokens) to prevent layout shifting
      wordBreak: "break-word",

      "& p": { my: 1.15, lineHeight: 1.68 },
      "& p:first-of-type": { mt: 0 },
      "& p:last-child": { mb: 0 },
      "& ul, & ol": {
        pl: 2.5,
        my: 1.15,
      },
      "& li": { mb: 0.35, minHeight: "1.45em" },
      "& a": {
        color: "primary.main",
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
      },
      "& img": {
        maxWidth: "100%",
        height: "auto",
        display: "block",
        borderRadius: 1,
      },
      "& blockquote": {
        borderLeft: `3px solid ${theme.palette.border.default}`,
        margin: 0,
        my: 1.5,
        pl: 1.5,
        pr: 1.5,
        py: 0.85,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.action.hover,
        borderRadius: "8px",
      },
      "& hr": {
        border: "none",
        borderTop: `1px solid ${theme.palette.border.subtle}`,
        my: 1.5,
      },
      "& table": {
        overflowWrap: "normal", // Override global setting for tables
        wordBreak: "normal",
        ...theme.typography.uiBodyTable,
      },
      "& th": {
        bgcolor: theme.palette.action.hover,
        fontWeight: 600,
        textAlign: "left",
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${theme.palette.divider}`,
        whiteSpace: "nowrap",
        ...theme.typography.uiCaptionMd,
      },
      "& td": {
        px: { xs: 1.25, sm: 2 },
        py: { xs: 0.85, sm: 1 },
        borderBottom: `1px solid ${theme.palette.border.subtle}`,
        whiteSpace: "nowrap",
      },
      "& tr:last-child td": { borderBottom: "none" },
      "& tr:hover td": {
        bgcolor: theme.palette.action.hover,
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
