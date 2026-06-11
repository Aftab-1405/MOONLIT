import { useCallback, useRef, useEffect, memo, useState } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';

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
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onResizeStart?.();
  }, [disabled, onResizeStart]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - startX.current;
    startX.current = e.clientX;
    onResize?.(deltaX);
  }, [onResize]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onResizeEnd?.();
  }, [onResizeEnd]);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    const resizeStep = e.shiftKey ? 48 : 24;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onResize?.(-resizeStep);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onResize?.(resizeStep);
    }
  }, [disabled, onResize]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  if (disabled) return null;

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      sx={{
        width: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dragging ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        transition: theme.transitions.create(['background-color'], {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover, &:focus-visible': {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
          outline: 'none',
        },
        '&:active': {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12),
        },
        '&::after': {
          content: '""',
          width: 2,
          height: dragging ? 64 : 40,
          borderRadius: 1,
          backgroundColor: dragging
            ? alpha(theme.palette.primary.main, 0.72)
            : (theme.palette.border?.subtle || alpha(theme.palette.text.primary, 0.14)),
          transition: theme.transitions.create(['background-color', 'height', 'width'], {
            duration: theme.transitions.duration.shorter,
          }),
        },
        '&:hover::after, &:focus-visible::after': {
          width: 3,
          height: 60,
          backgroundColor: alpha(theme.palette.primary.main, 0.65),
        },
      }}
    />
  );
}

export default memo(ResizeHandle);
