import { useEffect, useRef, memo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * High-performance starfield animation with shooting stars.
 * Features tiny glowing stars and occasional meteor trails.
 * Optimized for dark theme; disabled on light theme.
 */
function StarfieldCanvas({ active = false }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const starsRef = useRef([]);
  const nebulasRef = useRef([]);
  const meteorsRef = useRef([]);
  const cometsRef = useRef([]);
  const sparksRef = useRef([]);
  // const auroraRef = useRef([]); // Aurora effect removed
  const opacityRef = useRef(0);
  const targetOpacityRef = useRef(0);
  const lastMeteorTimeRef = useRef(0);
  const lastCometTimeRef = useRef(0);
  const nextMeteorDelayRef = useRef(2000 + Math.random() * 6000); // Initial random delay
  const nextCometDelayRef = useRef(8000 + Math.random() * 12000); // Comets are rarer

  useEffect(() => {
    // Disable starfield on light theme - it doesn't look good
    if (!isDarkMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Cosmic color palette for stars - subtle tints that feel natural
    const starColors = [
      { r: 255, g: 255, b: 255 },   // Pure white (most common)
      { r: 255, g: 255, b: 255 },   // Pure white (duplicate for higher chance)
      { r: 255, g: 255, b: 255 },   // Pure white (duplicate for higher chance)
      { r: 200, g: 220, b: 255 },   // Cool blue-white
      { r: 180, g: 200, b: 255 },   // Soft blue
      { r: 160, g: 180, b: 255 },   // Light blue
      { r: 220, g: 200, b: 255 },   // Soft lavender
      { r: 200, g: 180, b: 255 },   // Light purple
      { r: 180, g: 220, b: 255 },   // Cyan-tinted
      { r: 160, g: 230, b: 255 },   // Bright cyan
      { r: 255, g: 240, b: 200 },   // Warm gold
      { r: 255, g: 220, b: 180 },   // Soft amber
      { r: 255, g: 200, b: 200 },   // Subtle rose
    ];

    /**
     * Initialize stars with natural clustering and subtle color/size/opacity variation.
     * Uses a random cluster approach for realism.
     */
    const initStars = (w, h) => {
      const stars = [];
      const area = w * h;
      const baseCount = Math.floor(area / 18000); // Slightly denser
      const clusterCount = Math.floor(Math.random() * 2) + 2; // 2-3 clusters
      // Generate clusters
      for (let c = 0; c < clusterCount; c++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const clusterStars = 8 + Math.floor(Math.random() * 8);
        for (let i = 0; i < clusterStars; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 80 + 20;
          const x = cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
          const y = cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 10;
          const color = starColors[Math.floor(Math.random() * starColors.length)];
          stars.push({
            x: Math.max(0, Math.min(w, x)),
            y: Math.max(0, Math.min(h, y)),
            size: Math.random() * 1.3 + 0.5, // 0.5-1.8px
            baseOpacity: Math.random() * 0.4 + 0.25, // 0.25-0.65
            color,
            vx: (Math.random() - 0.5) * 0.09,
            vy: (Math.random() - 0.5) * 0.09,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.025 + 0.008,
          });
        }
      }
      // Add background stars (randomly scattered)
      for (let i = 0; i < baseCount; i++) {
        const color = starColors[Math.floor(Math.random() * starColors.length)];
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 1.1 + 0.3, // 0.3-1.4px
          baseOpacity: Math.random() * 0.25 + 0.12, // 0.12-0.37
          color,
          vx: (Math.random() - 0.5) * 0.07,
          vy: (Math.random() - 0.5) * 0.07,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.018 + 0.006,
        });
      }
      return stars;
    };

    // Nebula color palette - brighter cosmic hues for visibility
    const nebulaColors = [
      { r: 130, g: 80, b: 220 },   // Vibrant purple
      { r: 80, g: 100, b: 200 },   // Rich blue
      { r: 100, g: 160, b: 240 },  // Bright blue
      { r: 80, g: 180, b: 220 },   // Cyan
      { r: 160, g: 100, b: 200 },  // Bright lavender
      { r: 180, g: 80, b: 150 },   // Magenta
    ];

    // Initialize nebula clouds - large, visible gradient areas
    const initNebulas = (w, h) => {
      const nebulas = [];
      const nebulaCount = 3 + Math.floor(Math.random() * 2); // 3-4 nebulas

      for (let i = 0; i < nebulaCount; i++) {
        const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
        nebulas.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 200 + Math.random() * 300, // Larger clouds: 200-500px
          color,
          baseOpacity: 0.04 + Math.random() * 0.04, // Low opacity: 0.04-0.08
          // Slow drift
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          // Pulse effect
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.003 + Math.random() * 0.003,
        });
      }
      return nebulas;
    };

    // Meteor color palette - vibrant trails
    const meteorColors = [
      { r: 255, g: 255, b: 255 },   // White (classic)
      { r: 180, g: 220, b: 255 },   // Ice blue
      { r: 255, g: 200, b: 100 },   // Golden
      { r: 255, g: 150, b: 200 },   // Pink
      { r: 150, g: 255, b: 200 },   // Mint green
      { r: 200, g: 180, b: 255 },   // Lavender
    ];

    // Create a shooting star/meteor with random direction and color
    const createMeteor = (w, h) => {
      const speed = 5 + Math.random() * 6; // Fast movement

      // Calculate start position based on direction (spawn from edges)
      let startX, startY;
      const edge = Math.floor(Math.random() * 4);

      switch (edge) {
        case 0: startX = Math.random() * w; startY = -20; break;
        case 1: startX = w + 20; startY = Math.random() * h; break;
        case 2: startX = Math.random() * w; startY = h + 20; break;
        default: startX = -20; startY = Math.random() * h; break;
      }

      // Direction towards center with randomness
      const centerX = w / 2 + (Math.random() - 0.5) * w * 0.6;
      const centerY = h / 2 + (Math.random() - 0.5) * h * 0.6;
      const dirAngle = Math.atan2(centerY - startY, centerX - startX);
      const color = meteorColors[Math.floor(Math.random() * meteorColors.length)];

      return {
        x: startX,
        y: startY,
        vx: Math.cos(dirAngle) * speed,
        vy: Math.sin(dirAngle) * speed,
        length: 60 + Math.random() * 100, // Trail length
        opacity: 0.8 + Math.random() * 0.2,
        life: 1.0,
        decay: 0.010 + Math.random() * 0.008,
        color,
        sparkTimer: 0, // For spawning sparks
      };
    };

    // Create a dramatic comet with long trail
    const createComet = (w, h) => {
      const speed = 2 + Math.random() * 2; // Slower than meteors

      // Comets typically come from top-left or top-right
      const fromLeft = Math.random() > 0.5;
      const startX = fromLeft ? -50 : w + 50;
      const startY = Math.random() * h * 0.3; // Upper portion

      // Direction: diagonal across screen
      const targetX = fromLeft ? w + 100 : -100;
      const targetY = h * 0.5 + Math.random() * h * 0.4;
      const dirAngle = Math.atan2(targetY - startY, targetX - startX);

      // Comet colors - more dramatic
      const cometColors = [
        { r: 100, g: 200, b: 255 },   // Bright cyan
        { r: 255, g: 220, b: 150 },   // Warm gold
        { r: 200, g: 150, b: 255 },   // Purple
      ];
      const color = cometColors[Math.floor(Math.random() * cometColors.length)];

      return {
        x: startX,
        y: startY,
        vx: Math.cos(dirAngle) * speed,
        vy: Math.sin(dirAngle) * speed,
        length: 200 + Math.random() * 150, // Very long trail
        opacity: 0.9,
        life: 1.0,
        decay: 0.003 + Math.random() * 0.002, // Slow decay - lasts longer
        color,
        coreSize: 4 + Math.random() * 3, // Larger glowing head
        sparkTimer: 0,
      };
    };

    // Create spark particle (from meteors/comets)
    const createSpark = (x, y, baseVx, baseVy, color) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      return {
        x,
        y,
        vx: baseVx * 0.3 + Math.cos(angle) * speed,
        vy: baseVy * 0.3 + Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
        size: 0.5 + Math.random() * 1,
        color,
      };
    };

    // Aurora effect removed

    if (starsRef.current.length === 0) {
      starsRef.current = initStars(width, height);
    }
    if (nebulasRef.current.length === 0) {
      nebulasRef.current = initNebulas(width, height);
    }

    const animate = (timestamp) => {
      // Smooth opacity transition
      const opacityDiff = targetOpacityRef.current - opacityRef.current;
      if (Math.abs(opacityDiff) > 0.005) {
        opacityRef.current += opacityDiff * 0.03;
      } else {
        opacityRef.current = targetOpacityRef.current;
      }

      // Skip if fully transparent
      if (opacityRef.current < 0.01) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const globalOpacity = opacityRef.current;

      // === Draw Nebulas ===
      // Large, slowly drifting cosmic clouds with subtle pulsing
      for (const nebula of nebulasRef.current) {
        // Update position (slow drift)
        nebula.x += nebula.vx;
        nebula.y += nebula.vy;
        // Wrap around edges
        if (nebula.x < -nebula.radius) nebula.x = width + nebula.radius;
        if (nebula.x > width + nebula.radius) nebula.x = -nebula.radius;
        if (nebula.y < -nebula.radius) nebula.y = height + nebula.radius;
        if (nebula.y > height + nebula.radius) nebula.y = -nebula.radius;
        // Pulse effect
        nebula.pulsePhase += nebula.pulseSpeed;
        const pulse = 0.85 + 0.15 * Math.sin(nebula.pulsePhase);
        const opacity = nebula.baseOpacity * pulse * globalOpacity;
        const { r, g, b } = nebula.color;
        // Draw nebula as radial gradient
        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.radius
        );
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
        gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Aurora effect removed

      // === Draw Stars ===
      // Stars drift slowly and twinkle with a natural, non-synchronized phase.
      for (const star of starsRef.current) {
        // Update position (gentle drift)
        star.x += star.vx;
        star.y += star.vy;
        // Wrap around edges
        if (star.x < -5) star.x = width + 5;
        if (star.x > width + 5) star.x = -5;
        if (star.y < -5) star.y = height + 5;
        if (star.y > height + 5) star.y = -5;
        // Twinkle: phase and speed are unique per star
        star.twinklePhase += star.twinkleSpeed;
        // More natural twinkle: combine two sine waves
        const twinkle = 0.6 + 0.4 * Math.sin(star.twinklePhase) * Math.sin(star.twinklePhase * 0.7 + 1.3);
        const opacity = star.baseOpacity * twinkle * globalOpacity;
        const { r, g, b } = star.color;
        // Draw star as a soft radial gradient (not a solid dot)
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 2.2
        );
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // === Spawn Meteors ===
      // Random spawn interval: 2-8 seconds (stored in ref to avoid recalculating every frame)
      const timeSinceLastMeteor = timestamp - lastMeteorTimeRef.current;

      if (globalOpacity > 0.5 && timeSinceLastMeteor > nextMeteorDelayRef.current) {
        if (meteorsRef.current.length < 3) { // Max 3 meteors at once
          meteorsRef.current.push(createMeteor(width, height));
          lastMeteorTimeRef.current = timestamp;
          // Set next random delay for future spawn
          nextMeteorDelayRef.current = 2000 + Math.random() * 6000;
        }
      }

      // === Spawn Comets (rarer) ===
      const timeSinceLastComet = timestamp - lastCometTimeRef.current;
      if (globalOpacity > 0.5 && timeSinceLastComet > nextCometDelayRef.current) {
        if (cometsRef.current.length < 1) { // Max 1 comet at once
          cometsRef.current.push(createComet(width, height));
          lastCometTimeRef.current = timestamp;
          nextCometDelayRef.current = 10000 + Math.random() * 15000; // 10-25 seconds
        }
      }

      // === Draw Sparks ===
      sparksRef.current = sparksRef.current.filter((spark) => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.02; // Slight gravity
        spark.life -= spark.decay;

        if (spark.life <= 0) return false;

        const { r, g, b } = spark.color;
        const sparkOpacity = spark.life * globalOpacity * 0.8;

        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${sparkOpacity})`;
        ctx.fill();

        return true;
      });

      // === Draw Meteors ===
      meteorsRef.current = meteorsRef.current.filter((meteor) => {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= meteor.decay;
        meteor.sparkTimer += 1;

        // Spawn sparks occasionally
        if (meteor.sparkTimer > 3 && Math.random() > 0.7) {
          sparksRef.current.push(createSpark(meteor.x, meteor.y, meteor.vx, meteor.vy, meteor.color));
          meteor.sparkTimer = 0;
        }

        // Remove meteors that are dead or have left the screen
        if (meteor.life <= 0 ||
          meteor.x < -100 || meteor.x > width + 100 ||
          meteor.y < -100 || meteor.y > height + 100) {
          return false;
        }

        const { r, g, b } = meteor.color;
        const meteorOpacity = meteor.opacity * meteor.life * globalOpacity;

        // Draw meteor trail with colored gradient
        const speed = Math.sqrt(meteor.vx ** 2 + meteor.vy ** 2);
        const tailX = meteor.x - (meteor.vx / speed) * meteor.length * meteor.life;
        const tailY = meteor.y - (meteor.vy / speed) * meteor.length * meteor.life;

        const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${meteorOpacity * 0.3})`);
        gradient.addColorStop(0.8, `rgba(255, 255, 255, ${meteorOpacity * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${meteorOpacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(meteor.x, meteor.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head
        const headGradient = ctx.createRadialGradient(
          meteor.x, meteor.y, 0,
          meteor.x, meteor.y, 4
        );
        headGradient.addColorStop(0, `rgba(255, 255, 255, ${meteorOpacity})`);
        headGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${meteorOpacity * 0.5})`);
        headGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = headGradient;
        ctx.fill();

        return true;
      });

      // === Draw Comets ===
      cometsRef.current = cometsRef.current.filter((comet) => {
        comet.x += comet.vx;
        comet.y += comet.vy;
        comet.life -= comet.decay;
        comet.sparkTimer += 1;

        // Comets spawn more sparks
        if (comet.sparkTimer > 2) {
          sparksRef.current.push(createSpark(comet.x, comet.y, comet.vx, comet.vy, comet.color));
          if (Math.random() > 0.5) {
            sparksRef.current.push(createSpark(comet.x, comet.y, comet.vx, comet.vy, comet.color));
          }
          comet.sparkTimer = 0;
        }

        // Remove comets that are dead or have left the screen
        if (comet.life <= 0 ||
          comet.x < -200 || comet.x > width + 200 ||
          comet.y < -200 || comet.y > height + 200) {
          return false;
        }

        const { r, g, b } = comet.color;
        const cometOpacity = comet.opacity * comet.life * globalOpacity;

        // Draw comet tail - very long gradient
        const speed = Math.sqrt(comet.vx ** 2 + comet.vy ** 2);
        const tailX = comet.x - (comet.vx / speed) * comet.length * comet.life;
        const tailY = comet.y - (comet.vy / speed) * comet.length * comet.life;

        // Wide, fading tail
        const tailGradient = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
        tailGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        tailGradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${cometOpacity * 0.1})`);
        tailGradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${cometOpacity * 0.3})`);
        tailGradient.addColorStop(0.9, `rgba(255, 255, 255, ${cometOpacity * 0.7})`);
        tailGradient.addColorStop(1, `rgba(255, 255, 255, ${cometOpacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(comet.x, comet.y);
        ctx.strokeStyle = tailGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glowing core
        const coreGradient = ctx.createRadialGradient(
          comet.x, comet.y, 0,
          comet.x, comet.y, comet.coreSize * 2
        );
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${cometOpacity})`);
        coreGradient.addColorStop(0.3, `rgba(255, 255, 255, ${cometOpacity * 0.8})`);
        coreGradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${cometOpacity * 0.5})`);
        coreGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.beginPath();
        ctx.arc(comet.x, comet.y, comet.coreSize * 2, 0, Math.PI * 2);
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
      nebulasRef.current = initNebulas(width, height);
    };

    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDarkMode]);

  useEffect(() => {
    targetOpacityRef.current = active ? 1 : 0;
  }, [active]);

  // Don't render canvas on light theme
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
