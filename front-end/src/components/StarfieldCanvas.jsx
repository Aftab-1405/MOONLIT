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
  const meteorsRef = useRef([]);
  const opacityRef = useRef(0);
  const targetOpacityRef = useRef(0);
  const lastMeteorTimeRef = useRef(0);
  const nextMeteorDelayRef = useRef(2000 + Math.random() * 6000); // Initial random delay

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

    // Initialize stars - visible but not overwhelming
    const initStars = (w, h) => {
      const stars = [];
      const starCount = Math.floor((w * h) / 20000); // ~60-80 stars for typical screen
      
      for (let i = 0; i < Math.min(starCount, 80); i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 1.2 + 0.5, // Visible: 0.5 to 1.7px
          baseOpacity: Math.random() * 0.5 + 0.2, // 0.2 to 0.7 - more visible
          // Slow drift
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          // Twinkle
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.03 + 0.01,
        });
      }
      return stars;
    };

    // Create a shooting star/meteor with random direction
    const createMeteor = (w, h) => {
      // Random angle in any direction (0 to 2π)
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 5; // Fast movement
      
      // Calculate start position based on direction (spawn from edges)
      let startX, startY;
      const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      
      switch (edge) {
        case 0: // Top edge
          startX = Math.random() * w;
          startY = -20;
          break;
        case 1: // Right edge
          startX = w + 20;
          startY = Math.random() * h;
          break;
        case 2: // Bottom edge
          startX = Math.random() * w;
          startY = h + 20;
          break;
        default: // Left edge
          startX = -20;
          startY = Math.random() * h;
          break;
      }
      
      // Direction towards center with randomness
      const centerX = w / 2 + (Math.random() - 0.5) * w * 0.6;
      const centerY = h / 2 + (Math.random() - 0.5) * h * 0.6;
      const dirAngle = Math.atan2(centerY - startY, centerX - startX);
      
      return {
        x: startX,
        y: startY,
        vx: Math.cos(dirAngle) * speed,
        vy: Math.sin(dirAngle) * speed,
        length: 50 + Math.random() * 80, // Trail length
        opacity: 0.7 + Math.random() * 0.3,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.008,
      };
    };

    if (starsRef.current.length === 0) {
      starsRef.current = initStars(width, height);
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

      // === Draw Stars ===
      for (const star of starsRef.current) {
        // Update position (very slow drift)
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around
        if (star.x < -5) star.x = width + 5;
        if (star.x > width + 5) star.x = -5;
        if (star.y < -5) star.y = height + 5;
        if (star.y > height + 5) star.y = -5;

        // Twinkle effect
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = 0.5 + 0.5 * Math.sin(star.twinklePhase);
        const opacity = star.baseOpacity * twinkle * globalOpacity;

        // Draw star with subtle glow (not a solid circle)
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 2
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(0.4, `rgba(255, 255, 255, ${opacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
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

      // === Draw Meteors ===
      meteorsRef.current = meteorsRef.current.filter((meteor) => {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= meteor.decay;

        // Remove meteors that are dead or have left the screen (any direction)
        if (meteor.life <= 0 || 
            meteor.x < -100 || meteor.x > width + 100 || 
            meteor.y < -100 || meteor.y > height + 100) {
          return false;
        }

        const meteorOpacity = meteor.opacity * meteor.life * globalOpacity;

        // Draw meteor trail with gradient
        const tailX = meteor.x - (meteor.vx / Math.sqrt(meteor.vx ** 2 + meteor.vy ** 2)) * meteor.length * meteor.life;
        const tailY = meteor.y - (meteor.vy / Math.sqrt(meteor.vx ** 2 + meteor.vy ** 2)) * meteor.length * meteor.life;

        const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${meteorOpacity * 0.3})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${meteorOpacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(meteor.x, meteor.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head
        const headGradient = ctx.createRadialGradient(
          meteor.x, meteor.y, 0,
          meteor.x, meteor.y, 3
        );
        headGradient.addColorStop(0, `rgba(255, 255, 255, ${meteorOpacity})`);
        headGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = headGradient;
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
