import { useEffect, useRef, useState } from 'react';

/**
 * Hook that returns { ref, isRevealed } for scroll-triggered animations.
 * Once revealed, stays revealed (no un-reveal on scroll back up).
 *
 * @param {Object} options
 * @param {string} [options.rootMargin='0px 0px -80px 0px'] - IntersectionObserver rootMargin
 * @param {number} [options.threshold=0.1] - IntersectionObserver threshold
 * @param {boolean} [options.disabled=false] - Skip observation (always show)
 * @returns {{ ref: React.RefObject, isRevealed: boolean }}
 */
export function useScrollReveal({
  rootMargin = '0px 0px -80px 0px',
  threshold = 0.1,
  disabled = false,
} = {}) {
  const ref = useRef(null);
  const [hasIntersected, setHasIntersected] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );
  const isRevealed = disabled || hasIntersected;

  useEffect(() => {
    if (isRevealed) return undefined;

    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isRevealed, rootMargin, threshold]);

  return { ref, isRevealed };
}

/**
 * Hook that tracks whether the page has been scrolled past a threshold.
 * Used for glass navigation effects.
 *
 * @param {number} [threshold=8] - Scroll distance in pixels to trigger
 * @returns {boolean} Whether the user has scrolled past the threshold
 */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector('[data-landing-scroll]');
    if (!scrollContainer) return undefined;

    const handleScroll = () => {
      setScrolled(scrollContainer.scrollTop > threshold);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return scrolled;
}
