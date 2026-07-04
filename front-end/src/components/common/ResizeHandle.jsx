import { Box } from '@mui/material';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

/**
 * ResizeHandle — draggable vertical divider for resizing panels.
 *
 * Visible affordance: a 2px-wide, 36px-tall pill that brightens + glows
 * on hover/focus. The clickable hit area is 8px wide so it's easy to grab
 * with a mouse or finger.
 *
 * Accessibility:
 *   - `role="separator"` with `aria-orientation="vertical"`.
 *   - Keyboard: ArrowLeft/ArrowRight resizes by 24px (Shift = 48px).
 *   - Visible focus ring matches the hover treatment.
 *
 * @param {Function} onResize - Callback fired during drag with deltaX
 * @param {Function} onResizeEnd - Callback fired when drag ends
 * @param {boolean} disabled - When true, hides the handle completely
 */
function ResizeHandle({ onResize, onResizeStart, onResizeEnd, disabled = false }) {
  const theme = useMuiTheme();
  const isDragging = useRef(false);
  const startX = useRef(0);
  const previousBodyStyles = useRef({ cursor: '', userSelect: '' });
  const [dragging, setDragging] = useState(false);

  const restoreBodyStyles = useCallback(() => {
    document.body.style.cursor = previousBodyStyles.current.cursor;
    document.body.style.userSelect = previousBodyStyles.current.userSelect;
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();
      isDragging.current = true;
      setDragging(true);
      startX.current = event.clientX;
      previousBodyStyles.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      onResizeStart?.();
    },
    [disabled, onResizeStart],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!isDragging.current) return;
      const deltaX = event.clientX - startX.current;
      startX.current = event.clientX;
      onResize?.(deltaX);
    },
    [onResize],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    restoreBodyStyles();
    onResizeEnd?.();
  }, [onResizeEnd, restoreBodyStyles]);

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return;

      const resizeStep = e.shiftKey ? 48 : 24;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onResize?.(-resizeStep);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onResize?.(resizeStep);
      }
    },
    [disabled, onResize],
  );

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      if (isDragging.current) restoreBodyStyles();
    };
  }, [handlePointerMove, handlePointerUp, restoreBodyStyles]);
  if (disabled) return null;

  // Resolve handle colours. We use theme.primary for the active/hover state
  // and a low-alpha foreground for the resting state so the handle reads as
  // "grab me" without being visually loud.
  const restingColor = theme.palette.border?.subtle || alpha(theme.palette.text.primary, 0.14);
  const activeColor = theme.palette.primary.main;
  const activeGlow = alpha(theme.palette.primary.main, 0.38);
  const hoverGlow = alpha(theme.palette.primary.main, 0.28);

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      sx={{
        // 10px hit area for easy grabbing (was 8px — bumped for touch).
        width: 10,
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        backgroundColor: 'transparent',
        // Outline is drawn on the inner pill (`::after`) so the hit area
        // itself doesn't show a focus ring that would extend past the visible
        // handle.
        '&:hover, &:focus-visible': {
          backgroundColor: 'transparent',
          outline: 'none',
        },
        '&:active': {
          backgroundColor: 'transparent',
        },
        '&::after': {
          content: '""',
          // Slightly thicker pill (3px, was 2px) — more visible at small sizes.
          width: 3,
          height: 36,
          borderRadius: 999,
          backgroundColor: dragging ? activeColor : restingColor,
          boxShadow: dragging ? `0 0 12px ${activeGlow}` : 'none',
          transition: theme.transitions.create(['background-color', 'box-shadow', 'height'], {
            duration: theme.transitions.duration.shorter,
          }),
        },
        '&:hover::after, &:focus-visible::after': {
          backgroundColor: activeColor,
          height: 40,
          boxShadow: `0 0 12px ${hoverGlow}`,
        },
      }}
    />
  );
}

export default memo(ResizeHandle);
