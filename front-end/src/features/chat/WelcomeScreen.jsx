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

function WelcomeScreen({ visible, user, chatInputProps }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(" ")[0];
  const neutralInteraction = useMemo(
    () => getInteractionColors(theme),
    [theme],
  );

  const suggestions = useMemo(
    () => [
      {
        label: "Check Connection",
        icon: <DatabaseIcon sx={{ width: 16, height: 16 }} />,
        prompt:
          "Check my database connection status and show connection details",
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
    ],
    [],
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
          py: { xs: 3, sm: 4 },
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
            gap: { xs: 2, sm: 2.5 },
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
                gap: "0.4em",
                flexWrap: "wrap",
              }}
            >
              <span>
                {firstName
                  ? `How can I help today, ${firstName}?`
                  : "How can I help you today?"}
              </span>
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
              {/* Suggestion Chips */}
              <Box
                sx={{
                  width: "100%",
                  maxWidth: UI_LAYOUT.chatInputMaxWidth,
                  mx: "auto",
                  mt: 1.25,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 0.75,
                  flexWrap: "wrap",
                }}
              >
                {suggestions.map((chip, index) => (
                  <Box
                    key={chip.label}
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
                      icon={chip.icon}
                      label={chip.label}
                      onClick={() => handleSuggestionClick(chip.prompt)}
                      size="small"
                      sx={{
                        height: 30,
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: neutralInteraction.border,
                        color: "text.secondary",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        transition: theme.transitions.create(
                          [
                            "background-color",
                            "border-color",
                            "color",
                            "transform",
                          ],
                          {
                            duration: theme.transitions.duration.shorter,
                          },
                        ),
                        "&:active": { transform: "translateY(1px)" },
                        "& .MuiChip-label": {
                          px: 1.25,
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
                        },
                        [HOVER_CAPABLE_QUERY]: {
                          "&:hover": {
                            borderColor: neutralInteraction.hoverBorder,
                            backgroundColor: neutralInteraction.hoverBackground,
                            color: "text.primary",
                            "& .MuiChip-icon": {
                              color: alpha(theme.palette.text.primary, 0.65),
                            },
                          },
                        },
                        "&.Mui-focusVisible": {
                          borderColor: neutralInteraction.activeBorder,
                          boxShadow: `0 0 0 3px ${neutralInteraction.focusRing}`,
                        },
                      }}
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
