import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to detect user idle state.
 * Returns true when user has been idle for the specified timeout.
 * Resets when user interacts (mouse, keyboard, scroll, touch).
 * 
 * @param {number} timeout - Idle timeout in milliseconds (default: 8000ms)
 * @returns {boolean} isIdle - Whether user is currently idle
 */
export function useIdleDetection(timeout = 8000) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef(null);
  const isIdleRef = useRef(false); // Track state without causing re-renders

  const resetTimer = useCallback(() => {
    // Only update state if we were idle (avoid unnecessary re-renders)
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer
    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    // Events that indicate user activity
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'keyup',
      'touchstart',
      'touchmove',
      'scroll',
      'wheel',
      'resize',
    ];

    // Throttle event handler for performance (especially for mousemove)
    let lastEventTime = 0;
    const throttleMs = 100; // Only process events every 100ms

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastEventTime >= throttleMs) {
        lastEventTime = now;
        resetTimer();
      }
    };

    // Add event listeners with passive option for scroll/touch performance
    events.forEach((event) => {
      const isPassive = ['scroll', 'wheel', 'touchstart', 'touchmove'].includes(event);
      window.addEventListener(event, handleActivity, { passive: isPassive });
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  return isIdle;
}

export default useIdleDetection;
