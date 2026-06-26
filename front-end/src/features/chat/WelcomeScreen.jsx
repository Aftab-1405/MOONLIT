import { memo, useMemo, useCallback } from "react";
import { Box, Fade, Typography, Chip } from "@mui/material";
import { alpha, keyframes, useTheme } from "@mui/material/styles";
import ChatInput from "@/features/chat/ChatInput";
import { getWelcomeHeroSx } from "@/features/styles/interfaceChrome";
import { UI_LAYOUT, getInteractionColors } from "@/styles/shared";
import { HOVER_CAPABLE_QUERY } from "@/styles/mediaQueries";
import CodeEditorIcon from "@/components/icons/CodeEditorIcon";
import DatabaseIcon from "@/components/icons/DatabaseIcon";
import SchemaIcon from "@/components/icons/SchemaIcon";

const softReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmerText = keyframes`
  0% {
    background-position: 120% 50%;
  }
  100% {
    background-position: -120% 50%;
  }
`;

const WELCOME_PREFIX = "How can I help today";

const SUGGESTIONS = [
  {
    label: "Check Connection",
    icon: <DatabaseIcon sx={{ width: 16, height: 16 }} />,
    prompt: "Check my database connection status and show connection details",
  },
  {
    label: "Schema Details",
    icon: <SchemaIcon sx={{ width: 16, height: 16 }} />,
    prompt: "Show me the database schema with all tables and their columns",
  },
  {
    label: "Draft SQL Query",
    icon: <CodeEditorIcon sx={{ width: 16, height: 16 }} />,
    prompt: "Help me draft a SQL query for my database",
  },
];

const getSuggestionChipSx = (theme, interaction) => ({
  height: 30,
  borderRadius: "8px",
  border: "1px solid",
  borderColor: interaction.border,
  color: "text.secondary",
  backgroundColor: "transparent",
  cursor: "pointer",
  transition: theme.transitions.create(["background-color", "color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:active": { backgroundColor: interaction.activeBackground },
  "& .MuiChip-label": {
    px: 1.2,
    ...theme.typography.uiCaptionSm,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  "& .MuiChip-icon": {
    color: alpha(theme.palette.text.primary, 0.45),
    ml: 1,
    mr: -0.25,
    fontSize: 16,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    transition: theme.transitions.create("color", {
      duration: theme.transitions.duration.shorter,
    }),
  },
  [HOVER_CAPABLE_QUERY]: {
    "&:hover": {
      borderColor: interaction.border,
      backgroundColor: interaction.hoverBackground,
      color: "text.primary",
      "& .MuiChip-icon": {
        color: alpha(theme.palette.text.primary, 0.65),
      },
    },
  },
  "&.Mui-focusVisible": {
    borderColor: interaction.border,
    boxShadow: `0 0 0 3px ${interaction.focusRing}`,
  },
});

function WelcomeScreen({ visible, user, chatInputProps }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(" ")[0];
  const neutralInteraction = useMemo(
    () => getInteractionColors(theme),
    [theme],
  );
  const suggestionChipSx = useMemo(
    () => getSuggestionChipSx(theme, neutralInteraction),
    [theme, neutralInteraction],
  );

  const { onSend } = chatInputProps || {};

  const handleSuggestionClick = useCallback(
    (prompt) => {
      onSend?.(prompt);
    },
    [onSend],
  );

  return (
    <Fade in={visible} timeout={300} unmountOnExit>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflowY: "auto",
          px: { xs: 1, sm: 3 },
          py: { xs: 2.5, sm: 4 },
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: { xs: 1.75, sm: 2.25 },
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              animation: visible ? `${softReveal} 200ms ease-out both` : "none",
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Typography
              component="h1"
              sx={{
                ...getWelcomeHeroSx(theme),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.24em",
                flexWrap: "wrap",
                maxWidth: { xs: "min(100%, 680px)", sm: 720 },
                fontSize: { xs: "1.65rem", sm: "2.05rem", md: "2.55rem" },
                fontWeight: 500,
                lineHeight: 1.18,
              }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  color: "text.primary",
                  backgroundImage: `linear-gradient(105deg, ${alpha(
                    theme.palette.text.primary,
                    0.72,
                  )} 0%, ${theme.palette.text.primary} 42%, ${alpha(
                    theme.palette.text.primary,
                    0.68,
                  )} 58%, ${theme.palette.text.primary} 100%)`,
                  backgroundSize: "240% 100%",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: `${shimmerText} 4.8s ease-in-out infinite`,
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                    backgroundImage: "none",
                    WebkitTextFillColor: "currentColor",
                  },
                }}
              >
                {WELCOME_PREFIX}
              </Box>
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  color: "text.primary",
                  fontWeight: 520,
                }}
              >
                {firstName ? `, ${firstName}?` : "?"}
              </Box>
            </Typography>
          </Box>

          <Box
            sx={{
              width: "100%",
              animation: visible ? `${softReveal} 240ms ease-out both` : "none",
              animationDelay: visible ? "45ms" : "0ms",
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <ChatInput {...chatInputProps}>
              <Box
                sx={{
                  width: "100%",
                  maxWidth: UI_LAYOUT.chatInputMaxWidth,
                  mx: "auto",
                  mt: 1,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 0.75,
                  flexWrap: "wrap",
                }}
              >
                {SUGGESTIONS.map(({ label, icon, prompt }, index) => (
                  <Box
                    key={label}
                    sx={{
                      animation: visible
                        ? `${softReveal} 220ms ease-out both`
                        : "none",
                      animationDelay: visible ? `${70 + index * 35}ms` : "0ms",
                      "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                      },
                    }}
                  >
                    <Chip
                      icon={icon}
                      label={label}
                      onClick={() => handleSuggestionClick(prompt)}
                      size="small"
                      sx={suggestionChipSx}
                    />
                  </Box>
                ))}
              </Box>
            </ChatInput>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}

export default memo(WelcomeScreen);
