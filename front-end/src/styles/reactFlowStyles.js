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

const FLOW_GRID_SIZE = 22;

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

export const getReactFlowCanvasSx = (theme, { cardClassName = FLOW_NODE_CARD_CLASS, tone = 'diagram' } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const isSchema = tone === 'schema';
  const textInk = theme.palette.text.primary;
  const paper = theme.palette.background.paper;
  const base = theme.palette.background.default;
  const glowTone = isSchema ? theme.palette.success.main : theme.palette.info.main;

  return {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: alpha(base, isDark ? (isSchema ? 0.76 : 0.78) : (isSchema ? 0.68 : 0.7)),
    backgroundImage: [
      `radial-gradient(circle at 12% 8%, ${alpha(textInk, isDark ? 0.08 : 0.055)}, transparent 30%)`,
      `radial-gradient(circle at 86% 18%, ${alpha(glowTone, isDark ? 0.12 : 0.075)}, transparent 34%)`,
      `radial-gradient(circle at 1px 1px, ${alpha(textInk, isDark ? (isSchema ? 0.12 : 0.14) : (isSchema ? 0.075 : 0.09))} 1px, transparent 0)`,
      `linear-gradient(180deg, ${alpha(paper, isDark ? (isSchema ? 0.18 : 0.22) : (isSchema ? 0.78 : 0.76))}, transparent ${isSchema ? '50%' : '46%'})`,
    ].join(', '),
    backgroundSize: `100% 100%, 100% 100%, ${FLOW_GRID_SIZE}px ${FLOW_GRID_SIZE}px, 100% 100%`,
    boxShadow: [
      `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.035 : 0.72)}`,
      `inset 0 0 0 1px ${alpha(textInk, isDark ? 0.045 : 0.055)}`,
      `inset 0 -42px 86px ${alpha(theme.palette.common.black, isDark ? 0.18 : 0.045)}`,
    ].join(', '),
    '& .react-flow': {
      '--xy-edge-stroke-default': alpha(theme.palette.text.secondary, isDark ? 0.4 : 0.36),
      '--xy-edge-stroke-width-default': 1.7,
      '--xy-edge-stroke-selected-default': alpha(textInk, isDark ? 0.78 : 0.66),
      '--xy-connectionline-stroke-default': alpha(textInk, isDark ? 0.5 : 0.42),
      '--xy-connectionline-stroke-width-default': 1.7,
      '--xy-background-pattern-dots-color-default': alpha(textInk, isDark ? 0.1 : 0.075),
      '--xy-background-pattern-line-color-default': alpha(textInk, isDark ? 0.08 : 0.055),
      '--xy-handle-background-color-default': alpha(textInk, isDark ? 0.72 : 0.62),
      '--xy-handle-border-color-default': alpha(paper, isDark ? 0.92 : 0.98),
      '--xy-node-boxshadow-hover-default': `0 22px 54px -34px ${alpha(theme.palette.common.black, isDark ? 0.94 : 0.34)}`,
      '--xy-node-boxshadow-selected-default': `0 0 0 3px ${alpha(textInk, isDark ? 0.13 : 0.085)}`,
      '--xy-selection-background-color-default': alpha(textInk, isDark ? 0.12 : 0.07),
      '--xy-selection-border-default': `1px dotted ${alpha(textInk, isDark ? 0.42 : 0.3)}`,
    },
    '& .react-flow__pane': { cursor: 'grab' },
    '& .react-flow__pane:active': { cursor: 'grabbing' },
    '& .react-flow__viewport': {
      filter: isDark
        ? 'drop-shadow(0 18px 34px rgba(0, 0, 0, 0.22))'
        : 'drop-shadow(0 18px 34px rgba(18, 24, 32, 0.08))',
    },
    '& .react-flow__node': {
      borderRadius: theme.shape.radius.md,
      outline: 'none',
    },
    '& .react-flow__node.dragging': {
      filter: isDark
        ? 'drop-shadow(0 24px 34px rgba(0, 0, 0, 0.34))'
        : 'drop-shadow(0 24px 34px rgba(18, 24, 32, 0.14))',
    },
    [`& .react-flow__node.selected .${cardClassName}`]: {
      borderColor: alpha(textInk, isDark ? 0.52 : 0.4),
      boxShadow: [
        `0 0 0 3px ${alpha(textInk, isDark ? 0.13 : 0.085)}`,
        `0 22px 54px -34px ${alpha(theme.palette.common.black, isDark ? 0.95 : 0.34)}`,
        `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.055 : 0.82)}`,
      ].join(', '),
    },
    [`& .react-flow__node:focus-visible .${cardClassName}`]: {
      outline: `2px solid ${theme.palette.border.focus}`,
      outlineOffset: 3,
    },
    '& .react-flow__edge-path': {
      strokeLinecap: 'round',
      filter: isDark
        ? 'drop-shadow(0 5px 8px rgba(0, 0, 0, 0.22))'
        : 'drop-shadow(0 5px 8px rgba(34, 45, 58, 0.08))',
      transition: 'stroke 160ms ease, stroke-width 160ms ease, opacity 160ms ease, filter 160ms ease',
    },
    '& .react-flow__edges': {
      zIndex: 0,
    },
    '& .react-flow__nodes': {
      zIndex: 1,
    },
    '& .react-flow__edge.selected .react-flow__edge-path': {
      strokeWidth: 2.6,
      stroke: alpha(textInk, isDark ? 0.78 : 0.66),
    },
    '& .react-flow__edge:hover .react-flow__edge-path': {
      strokeWidth: 2.4,
      stroke: alpha(textInk, isDark ? 0.68 : 0.56),
      filter: isDark
        ? 'drop-shadow(0 7px 10px rgba(0, 0, 0, 0.28))'
        : 'drop-shadow(0 7px 10px rgba(34, 45, 58, 0.12))',
    },
    '& .react-flow__edge-textbg': {
      fill: alpha(paper, isDark ? 0.96 : 0.985),
      stroke: alpha(textInk, isDark ? 0.12 : 0.085),
      strokeWidth: 1,
      filter: isDark
        ? 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.22))'
        : 'drop-shadow(0 8px 14px rgba(31, 41, 55, 0.1))',
    },
    '& .react-flow__edge-text': {
      fill: alpha(textInk, isDark ? 0.74 : 0.68),
      fontFamily: theme.typography.fontFamilyMono,
      fontSize: 10,
      fontWeight: 600,
    },
    '& .react-flow__handle': {
      width: 10,
      height: 10,
      border: `2px solid ${alpha(paper, isDark ? 0.92 : 0.98)}`,
      background: alpha(textInk, isDark ? 0.62 : 0.52),
      boxShadow: `0 0 0 3px ${alpha(textInk, isDark ? 0.08 : 0.045)}`,
    },
  };
};

export const getReactFlowNodeCardSx = (theme, { disabled = false, interactive = false } = {}) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderRadius: theme.shape.radius.md,
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.105),
    backgroundColor: alpha(theme.palette.background.paper, disabled ? 0.58 : (isDark ? 0.965 : 0.985)),
    backgroundImage: [
      `linear-gradient(180deg, ${alpha(theme.palette.common.white, isDark ? 0.055 : 0.86)}, transparent 58%)`,
      `linear-gradient(135deg, ${alpha(theme.palette.text.primary, isDark ? 0.035 : 0.024)}, transparent 52%)`,
      `radial-gradient(circle at 50% 0%, ${alpha(theme.palette.common.white, isDark ? 0.045 : 0.72)}, transparent 54%)`,
    ].join(', '),
    boxShadow: [
      `0 18px 42px -32px ${alpha(theme.palette.common.black, isDark ? 0.94 : 0.34)}`,
      `0 8px 18px -18px ${alpha(theme.palette.common.black, isDark ? 0.82 : 0.18)}`,
      `0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.035 : 0.54)}`,
      `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.06 : 0.78)}`,
      `inset 0 -1px 0 ${alpha(theme.palette.text.primary, isDark ? 0.045 : 0.035)}`,
    ].join(', '),
    cursor: interactive ? 'pointer' : 'default',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background-color 160ms ease, opacity 160ms ease',
    '&:hover': interactive ? {
      borderColor: alpha(theme.palette.text.primary, isDark ? 0.32 : 0.23),
      backgroundColor: alpha(theme.palette.background.paper, disabled ? 0.58 : (isDark ? 0.99 : 1)),
      boxShadow: [
        `0 26px 58px -34px ${alpha(theme.palette.common.black, isDark ? 0.98 : 0.42)}`,
        `0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.035 : 0.03)}`,
        `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.075 : 0.9)}`,
      ].join(', '),
      transform: disabled ? 'none' : 'translateY(-1px)',
    } : undefined,
    '&:active': interactive ? {
      transform: 'translateY(0)',
    } : undefined,
  };
};

export const getReactFlowNodeChromeSx = (theme, disabled = false) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    overflow: 'hidden',
    isolation: 'isolate',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      opacity: disabled ? 0.28 : 1,
      background: [
        `radial-gradient(circle at 50% 0%, ${alpha(theme.palette.text.primary, isDark ? 0.13 : 0.075)}, transparent 42%)`,
        `linear-gradient(135deg, transparent 0%, ${alpha(theme.palette.info.main, isDark ? 0.09 : 0.04)} 45%, transparent 75%)`,
      ].join(', '),
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 14,
      right: 14,
      zIndex: 0,
      height: 1,
      pointerEvents: 'none',
      background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.text.primary, isDark ? 0.26 : 0.16)}, transparent)`,
    },
    '& > *': {
      position: 'relative',
      zIndex: 1,
    },
  };
};

export const getReactFlowStatusSx = (theme, status) => {
  const isDark = theme.palette.mode === 'dark';
  const tone = {
    active: theme.palette.success.main,
    pending: theme.palette.info.main,
    blocked: theme.palette.error.main,
    disabled: theme.palette.text.disabled,
    ready: theme.palette.text.secondary,
  }[status] || theme.palette.text.secondary;

  return {
    color: tone,
    backgroundColor: alpha(tone, isDark ? 0.16 : 0.085),
    borderColor: alpha(tone, isDark ? 0.34 : 0.22),
    boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.04 : 0.48)}`,
  };
};

export const getReactFlowCustomNodeAccentSx = (theme, customStyle, disabled = false) => {
  const accent = getCustomStyleAccent(customStyle);
  const isDark = theme.palette.mode === 'dark';
  const accentBorder = getAlphaColor(accent, isDark ? 0.48 : 0.32);
  const accentSurface = getAlphaColor(accent, isDark ? 0.16 : 0.075);
  const accentGlow = getAlphaColor(accent, isDark ? 0.3 : 0.18);
  const solidSurface = alpha(theme.palette.background.paper, disabled ? 0.72 : (isDark ? 0.985 : 0.995));

  if (!accentBorder || !accentSurface) return {};

  return {
    borderColor: accentBorder,
    backgroundColor: solidSurface,
    backgroundImage: [
      `linear-gradient(180deg, ${alpha(theme.palette.common.white, isDark ? 0.06 : 0.92)}, transparent 58%)`,
      `linear-gradient(135deg, ${accentSurface}, transparent 58%)`,
      `linear-gradient(90deg, ${accentBorder} 0 3px, transparent 3px)`,
    ].join(', '),
    boxShadow: accentGlow
      ? [
        `0 18px 44px -30px ${alpha(theme.palette.common.black, isDark ? 0.94 : 0.34)}`,
        `0 0 0 1px ${accentGlow}`,
        `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.055 : 0.78)}`,
      ].join(', ')
      : undefined,
    '&:hover': {
      borderColor: getAlphaColor(accent, isDark ? 0.62 : 0.44) || accentBorder,
      boxShadow: [
        `0 24px 56px -32px ${alpha(theme.palette.common.black, isDark ? 0.98 : 0.4)}`,
        `0 0 0 1px ${getAlphaColor(accent, isDark ? 0.38 : 0.24) || accentBorder}`,
        `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.07 : 0.86)}`,
      ].join(', '),
      transform: disabled ? 'none' : 'translateY(-1px)',
    },
  };
};

export const getReactFlowEdgeStyle = (theme, { isMobile = false, emphasis = 'default' } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const isSubtle = emphasis === 'subtle';

  return {
    stroke: alpha(theme.palette.text.secondary, isDark ? (isSubtle ? 0.32 : 0.4) : (isSubtle ? 0.28 : 0.36)),
    strokeWidth: isMobile ? (isSubtle ? 1.45 : 1.75) : (isSubtle ? 1.2 : 1.55),
    ...(isSubtle ? { opacity: 0.78 } : { opacity: 0.86 }),
  };
};

export const getReactFlowDefaultEdgeOptions = (theme, { isMobile = false } = {}) => ({
  style: getReactFlowEdgeStyle(theme, { isMobile }),
  labelStyle: {
    fill: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.74 : 0.68),
    fontFamily: theme.typography.fontFamilyMono,
    fontSize: 10,
    fontWeight: 600,
  },
  labelBgStyle: {
    fill: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.96 : 0.985),
    stroke: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.08),
    strokeWidth: 1,
  },
  labelBgPadding: [8, 4],
  labelBgBorderRadius: 7,
});

export const getReactFlowBackgroundColor = (theme) => (
  alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.085 : 0.065)
);
