/**
 * Character pacing hook for typing animation on assistant text.
 */
import { useState, useEffect, useRef } from 'react';

/**
 * @param {string} content - Full text to reveal
 * @param {boolean} isActive - Whether animation is active (streaming)
 * @param {number} charsPerSecond - Reveal speed (default: 200)
 */
export function useCharacterPacing(content, isActive, charsPerSecond = 200) {
  const initialLength = !isActive && content.length > 0 ? content.length : 0;
  const [revealedLength, setRevealedLength] = useState(initialLength);
  const progressRef = useRef(initialLength);
  const isHistoryRef = useRef(!isActive && content.length > 0);

  useEffect(() => {
    let frame = null;
    const scheduleReveal = (nextLength) => {
      progressRef.current = nextLength;
      frame = requestAnimationFrame(() => {
        setRevealedLength(nextLength);
      });
    };

    if (isHistoryRef.current) {
      scheduleReveal(content.length);
      return () => {
        if (frame !== null) cancelAnimationFrame(frame);
      };
    }
    if (!isActive && progressRef.current < content.length) {
      scheduleReveal(content.length);
      return () => {
        if (frame !== null) cancelAnimationFrame(frame);
      };
    }
    if (progressRef.current >= content.length) {
      return undefined;
    }
    const charsPerTick = 4;
    const intervalMs = (charsPerTick / charsPerSecond) * 1000;

    const timer = setInterval(() => {
      if (progressRef.current >= content.length) {
        clearInterval(timer);
        return;
      }
      let nextIdx = progressRef.current + charsPerTick;
      if (nextIdx >= content.length) {
        nextIdx = content.length;
        clearInterval(timer);
      }

      progressRef.current = nextIdx;
      setRevealedLength(nextIdx);
    }, intervalMs);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, [content, charsPerSecond, isActive]);

  useEffect(() => {
    if (content.length === 0) {
      progressRef.current = 0;
      const frame = requestAnimationFrame(() => {
        setRevealedLength(0);
      });
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [content.length]);

  return content.slice(0, revealedLength);
}
