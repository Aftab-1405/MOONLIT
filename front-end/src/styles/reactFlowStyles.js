import { alpha } from '@mui/material/styles';

export const FLOW_NODE_CARD_CLASS = 'moonlit-flow-node-card';
export const HIDDEN_FLOW_HANDLE_STYLE = {
  opacity: 0,
  width: 10,
  height: 10,
  minWidth: 10,
  minHeight: 10,
  border: 0,
  background: 'transparent',
  pointerEvents: 'none',
};

const FLOW_GRID_SIZE = 24;
const FLOW_NODE_RADIUS = '11px';

const getAlphaColor = (color, opacity) => {
  if (typeof color !== 'string' || !color.trim()) return null;
  try {
    return alpha(color, opacity);
  } catch {
    return null;
  }
};

const getCustomStyleAccent = (style) => {
  if (!style || typeof style !== 'object') return null;
  return style.borderColor || style.backgroundColor || style.color || null;
};

export const getReactFlowCanvasSx = (
  theme,
  { cardClassName = FLOW_NODE_CARD_CLASS, tone = 'diagram' } = {},
) => {
  const isDark = theme.palette.mode === 'dark';
  const isSchema = tone === 'schema';
  const textInk = theme.palette.text.primary;
  const paper = theme.palette.background.paper;
  const base = theme.palette.background.default;
  const glowTone = theme.palette.info.main;
  const warmTone = theme.palette.warning.main;

  return {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: alpha(base, isDark ? (isSchema ? 0.74 : 0.76) : isSchema ? 0.65 : 0.68),
    backgroundImage: [
      // Top-left ambient haze
      `radial-gradient(ellipse at 10% 6%, ${alpha(textInk, isDark ? 0.09 : 0.06)}, transparent 32%)`,
      // Top-right cool accent
      `radial-gradient(ellipse at 88% 14%, ${alpha(glowTone, isDark ? 0.14 : 0.085)}, transparent 36%)`,
      // Bottom-right warm accent for depth
      `radial-gradient(ellipse at 92% 92%, ${alpha(warmTone, isDark ? 0.07 : 0.04)}, transparent 30%)`,
      // Dot grid
      `radial-gradient(circle at 1px 1px, ${alpha(textInk, isDark ? (isSchema ? 0.14 : 0.16) : isSchema ? 0.085 : 0.1)} 1.5px, transparent 0)`,
      // Top fade-in
      `linear-gradient(180deg, ${alpha(paper, isDark ? (isSchema ? 0.2 : 0.24) : isSchema ? 0.82 : 0.8)}, transparent ${isSchema ? '52%' : '48%'})`,
    ].join(', '),
    backgroundSize: `100% 100%, 100% 100%, 100% 100%, ${FLOW_GRID_SIZE}px ${FLOW_GRID_SIZE}px, 100% 100%`,
    boxShadow: [
      `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.04 : 0.76)}`,
      `inset 0 0 0 1px ${alpha(textInk, isDark ? 0.05 : 0.06)}`,
      // Deeper bottom vignette
      `inset 0 -56px 96px ${alpha(theme.palette.common.black, isDark ? 0.22 : 0.055)}`,
      // Subtle top vignette
      `inset 0 28px 64px ${alpha(theme.palette.common.black, isDark ? 0.1 : 0.02)}`,
    ].join(', '),
    '& .react-flow': {
      '--xy-edge-stroke-default': alpha(theme.palette.text.secondary, isDark ? 0.44 : 0.4),
      '--xy-edge-stroke-width-default': 1.8,
      '--xy-edge-stroke-selected-default': alpha(textInk, isDark ? 0.82 : 0.7),
      '--xy-connectionline-stroke-default': alpha(textInk, isDark ? 0.52 : 0.44),
      '--xy-connectionline-stroke-width-default': 1.8,
      '--xy-background-pattern-dots-color-default': alpha(textInk, isDark ? 0.12 : 0.085),
      '--xy-background-pattern-line-color-default': alpha(textInk, isDark ? 0.09 : 0.06),
      '--xy-handle-background-color-default': alpha(textInk, isDark ? 0.76 : 0.66),
      '--xy-handle-border-color-default': alpha(paper, isDark ? 0.94 : 0.99),
      '--xy-node-boxshadow-hover-default': `0 28px 60px -36px ${alpha(theme.palette.common.black, isDark ? 0.96 : 0.38)}`,
      '--xy-node-boxshadow-selected-default': `0 0 0 3px ${alpha(textInk, isDark ? 0.15 : 0.1)}`,
      '--xy-selection-background-color-default': alpha(textInk, isDark ? 0.13 : 0.075),
      '--xy-selection-border-default': `1px dotted ${alpha(textInk, isDark ? 0.44 : 0.32)}`,
    },
    '& .react-flow__pane': { cursor: 'grab' },
    '& .react-flow__pane:active': { cursor: 'grabbing' },
    '& .react-flow__viewport': {
      filter: isDark
        ? 'drop-shadow(0 22px 40px rgba(0, 0, 0, 0.28))'
        : 'drop-shadow(0 22px 40px rgba(18, 24, 32, 0.1))',
    },
    '& .react-flow__node': {
      borderRadius: FLOW_NODE_RADIUS,
      outline: 'none',
    },
    '& .react-flow__node.dragging': {
      filter: isDark
        ? 'drop-shadow(0 28px 40px rgba(0, 0, 0, 0.42))'
        : 'drop-shadow(0 28px 40px rgba(18, 24, 32, 0.18))',
    },
    [`& .react-flow__node.selected .${cardClassName}`]: {
      borderColor: alpha(textInk, isDark ? 0.56 : 0.44),
      boxShadow: [
        `0 0 0 3px ${alpha(textInk, isDark ? 0.15 : 0.1)}`,
        `0 28px 60px -36px ${alpha(theme.palette.common.black, isDark ? 0.97 : 0.38)}`,
        `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.065 : 0.88)}`,
      ].join(', '),
    },
    [`& .react-flow__node:focus-visible .${cardClassName}`]: {
      outline: `2px solid ${theme.palette.border.focus}`,
      outlineOffset: 3,
    },
    '& .react-flow__edge-path': {
      strokeLinecap: 'round',
      filter: isDark
        ? 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.26))'
        : 'drop-shadow(0 6px 10px rgba(34, 45, 58, 0.1))',
      transition:
        'stroke 160ms ease, stroke-width 160ms ease, opacity 160ms ease, filter 160ms ease',
    },
    '& .react-flow__edges': {
      zIndex: 0,
    },
    '& .react-flow__nodes': {
      zIndex: 1,
    },
    '& .react-flow__edge.selected .react-flow__edge-path': {
      strokeWidth: 2.8,
      stroke: alpha(textInk, isDark ? 0.82 : 0.7),
    },
    '& .react-flow__edge:hover .react-flow__edge-path': {
      strokeWidth: 2.6,
      stroke: alpha(textInk, isDark ? 0.72 : 0.6),
      filter: isDark
        ? 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.32))'
        : 'drop-shadow(0 8px 12px rgba(34, 45, 58, 0.14))',
    },
    '& .react-flow__edge-textbg': {
      fill: alpha(paper, isDark ? 0.97 : 0.99),
      stroke: alpha(textInk, isDark ? 0.13 : 0.09),
      strokeWidth: 1,
      filter: isDark
        ? 'drop-shadow(0 9px 16px rgba(0, 0, 0, 0.26))'
        : 'drop-shadow(0 9px 16px rgba(31, 41, 55, 0.12))',
    },
    '& .react-flow__edge-text': {
      fill: alpha(textInk, isDark ? 0.78 : 0.72),
      fontFamily: theme.typography.fontFamilyMono,
      fontSize: 10,
      fontWeight: 600,
    },
    '& .react-flow__handle': {
      width: 10,
      height: 10,
      border: `2px solid ${alpha(paper, isDark ? 0.94 : 0.99)}`,
      background: alpha(textInk, isDark ? 0.66 : 0.56),
      boxShadow: [
        `0 0 0 3px ${alpha(textInk, isDark ? 0.09 : 0.05)}`,
        `0 2px 6px ${alpha(theme.palette.common.black, isDark ? 0.28 : 0.12)}`,
      ].join(', '),
    },
  };
};

export const getReactFlowNodeCardSx = (theme, { disabled = false, interactive = false } = {}) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderRadius: FLOW_NODE_RADIUS,
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, isDark ? 0.13 : 0.1),
    backgroundColor: alpha(theme.palette.background.paper, disabled ? 0.6 : isDark ? 0.97 : 0.995),
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    backgroundImage: [
      // Primary top sheen
      `linear-gradient(180deg, ${alpha(theme.palette.common.white, isDark ? 0.065 : 0.84)}, transparent 52%)`,
      // Diagonal micro-texture
      `linear-gradient(135deg, ${alpha(theme.palette.text.primary, isDark ? 0.025 : 0.016)}, transparent 54%)`,
    ].join(', '),
    boxShadow: [
      // Ambient lift
      `0 24px 48px -32px ${alpha(theme.palette.common.black, isDark ? 0.94 : 0.32)}`,
      // Depth layer
      `0 6px 12px -8px ${alpha(theme.palette.common.black, isDark ? 0.56 : 0.14)}`,
      // Inner top highlight
      `inset 0 1.5px 0 ${alpha(theme.palette.common.white, isDark ? 0.065 : 0.82)}`,
      // Inner bottom shadow
      `inset 0 -1px 0 ${alpha(theme.palette.common.black, isDark ? 0.1 : 0.04)}`,
    ].join(', '),
    cursor: interactive ? 'pointer' : 'default',
    transition: [
      'border-color 160ms ease',
      'box-shadow 160ms ease',
      'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      'background-color 160ms ease',
      'opacity 160ms ease',
    ].join(', '),
    '&:hover': interactive
      ? {
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.34 : 0.24),
          backgroundColor: alpha(
            theme.palette.background.paper,
            disabled ? 0.56 : isDark ? 0.99 : 1,
          ),
          boxShadow: [
            `0 28px 56px -36px ${alpha(theme.palette.common.black, isDark ? 0.97 : 0.36)}`,
            `0 8px 16px -10px ${alpha(theme.palette.common.black, isDark ? 0.48 : 0.12)}`,
            `inset 0 1.5px 0 ${alpha(theme.palette.common.white, isDark ? 0.08 : 0.9)}`,
            `inset 0 -1px 0 ${alpha(theme.palette.common.black, isDark ? 0.08 : 0.03)}`,
          ].join(', '),
          transform: disabled ? 'none' : 'translateY(-2px)',
        }
      : undefined,
    '&:active': interactive
      ? {
          transform: 'translateY(0)',
          transition: [
            'border-color 80ms ease',
            'box-shadow 80ms ease',
            'transform 80ms ease',
          ].join(', '),
        }
      : undefined,
  };
};

export const getReactFlowNodeChromeSx = (theme, disabled = false) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    overflow: 'hidden',
    isolation: 'isolate',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      opacity: disabled ? 0.26 : 1,
      background: [
        // Top center luminosity bloom
        `radial-gradient(ellipse 80% 50% at 50% -10%, ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.055)}, transparent 60%)`,
        // Diagonal shimmer
        `linear-gradient(135deg, transparent 0%, ${alpha(theme.palette.info.main, isDark ? 0.055 : 0.026)} 48%, transparent 72%)`,
      ].join(', '),
    },
    // Top edge luminosity line
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 12,
      right: 12,
      zIndex: 0,
      height: 1,
      pointerEvents: 'none',
      background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.text.primary, isDark ? 0.3 : 0.18)}, transparent)`,
      opacity: disabled ? 0.4 : 1,
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  };
};

export const getReactFlowStatusSx = (theme, status) => {
  const isDark = theme.palette.mode === 'dark';
  const tone =
    {
      active: theme.palette.success.main,
      pending: theme.palette.info.main,
      blocked: theme.palette.error.main,
      disabled: theme.palette.text.disabled,
      ready: theme.palette.text.secondary,
    }[status] || theme.palette.text.secondary;

  const isActive = status === 'active';

  return {
    color: tone,
    backgroundColor: alpha(tone, isDark ? 0.18 : 0.09),
    borderColor: alpha(tone, isDark ? 0.38 : 0.25),
    boxShadow: [
      `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.045 : 0.5)}`,
      ...(isActive ? [`0 0 0 2px ${alpha(tone, isDark ? 0.2 : 0.12)}`] : []),
    ].join(', '),
    ...(isActive
      ? {
          '@keyframes statusActivePulse': {
            '0%, 100%': {
              opacity: 1,
              boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.045 : 0.5)}, 0 0 0 2px ${alpha(tone, isDark ? 0.2 : 0.12)}`,
            },
            '50%': {
              opacity: 0.8,
              boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.045 : 0.5)}, 0 0 0 3px ${alpha(tone, isDark ? 0.12 : 0.07)}`,
            },
          },
          animation: 'statusActivePulse 2.4s ease-in-out infinite',
        }
      : {}),
  };
};

export const getReactFlowCustomNodeAccentSx = (theme, customStyle, disabled = false) => {
  const accent = getCustomStyleAccent(customStyle);
  const isDark = theme.palette.mode === 'dark';
  const accentBorder = getAlphaColor(accent, isDark ? 0.52 : 0.38);
  const accentSurface = getAlphaColor(accent, isDark ? 0.08 : 0.045);
  const accentGlow = getAlphaColor(accent, isDark ? 0.22 : 0.14);
  const solidSurface = alpha(theme.palette.background.paper, disabled ? 0.62 : isDark ? 0.98 : 1);

  if (!accentBorder || !accentSurface) return {};

  return {
    borderRadius: FLOW_NODE_RADIUS,
    borderColor: getAlphaColor(accent, isDark ? 0.3 : 0.2) || accentBorder,
    backgroundColor: solidSurface,
    backgroundImage: [
      `linear-gradient(180deg, ${alpha(theme.palette.common.white, isDark ? 0.065 : 0.86)}, transparent 52%)`,
      `linear-gradient(135deg, ${accentSurface}, transparent 62%)`,
      // Left accent stripe — 5px wide for clear brand color
      `linear-gradient(90deg, ${accentBorder} 0 5px, transparent 5px)`,
    ].join(', '),
    boxShadow: accentGlow
      ? [
          `0 24px 48px -32px ${alpha(theme.palette.common.black, isDark ? 0.94 : 0.32)}`,
          `0 6px 12px -8px ${alpha(theme.palette.common.black, isDark ? 0.52 : 0.12)}`,
          // Accent glow ring
          `0 0 0 1px ${accentGlow}`,
          `inset 0 1.5px 0 ${alpha(theme.palette.common.white, isDark ? 0.065 : 0.82)}`,
        ].join(', ')
      : undefined,
    '&:hover': {
      borderColor: getAlphaColor(accent, isDark ? 0.46 : 0.3) || accentBorder,
      boxShadow: [
        `0 28px 56px -36px ${alpha(theme.palette.common.black, isDark ? 0.97 : 0.36)}`,
        `0 8px 16px -10px ${alpha(theme.palette.common.black, isDark ? 0.44 : 0.1)}`,
        `0 0 0 1px ${getAlphaColor(accent, isDark ? 0.28 : 0.18) || accentBorder}`,
        `inset 0 1.5px 0 ${alpha(theme.palette.common.white, isDark ? 0.08 : 0.9)}`,
      ].join(', '),
      transform: disabled ? 'none' : 'translateY(-2px)',
    },
  };
};

export const getReactFlowEdgeStyle = (theme, { isMobile = false, emphasis = 'default' } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const isSubtle = emphasis === 'subtle';

  return {
    stroke: alpha(
      theme.palette.text.secondary,
      isDark ? (isSubtle ? 0.36 : 0.44) : isSubtle ? 0.3 : 0.4,
    ),
    strokeWidth: isMobile ? (isSubtle ? 1.5 : 1.85) : isSubtle ? 1.3 : 1.65,
    ...(isSubtle ? { opacity: 0.8 } : { opacity: 0.9 }),
  };
};

export const getReactFlowDefaultEdgeOptions = (theme, { isMobile = false } = {}) => ({
  style: getReactFlowEdgeStyle(theme, { isMobile }),
  labelStyle: {
    fill: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.78 : 0.72),
    fontFamily: theme.typography.fontFamilyMono,
    fontSize: 10,
    fontWeight: 600,
  },
  labelBgStyle: {
    fill: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.97 : 0.99),
    stroke: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.13 : 0.09),
    strokeWidth: 1,
  },
  labelBgPadding: [9, 5],
  labelBgBorderRadius: 8,
});

export const getReactFlowBackgroundColor = (theme) =>
  alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.09 : 0.07);

// ─── New premium helpers ──────────────────────────────────────────────────────

/**
 * Small status-indicator dot positioned inside a node (absolute).
 * Provides a vivid, colored dot with a soft outer glow ring.
 */
export const getReactFlowNodeStatusDotSx = (theme, status) => {
  const isDark = theme.palette.mode === 'dark';
  const tone =
    {
      active: theme.palette.success.main,
      pending: theme.palette.info.main,
      blocked: theme.palette.error.main,
      disabled: theme.palette.text.disabled,
      ready: theme.palette.text.secondary,
    }[status] || theme.palette.text.secondary;

  const isActive = status === 'active';

  return {
    backgroundColor: tone,
    boxShadow: [
      `0 0 0 2px ${alpha(tone, isDark ? 0.22 : 0.14)}`,
      `0 1px 3px ${alpha(tone, isDark ? 0.44 : 0.3)}`,
    ].join(', '),
    ...(isActive
      ? {
          '@keyframes dotPulse': {
            '0%, 100%': {
              boxShadow: `0 0 0 2px ${alpha(tone, isDark ? 0.22 : 0.14)}, 0 1px 3px ${alpha(tone, isDark ? 0.44 : 0.3)}`,
            },
            '50%': {
              boxShadow: `0 0 0 4px ${alpha(tone, isDark ? 0.1 : 0.07)}, 0 1px 3px ${alpha(tone, isDark ? 0.34 : 0.22)}`,
            },
          },
          animation: 'dotPulse 2.4s ease-in-out infinite',
        }
      : {}),
  };
};

/**
 * Individual tag chip — monospace, subtle tinted background, pill-shaped border.
 * Replaces the plain "/" joined string with visually distinct chips.
 */
export const getReactFlowTagChipSx = (theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    px: 0.75,
    py: 0.25,
    borderRadius: theme.shape.radius?.full ?? '999px',
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.1),
    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.07 : 0.04),
    fontFamily: theme.typography.fontFamilyMono,
    fontSize: 9,
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: 0,
    color: alpha(theme.palette.text.primary, isDark ? 0.5 : 0.44),
    boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.03 : 0.42)}`,
    whiteSpace: 'nowrap',
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
};

/**
 * Count badge — displayed as a compact numeric pill.
 * Uses a more prominent contrast to draw the eye as a metric.
 */
export const getReactFlowCountBadgeSx = (theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: 0.875,
    py: 0.3,
    borderRadius: theme.shape.radius?.full ?? '999px',
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, isDark ? 0.18 : 0.13),
    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.055),
    fontFamily: theme.typography.fontFamilyMono,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0,
    color: alpha(theme.palette.text.primary, isDark ? 0.72 : 0.62),
    boxShadow: [
      `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.04 : 0.52)}`,
      `0 1px 2px ${alpha(theme.palette.common.black, isDark ? 0.18 : 0.07)}`,
    ].join(', '),
    minWidth: 20,
  };
};
