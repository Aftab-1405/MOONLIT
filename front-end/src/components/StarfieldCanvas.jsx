import { useEffect, useRef, memo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Ultra-realistic starfield with astronomical accuracy.
 * Features: Spectral star classes, parallax depth layers, realistic twinkle physics.
 * Optimized: Batched rendering, pre-computed values, visibility API pause.
 */
function StarfieldCanvas({ active = false }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const starsRef = useRef([]);
  const dustRef = useRef([]);
  const nebulasRef = useRef([]);
  const meteorsRef = useRef([]);
  const cometsRef = useRef([]);
  const sparksRef = useRef([]);
  const opacityRef = useRef(0);
  const targetOpacityRef = useRef(0);
  const lastMeteorTimeRef = useRef(0);
  const lastCometTimeRef = useRef(0);
  const nextMeteorDelayRef = useRef(3000 + Math.random() * 5000);
  const nextCometDelayRef = useRef(15000 + Math.random() * 20000);
  const isVisibleRef = useRef(true);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!isDarkMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Realistic stellar spectral classes (temperature-based colors)
    // O, B, A, F, G, K, M classes
    const spectralClasses = [
      { r: 155, g: 176, b: 255, temp: 'O', rarity: 0.01 },  // Blue-white (hottest, rarest)
      { r: 170, g: 191, b: 255, temp: 'B', rarity: 0.03 },  // Blue-white
      { r: 202, g: 215, b: 255, temp: 'A', rarity: 0.08 },  // White
      { r: 248, g: 247, b: 255, temp: 'F', rarity: 0.15 },  // Yellow-white
      { r: 255, g: 244, b: 232, temp: 'G', rarity: 0.25 },  // Yellow (Sun-like)
      { r: 255, g: 210, b: 161, temp: 'K', rarity: 0.25 },  // Orange
      { r: 255, g: 204, b: 111, temp: 'K', rarity: 0.15 },  // Deep orange
      { r: 255, g: 189, b: 111, temp: 'M', rarity: 0.08 },  // Red (coolest)
    ];

    // Select star color based on realistic distribution
    const getStarColor = () => {
      const rand = Math.random();
      let cumulative = 0;
      for (const sc of spectralClasses) {
        cumulative += sc.rarity;
        if (rand < cumulative) return sc;
      }
      return spectralClasses[4]; // Default to G-class
    };

    // Initialize stars with depth layers for parallax
    const initStars = (w, h) => {
      const stars = [];
      const area = w * h;
      
      // Layer 1: Distant dim stars (most numerous, slowest)
      const distantCount = Math.floor(area / 8000);
      for (let i = 0; i < distantCount; i++) {
        const color = getStarColor();
        const size = 0.3 + Math.random() * 0.5;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size,
          layer: 0,
          baseOpacity: 0.15 + Math.random() * 0.2,
          color,
          colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,
          vx: (Math.random() - 0.5) * 0.02,
          vy: (Math.random() - 0.5) * 0.02,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.004 + Math.random() * 0.008,
          twinkleIntensity: 0.1 + Math.random() * 0.15,
        });
      }
      
      // Layer 2: Mid-distance stars
      const midCount = Math.floor(area / 25000);
      for (let i = 0; i < midCount; i++) {
        const color = getStarColor();
        const size = 0.5 + Math.random() * 0.8;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size,
          layer: 1,
          baseOpacity: 0.3 + Math.random() * 0.3,
          color,
          colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.04,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.008 + Math.random() * 0.012,
          twinkleIntensity: 0.15 + Math.random() * 0.2,
        });
      }
      
      // Layer 3: Nearby bright stars (few, faster parallax)
      const nearCount = Math.floor(area / 80000);
      for (let i = 0; i < nearCount; i++) {
        const color = getStarColor();
        const size = 1.0 + Math.random() * 1.2;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size,
          layer: 2,
          baseOpacity: 0.6 + Math.random() * 0.4,
          color,
          colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.015 + Math.random() * 0.02,
          twinkleIntensity: 0.2 + Math.random() * 0.25,
          // Bright stars get diffraction spikes
          hasSpikes: size > 1.5,
        });
      }
      
      // Star clusters (realistic groupings)
      const clusterCount = 2 + Math.floor(Math.random() * 2);
      for (let c = 0; c < clusterCount; c++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const clusterStars = 12 + Math.floor(Math.random() * 15);
        for (let i = 0; i < clusterStars; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.pow(Math.random(), 0.5) * 100; // Concentrated center
          const color = getStarColor();
          const size = 0.3 + Math.random() * 0.6;
          stars.push({
            x: Math.max(0, Math.min(w, cx + Math.cos(angle) * dist)),
            y: Math.max(0, Math.min(h, cy + Math.sin(angle) * dist)),
            size,
            layer: 1,
            baseOpacity: 0.25 + Math.random() * 0.35,
            color,
            colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,
            vx: (Math.random() - 0.5) * 0.03,
            vy: (Math.random() - 0.5) * 0.03,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.006 + Math.random() * 0.01,
            twinkleIntensity: 0.12 + Math.random() * 0.18,
          });
        }
      }
      
      return stars;
    };

    // Cosmic dust particles (very subtle, adds depth)
    const initDust = (w, h) => {
      const dust = [];
      const count = Math.floor((w * h) / 50000);
      for (let i = 0; i < count; i++) {
        dust.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 15 + Math.random() * 40,
          opacity: 0.008 + Math.random() * 0.015,
          vx: (Math.random() - 0.5) * 0.03,
          vy: (Math.random() - 0.5) * 0.03,
        });
      }
      return dust;
    };

    // Enhanced nebulas with more natural shapes
    const nebulaColors = [
      { r: 80, g: 60, b: 140 },   // Deep purple
      { r: 50, g: 80, b: 120 },   // Navy blue
      { r: 100, g: 50, b: 100 },  // Magenta
      { r: 40, g: 100, b: 120 },  // Teal
      { r: 120, g: 60, b: 80 },   // Dusty rose
    ];

    const initNebulas = (w, h) => {
      const nebulas = [];
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
        nebulas.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 250 + Math.random() * 350,
          color,
          baseOpacity: 0.025 + Math.random() * 0.025,
          vx: (Math.random() - 0.5) * 0.05,
          vy: (Math.random() - 0.5) * 0.05,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.002 + Math.random() * 0.002,
        });
      }
      return nebulas;
    };

    const meteorColors = [
      { r: 255, g: 255, b: 255 },
      { r: 200, g: 230, b: 255 },
      { r: 255, g: 220, b: 180 },
    ];

    const createMeteor = (w, h) => {
      const speedVal = 8 + Math.random() * 8;
      // More realistic: meteors enter from top/upper edges
      const startX = Math.random() * w * 1.2 - w * 0.1;
      const startY = -20;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5; // ~45 degrees down
      const color = meteorColors[Math.floor(Math.random() * meteorColors.length)];

      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speedVal * 0.3,
        vy: Math.sin(angle) * speedVal,
        speed: speedVal,
        length: 80 + Math.random() * 120,
        opacity: 0.9,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.008,
        color,
        sparkTimer: 0,
        trail: [], // Store trail positions for more realistic look
      };
    };

    const cometColors = [
      { r: 150, g: 220, b: 255 },
      { r: 255, g: 240, b: 200 },
    ];

    const createComet = (w, h) => {
      const speedVal = 1.5 + Math.random() * 1.5;
      const fromLeft = Math.random() > 0.5;
      const startX = fromLeft ? -80 : w + 80;
      const startY = Math.random() * h * 0.4;
      const targetX = fromLeft ? w + 100 : -100;
      const targetY = h * 0.4 + Math.random() * h * 0.4;
      const dirAngle = Math.atan2(targetY - startY, targetX - startX);
      const color = cometColors[Math.floor(Math.random() * cometColors.length)];

      return {
        x: startX,
        y: startY,
        vx: Math.cos(dirAngle) * speedVal,
        vy: Math.sin(dirAngle) * speedVal,
        speed: speedVal,
        length: 250 + Math.random() * 200,
        opacity: 0.85,
        life: 1.0,
        decay: 0.002 + Math.random() * 0.001,
        color,
        coreSize: 5 + Math.random() * 3,
        sparkTimer: 0,
      };
    };

    const createSpark = (x, y, baseVx, baseVy, color) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.2;
      return {
        x, y,
        vx: baseVx * 0.2 + Math.cos(angle) * speed,
        vy: baseVy * 0.2 + Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04,
        size: 0.4 + Math.random() * 0.8,
        color,
      };
    };

    if (starsRef.current.length === 0) starsRef.current = initStars(width, height);
    if (dustRef.current.length === 0) dustRef.current = initDust(width, height);
    if (nebulasRef.current.length === 0) nebulasRef.current = initNebulas(width, height);

    const animate = (timestamp) => {
      if (!isVisibleRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const opacityDiff = targetOpacityRef.current - opacityRef.current;
      if (Math.abs(opacityDiff) > 0.005) {
        opacityRef.current += opacityDiff * 0.025;
      } else {
        opacityRef.current = targetOpacityRef.current;
      }

      if (opacityRef.current < 0.01) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      timeRef.current = timestamp * 0.001;
      ctx.clearRect(0, 0, width, height);
      const globalOpacity = opacityRef.current;

      // === Cosmic dust (very subtle background texture) ===
      ctx.globalAlpha = globalOpacity;
      for (const d of dustRef.current) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -d.size) d.x = width + d.size;
        if (d.x > width + d.size) d.x = -d.size;
        if (d.y < -d.size) d.y = height + d.size;
        if (d.y > height + d.size) d.y = -d.size;
        
        ctx.globalAlpha = d.opacity * globalOpacity;
        ctx.fillStyle = 'rgb(180, 180, 200)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // === Nebulas ===
      for (const nebula of nebulasRef.current) {
        nebula.x += nebula.vx;
        nebula.y += nebula.vy;
        if (nebula.x < -nebula.radius) nebula.x = width + nebula.radius;
        if (nebula.x > width + nebula.radius) nebula.x = -nebula.radius;
        if (nebula.y < -nebula.radius) nebula.y = height + nebula.radius;
        if (nebula.y > height + nebula.radius) nebula.y = -nebula.radius;

        nebula.pulsePhase += nebula.pulseSpeed;
        const pulse = 0.9 + 0.1 * Math.sin(nebula.pulsePhase);
        const opacity = nebula.baseOpacity * pulse * globalOpacity;
        const { r, g, b } = nebula.color;

        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.radius
        );
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${opacity * 0.7})`);
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // === Stars (batched by layer for efficiency) ===
      for (const star of starsRef.current) {
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < -5) star.x = width + 5;
        if (star.x > width + 5) star.x = -5;
        if (star.y < -5) star.y = height + 5;
        if (star.y > height + 5) star.y = -5;

        star.twinklePhase += star.twinkleSpeed;
        // Realistic atmospheric scintillation
        const scintillation = 1 - star.twinkleIntensity + 
          star.twinkleIntensity * (0.5 + 0.5 * Math.sin(star.twinklePhase) * Math.sin(star.twinklePhase * 1.7 + 0.5));
        const opacity = star.baseOpacity * scintillation * globalOpacity;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = star.colorStr;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow for brighter stars
        if (star.layer >= 1) {
          ctx.globalAlpha = opacity * 0.25;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Diffraction spikes for brightest stars
        if (star.hasSpikes && opacity > 0.5) {
          ctx.globalAlpha = opacity * 0.4;
          ctx.strokeStyle = star.colorStr;
          ctx.lineWidth = 0.5;
          const spikeLen = star.size * 4;
          ctx.beginPath();
          ctx.moveTo(star.x - spikeLen, star.y);
          ctx.lineTo(star.x + spikeLen, star.y);
          ctx.moveTo(star.x, star.y - spikeLen);
          ctx.lineTo(star.x, star.y + spikeLen);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // === Spawn Meteors ===
      const timeSinceLastMeteor = timestamp - lastMeteorTimeRef.current;
      if (globalOpacity > 0.5 && timeSinceLastMeteor > nextMeteorDelayRef.current) {
        if (meteorsRef.current.length < 2) {
          meteorsRef.current.push(createMeteor(width, height));
          lastMeteorTimeRef.current = timestamp;
          nextMeteorDelayRef.current = 4000 + Math.random() * 8000;
        }
      }

      // === Spawn Comets ===
      const timeSinceLastComet = timestamp - lastCometTimeRef.current;
      if (globalOpacity > 0.5 && timeSinceLastComet > nextCometDelayRef.current) {
        if (cometsRef.current.length < 1) {
          cometsRef.current.push(createComet(width, height));
          lastCometTimeRef.current = timestamp;
          nextCometDelayRef.current = 20000 + Math.random() * 25000;
        }
      }

      // === Draw Sparks ===
      sparksRef.current = sparksRef.current.filter((spark) => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.015;
        spark.life -= spark.decay;
        if (spark.life <= 0) return false;

        const { r, g, b } = spark.color;
        ctx.globalAlpha = spark.life * globalOpacity * 0.7;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;

      // === Draw Meteors ===
      meteorsRef.current = meteorsRef.current.filter((meteor) => {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= meteor.decay;
        meteor.sparkTimer += 1;

        if (meteor.sparkTimer > 2 && Math.random() > 0.6) {
          sparksRef.current.push(createSpark(meteor.x, meteor.y, meteor.vx, meteor.vy, meteor.color));
          meteor.sparkTimer = 0;
        }

        if (meteor.life <= 0 || meteor.y > height + 50) return false;

        const { r, g, b } = meteor.color;
        const meteorOpacity = meteor.opacity * meteor.life * globalOpacity;
        const tailX = meteor.x - (meteor.vx / meteor.speed) * meteor.length * meteor.life;
        const tailY = meteor.y - (meteor.vy / meteor.speed) * meteor.length * meteor.life;

        const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${meteorOpacity * 0.4})`);
        gradient.addColorStop(0.9, `rgba(255, 255, 255, ${meteorOpacity * 0.8})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${meteorOpacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(meteor.x, meteor.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head
        ctx.globalAlpha = meteorOpacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        return true;
      });

      // === Draw Comets ===
      cometsRef.current = cometsRef.current.filter((comet) => {
        comet.x += comet.vx;
        comet.y += comet.vy;
        comet.life -= comet.decay;
        comet.sparkTimer += 1;

        if (comet.sparkTimer > 2) {
          sparksRef.current.push(createSpark(comet.x, comet.y, comet.vx, comet.vy, comet.color));
          comet.sparkTimer = 0;
        }

        if (comet.life <= 0 || comet.x < -250 || comet.x > width + 250) return false;

        const { r, g, b } = comet.color;
        const cometOpacity = comet.opacity * comet.life * globalOpacity;
        const tailX = comet.x - (comet.vx / comet.speed) * comet.length * comet.life;
        const tailY = comet.y - (comet.vy / comet.speed) * comet.length * comet.life;

        const tailGradient = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
        tailGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        tailGradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${cometOpacity * 0.15})`);
        tailGradient.addColorStop(0.8, `rgba(255, 255, 255, ${cometOpacity * 0.5})`);
        tailGradient.addColorStop(1, `rgba(255, 255, 255, ${cometOpacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(comet.x, comet.y);
        ctx.strokeStyle = tailGradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glowing core
        const coreGradient = ctx.createRadialGradient(
          comet.x, comet.y, 0,
          comet.x, comet.y, comet.coreSize * 2.5
        );
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${cometOpacity})`);
        coreGradient.addColorStop(0.4, `rgba(255, 255, 255, ${cometOpacity * 0.6})`);
        coreGradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${cometOpacity * 0.3})`);
        coreGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.arc(comet.x, comet.y, comet.coreSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      starsRef.current = initStars(width, height);
      dustRef.current = initDust(width, height);
      nebulasRef.current = initNebulas(width, height);
    };

    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 200);
    };

    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };

    window.addEventListener('resize', debouncedResize);
    document.addEventListener('visibilitychange', handleVisibility);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(resizeTimeout);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isDarkMode]);

  useEffect(() => {
    targetOpacityRef.current = active ? 1 : 0;
  }, [active]);

  if (!isDarkMode) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </Box>
  );
}

export default memo(StarfieldCanvas);
