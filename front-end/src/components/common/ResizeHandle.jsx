import { Box } from '@mui/material';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

/**
 * ResizeHandle - Draggable vertical divider for resizing panels
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

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      sx={{
        width: 8,
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        backgroundColor: 'transparent',
        '&:hover, &:focus-visible': {
          backgroundColor: 'transparent',
          outline: 'none',
        },
        '&:active': {
          backgroundColor: 'transparent',
        },
        '&::after': {
          content: '""',
          width: 2,
          height: 36,
          borderRadius: 999,
          backgroundColor: dragging
            ? theme.palette.primary.main
            : theme.palette.border?.subtle || alpha(theme.palette.text.primary, 0.14),
          boxShadow: dragging ? `0 0 10px ${alpha(theme.palette.primary.main, 0.38)}` : 'none',
          transition: theme.transitions.create(['background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        },
        '&:hover::after, &:focus-visible::after': {
          backgroundColor: theme.palette.primary.main,
          boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.28)}`,
        },
      }}
    />
  );
}

export default memo(ResizeHandle);
