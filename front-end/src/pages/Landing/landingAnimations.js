import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';

// ─── Aurora atmospheric backdrops ─────────────────────────────────────────────

export function getAuroraStyles(position) {
  const base = {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
    animation: 'auroraDrift 120s ease-in-out infinite',
    [REDUCED_MOTION_QUERY]: {
      animation: 'none',
    },
    '@keyframes auroraDrift': {
      '0%': { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      '33%': { transform: 'translate(-3%, 4%) scale(1.05) rotate(5deg)' },
      '66%': { transform: 'translate(4%, -2%) scale(0.95) rotate(-3deg)' },
      '100%': { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
    },
  };

  if (position === 'hero-primary') {
    return {
      ...base,
      top: '-20%',
      left: '-10%',
      width: '60vw',
      height: '60vw',
      background: 'radial-gradient(circle, rgba(124, 58, 237, 0.04) 0%, rgba(10, 10, 10, 0) 70%)',
      filter: 'blur(120px)',
    };
  }

  if (position === 'hero-secondary') {
    return {
      ...base,
      bottom: '-10%',
      right: '-20%',
      width: '70vw',
      height: '70vw',
      background: 'radial-gradient(circle, rgba(160, 195, 236, 0.05) 0%, rgba(10, 10, 10, 0) 70%)',
      filter: 'blur(150px)',
    };
  }

  if (position === 'cta') {
    return {
      ...base,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '80vw',
      height: '40vw',
      background:
        'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.04) 0%, rgba(160, 195, 236, 0.03) 40%, rgba(10, 10, 10, 0) 70%)',
      filter: 'blur(100px)',
    };
  }

  return base;
}

// ─── Scroll-triggered reveal ──────────────────────────────────────────────────

export function getScrollRevealSx(isRevealed, delay = 0) {
  return {
    opacity: isRevealed ? 1 : 0,
    transform: isRevealed ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
    [REDUCED_MOTION_QUERY]: {
      opacity: 1,
      transform: 'none',
      transition: 'none',
    },
  };
}

// ─── Active stage pulse ring ──────────────────────────────────────────────────

export function getStagePulseSx(isActive) {
  if (!isActive) return {};

  return {
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 'inherit',
      border: '1px solid',
      borderColor: 'text.primary',
      opacity: 0.4,
      animation: 'pulseRing 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
      '@keyframes pulseRing': {
        '0%': { transform: 'scale(1)', opacity: 0.6 },
        '100%': { transform: 'scale(1.8)', opacity: 0 },
      },
      [REDUCED_MOTION_QUERY]: {
        animation: 'none',
        display: 'none',
      },
    },
  };
}

// ─── Animated SVG flow path ───────────────────────────────────────────────────

export function getFlowPathSx() {
  return {
    strokeDasharray: '4 6',
    animation: 'flowDash 3s linear infinite',
    '@keyframes flowDash': {
      from: { strokeDashoffset: 0 },
      to: { strokeDashoffset: -20 },
    },
    [REDUCED_MOTION_QUERY]: {
      animation: 'none',
    },
  };
}

// ─── Ambient glow on active surfaces ──────────────────────────────────────────

export function getAmbientGlowSx(isActive, color = '#a0c3ec') {
  return {
    boxShadow: isActive ? `0 0 40px ${color}0F, 0 0 80px ${color}08` : 'none',
    transition: 'box-shadow 0.5s ease',
    [REDUCED_MOTION_QUERY]: {
      transition: 'none',
    },
  };
}

// ─── Glassmorphic navigation ──────────────────────────────────────────────────

export function getGlassNavSx(scrolled) {
  return {
    backgroundColor: scrolled ? 'rgba(10, 10, 10, 0.82)' : 'background.default',
    backdropFilter: scrolled ? 'blur(12px)' : 'none',
    WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
    borderBottomColor: scrolled ? 'border.subtle' : 'transparent',
    transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease',
    [REDUCED_MOTION_QUERY]: {
      transition: 'none',
      backgroundColor: 'background.default',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
}

// ─── Stagger delay utility ────────────────────────────────────────────────────

export function getStaggerDelay(index, baseDelay = 0.06) {
  return index * baseDelay;
}

// ─── Section divider gradient ─────────────────────────────────────────────────

export function getSectionDividerSx() {
  return {
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '10%',
      right: '10%',
      height: '1px',
      background:
        'linear-gradient(90deg, transparent 0%, rgba(160, 195, 236, 0.08) 50%, transparent 100%)',
      pointerEvents: 'none',
    },
  };
}
