import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

const DB_CARDS = [
  {
    name: 'PostgreSQL',
    logo: '/logo-postgresql.svg',
    color: '#4A90D9',
    glow: 'rgba(74, 144, 217, 0.55)',
    glowSoft: 'rgba(74, 144, 217, 0.18)',
    tag: 'Open Source',
  },
  {
    name: 'MySQL',
    logo: '/logo-mysql.svg',
    color: '#00AECF',
    glow: 'rgba(0, 174, 207, 0.55)',
    glowSoft: 'rgba(0, 174, 207, 0.18)',
    tag: 'Most Popular',
  },
  {
    name: 'SQL Server',
    logo: '/logo-microsoft-sql-server.svg',
    color: '#E84545',
    glow: 'rgba(232, 69, 69, 0.55)',
    glowSoft: 'rgba(232, 69, 69, 0.18)',
    tag: 'Enterprise',
  },
  {
    name: 'Oracle',
    logo: '/logo-oracle.svg',
    color: '#FF6B35',
    glow: 'rgba(255, 107, 53, 0.55)',
    glowSoft: 'rgba(255, 107, 53, 0.18)',
    tag: 'Enterprise',
  },
];

/* ─── Tiny floating particle dot ─────────────────────────────────────────── */
function Particle({ x, y, size, delay, duration, color }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity: 0,
        animation: `particleFloat ${duration}s ease-in-out ${delay}s infinite`,
        pointerEvents: 'none',
        '@keyframes particleFloat': {
          '0%': { opacity: 0, transform: 'translateY(0) scale(0.5)' },
          '20%': { opacity: 1 },
          '80%': { opacity: 0.6 },
          '100%': { opacity: 0, transform: 'translateY(-40px) scale(1.2)' },
        },
      }}
    />
  );
}

/* ─── Orbit ring (decorative SVG circle) ─────────────────────────────────── */
function OrbitRing({ radius, opacity, speed, clockwise, isDark }) {
  const strokeColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const dotColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)';
  const size = radius * 2 + 4;
  const cx = size / 2;
  const cy = size / 2;
  const _circumference = 2 * Math.PI * radius;
  const dir = clockwise ? 'normal' : 'reverse';

  return (
    <Box
      sx={{
        position: 'absolute',
        width: size,
        height: size,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        opacity,
        animation: `orbitSpin ${speed}s linear infinite ${dir}`,
        '@keyframes orbitSpin': {
          from: { transform: 'translate(-50%, -50%) rotateX(72deg) rotateZ(0deg)' },
          to: { transform: 'translate(-50%, -50%) rotateX(72deg) rotateZ(360deg)' },
        },
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* static ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1"
          strokeDasharray="3 8"
        />
        {/* travelling dot */}
        <circle r="2.5" fill={dotColor}>
          <animateMotion
            dur={`${speed}s`}
            repeatCount="indefinite"
            path={`M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 ${clockwise ? 1 : 0} ${cx + radius - 0.001} ${cy}`}
          />
        </circle>
      </svg>
    </Box>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function ProductAuroraShowcase({ isDark: isDarkProp }) {
  const theme = useTheme();
  const isDark = isDarkProp !== undefined ? isDarkProp : theme.palette.mode === 'dark';

  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isMd = useMediaQuery(theme.breakpoints.up('md'));

  const cardWidth = isLg ? 210 : isMd ? 175 : 148;
  const radius = isLg ? 255 : isMd ? 198 : 158;

  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const isHoveredRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);

  const angleStep = 360 / DB_CARDS.length;

  const updateRotation = useCallback((val) => {
    rotationRef.current = val;
    setRotation(val);
  }, []);

  const animateLoop = useCallback(() => {
    if (isDraggingRef.current) {
      rafRef.current = requestAnimationFrame(animateLoop);
      return;
    }
    if (Math.abs(velocityRef.current) > 0.05) {
      velocityRef.current *= 0.94;
      updateRotation(rotationRef.current + velocityRef.current);
      lastInteractionTimeRef.current = performance.now();
    } else {
      velocityRef.current = 0;
      if (isHoveredRef.current) {
        const target = Math.round(rotationRef.current / angleStep) * angleStep;
        const diff = target - rotationRef.current;
        if (Math.abs(diff) > 0.01) updateRotation(rotationRef.current + diff * 0.1);
        else updateRotation(target);
        lastInteractionTimeRef.current = performance.now();
      } else {
        const timeSince = performance.now() - lastInteractionTimeRef.current;
        if (timeSince > 1500) {
          updateRotation(rotationRef.current - 0.12);
        } else {
          const target = Math.round(rotationRef.current / angleStep) * angleStep;
          const diff = target - rotationRef.current;
          if (Math.abs(diff) > 0.01) updateRotation(rotationRef.current + diff * 0.1);
          else updateRotation(target);
        }
      }
    }
    rafRef.current = requestAnimationFrame(animateLoop);
  }, [angleStep, updateRotation]);

  const startDrag = (clientX) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    lastXRef.current = clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    lastInteractionTimeRef.current = performance.now();
  };
  const updateDrag = (clientX) => {
    if (!isDraggingRef.current) return;
    const time = performance.now();
    const dt = time - lastTimeRef.current;
    const dx = clientX - lastXRef.current;
    if (dt > 0) {
      const delta = dx * 0.35;
      updateRotation(rotationRef.current + delta);
      velocityRef.current = (delta / dt) * 16.6;
    }
    lastXRef.current = clientX;
    lastTimeRef.current = time;
    lastInteractionTimeRef.current = time;
  };
  const endDrag = () => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;
    velocityRef.current = Math.max(Math.min(velocityRef.current, 10), -10);
    lastInteractionTimeRef.current = performance.now();
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animateLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateLoop]);

  /* stable pseudo-random particles (seeded by index) */
  const particles = Array.from({ length: 18 }, (_, i) => {
    const seed = i * 137.508; // golden angle
    return {
      x: (seed * 7.3) % 100,
      y: (seed * 13.1) % 100,
      size: 1.5 + (i % 3),
      delay: (i * 0.55) % 6,
      duration: 4 + (i % 4),
      color: DB_CARDS[i % DB_CARDS.length].glow,
    };
  });

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        zIndex: 2,
        background: 'transparent',
      }}
      onMouseDown={(e) => startDrag(e.clientX)}
      onMouseMove={(e) => updateDrag(e.clientX)}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag();
        isHoveredRef.current = false;
      }}
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => updateDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
    >
      {/* ── Ambient floating particles ── */}
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* ── 3D Perspective box ── */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          perspective: '1100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 2,
        }}
      >
        {/* Decorative orbit rings */}
        <OrbitRing radius={radius + 55} opacity={0.9} speed={28} clockwise={true} isDark={isDark} />
        <OrbitRing
          radius={radius + 90}
          opacity={0.55}
          speed={42}
          clockwise={false}
          isDark={isDark}
        />

        {/* ── Rotator Ring ── */}
        <Box
          sx={{
            position: 'relative',
            width: cardWidth,
            height: cardWidth,
            transformStyle: 'preserve-3d',
            transform: `rotateX(-10deg) rotateY(${rotation}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {DB_CARDS.map((card, i) => {
            const cardAngle = i * angleStep;
            const relativeAngle = ((((cardAngle + rotation) % 360) + 540) % 360) - 180;
            const rad = (relativeAngle * Math.PI) / 180;
            const cosVal = Math.cos(rad);

            const scale = 0.78 + 0.27 * cosVal;
            const opacity = 0.12 + 0.88 * ((cosVal + 1) / 2);
            const zIndex = Math.round(200 * cosVal);
            const blurAmount =
              Math.abs(relativeAngle) > 55
                ? Math.min((Math.abs(relativeAngle) - 55) * 0.065, 5)
                : 0;
            const isFront = Math.abs(relativeAngle) < 40;

            /* ── Brand-tinted card backgrounds ── */
            const cardBg = isDark
              ? isFront
                ? `linear-gradient(145deg, rgba(255,255,255,0.06) 0%, ${card.glowSoft} 100%)`
                : 'rgba(255,255,255,0.015)'
              : isFront
                ? `linear-gradient(145deg, rgba(255,255,255,0.82) 0%, ${card.glowSoft} 100%)`
                : 'rgba(255,255,255,0.45)';

            const cardBorder = isFront ? `1.5px solid` : '1px solid';

            const cardBorderColor = isDark
              ? isFront
                ? `${card.color}55`
                : 'rgba(255,255,255,0.04)'
              : isFront
                ? `${card.color}44`
                : 'rgba(0,0,0,0.05)';

            const cardShadow = isFront
              ? isDark
                ? `0 24px 60px -8px rgba(0,0,0,0.65),
                   0 0 40px -8px ${card.glow},
                   0 0 0 1px ${card.color}22,
                   inset 0 1px 0 rgba(255,255,255,0.12)`
                : `0 20px 50px -8px rgba(0,0,0,0.12),
                   0 0 32px -8px ${card.glow},
                   inset 0 1px 0 rgba(255,255,255,0.9)`
              : 'none';

            return (
              <Box
                key={card.name}
                sx={{
                  position: 'absolute',
                  width: cardWidth,
                  height: cardWidth,
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${cardAngle}deg) translateZ(${radius}px) scale(${scale})`,
                  backfaceVisibility: 'visible',
                  zIndex,
                  opacity,
                  filter: `blur(${blurAmount}px)`,

                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  borderRadius: '26px',
                  p: 3,

                  background: cardBg,
                  border: cardBorder,
                  borderColor: cardBorderColor,
                  boxShadow: cardShadow,
                  backdropFilter: isDark ? 'blur(20px)' : 'blur(10px)',

                  transition:
                    'border-color 0.4s, box-shadow 0.45s, opacity 0.4s, filter 0.4s, background 0.4s',
                  overflow: 'hidden',
                }}
              >
                {/* ── Colored top-edge shine bar ── */}
                {isFront && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: '12%',
                      right: '12%',
                      height: '2px',
                      borderRadius: '0 0 4px 4px',
                      background: `linear-gradient(90deg, transparent, ${card.color}cc, transparent)`,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* ── Sheen sweep ── */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: isDark
                      ? 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)'
                      : 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
                    transform: 'scale(2)',
                    pointerEvents: 'none',
                    opacity: isFront ? 1 : 0.3,
                    animation: 'sheenSweep 7s infinite ease-in-out',
                    animationDelay: `${i * 1.75}s`,
                    '@keyframes sheenSweep': {
                      '0%': { transform: 'translateX(-160%) translateY(-160%) rotate(45deg)' },
                      '100%': { transform: 'translateX(160%) translateY(160%) rotate(45deg)' },
                    },
                  }}
                />

                {/* ── Brand glow orb behind logo ── */}
                {isFront && (
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '70%',
                      height: '70%',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${card.glowSoft} 0%, transparent 70%)`,
                      pointerEvents: 'none',
                      animation: 'glowPulse 3s ease-in-out infinite',
                      animationDelay: `${i * 0.6}s`,
                      '@keyframes glowPulse': {
                        '0%, 100%': { opacity: 0.7, transform: 'scale(1)' },
                        '50%': { opacity: 1, transform: 'scale(1.15)' },
                      },
                    }}
                  />
                )}

                {/* ── DB Logo ── */}
                <Box
                  component="img"
                  src={card.logo}
                  alt={card.name}
                  draggable={false}
                  sx={{
                    width: '68%',
                    height: '68%',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'transform 0.4s ease, filter 0.4s ease',
                    filter: isFront
                      ? isDark
                        ? `drop-shadow(0 0 10px ${card.glow})`
                        : `drop-shadow(0 4px 12px ${card.glow})`
                      : isDark
                        ? 'grayscale(70%) brightness(0.55) opacity(0.45)'
                        : 'grayscale(65%) opacity(0.45)',
                    '&:hover': { transform: 'scale(1.06)' },
                  }}
                />

                {/* ── DB Name label ── */}
                <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', mt: '2px' }}>
                  <Typography
                    sx={{
                      fontSize: cardWidth * 0.085,
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                      lineHeight: 1,
                      color: isFront
                        ? isDark
                          ? 'rgba(255,255,255,0.92)'
                          : 'rgba(0,0,0,0.82)'
                        : isDark
                          ? 'rgba(255,255,255,0.28)'
                          : 'rgba(0,0,0,0.28)',
                      transition: 'color 0.4s',
                      fontFamily: "'Inter', 'Roboto', sans-serif",
                    }}
                  >
                    {card.name}
                  </Typography>
                  {isFront && (
                    <Typography
                      sx={{
                        fontSize: cardWidth * 0.056,
                        fontWeight: 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: card.color,
                        opacity: 0.85,
                        mt: '3px',
                        fontFamily: "'Inter', 'Roboto', sans-serif",
                      }}
                    >
                      {card.tag}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
