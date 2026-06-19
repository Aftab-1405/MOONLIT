/**
 * PageLoader - Minimal loading component with Moonlit branding
 *
 * Features:
 * - "Moonlit" title with breathing effect
 * - Smooth, non-intrusive animation
 */

import { Box, Typography, keyframes } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";

import { getMoonlitGradient } from "@/theme/index";
// Pure opacity pulse — no scale, which causes subpixel jitter on text rendering.
const breathe = keyframes`
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 1; }
`;
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

function PageLoader() {
  const theme = useTheme();
  // Monochrome glow — keeps the drop shadow consistent with the design system.
  const glowColor = alpha(
    theme.palette.text.primary,
    theme.palette.mode === "dark" ? 0.14 : 0.09,
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        animation: `${fadeIn} 0.3s ease-out`,
      }}
    >
      <Typography
        sx={{
          ...theme.typography.uiLoaderWordmark,
          background: getMoonlitGradient(theme),
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `drop-shadow(0 0 18px ${glowColor})`,
          animation: `${breathe} 2.5s ease-in-out infinite`,
        }}
      >
        Moonlit
      </Typography>
    </Box>
  );
}

export default PageLoader;
