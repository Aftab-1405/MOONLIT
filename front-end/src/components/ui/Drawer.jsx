/* eslint-disable react-refresh/only-export-components */

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { alpha, Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import React, { createContext, useContext, useEffect } from 'react';

/**
 * Drawer — accessible slide-in panel built on framer-motion.
 *
 * Used by the mobile sidebar and any other overlay panel that needs to
 * slide in from a screen edge. Composes three sub-components:
 *
 *   Drawer (open, onOpenChange, side) wraps:
 *     DrawerOverlay     - click-to-close backdrop
 *     DrawerContent     - the sliding panel itself
 *
 * Accessibility:
 *   - Escape key closes the drawer (handled here, not by consumers).
 *   - Close button has `aria-label="Close"` and a visible focus ring.
 *   - Backdrop click dismisses.
 *
 * The sliding panel uses a layered box-shadow (close + ambient) rather than
 * a single hard drop shadow so the drawer reads as "elevated" rather than
 * "floating".
 */

const DrawerContext = createContext(undefined);

export const useDrawerContext = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawerContext must be used within a DrawerProvider');
  }
  return context;
};

export const Drawer = ({ children, open, onOpenChange, side = 'right' }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  return (
    <DrawerContext.Provider value={{ open, onOpenChange, side }}>
      <AnimatePresence>{open && <>{children}</>}</AnimatePresence>
    </DrawerContext.Provider>
  );
};

const MotionBox = motion(Box);

export const DrawerOverlay = React.forwardRef(({ sx, ...props }, ref) => {
  const { onOpenChange } = useDrawerContext();
  const theme = useTheme();
  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      onClick={() => onOpenChange(false)}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.drawer,
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        ...sx,
      }}
      {...props}
    />
  );
});
DrawerOverlay.displayName = 'DrawerOverlay';

export const DrawerContent = React.forwardRef(
  ({ sx, children, showCloseButton = true, ...props }, ref) => {
    const { onOpenChange, side } = useDrawerContext();
    const theme = useTheme();

    const sideStyles = {
      top: {
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 'auto',
        maxHeight: '80vh',
        borderBottom: `1px solid ${theme.palette.divider}`,
      },
      bottom: {
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 'auto',
        maxHeight: '80vh',
        borderTop: `1px solid ${theme.palette.divider}`,
      },
      left: {
        top: 0,
        bottom: 0,
        left: 0,
        height: '100%',
        width: 260,
        maxWidth: '90vw',
        borderRight: `1px solid ${theme.palette.divider}`,
      },
      right: {
        top: 0,
        bottom: 0,
        right: 0,
        height: '100%',
        width: 260,
        maxWidth: '90vw',
        borderLeft: `1px solid ${theme.palette.divider}`,
      },
    };

    const getMotionProps = () => {
      switch (side) {
        case 'top':
          return { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } };
        case 'bottom':
          return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
        case 'left':
          return { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } };
        case 'right':
          return { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };
        default:
          return { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };
      }
    };

    return (
      <MotionBox
        ref={ref}
        sx={{
          position: 'fixed',
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          // Layered shadow = premium feel. Two-stop shadow (close + ambient)
          // reads as "elevated panel" rather than a hard drop shadow.
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 18px 48px ${alpha('#000', 0.6)}, 0 4px 12px ${alpha('#000', 0.36)}`
              : `0 18px 48px ${alpha('#000', 0.12)}, 0 4px 12px ${alpha('#000', 0.05)}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...sideStyles[side],
          ...sx,
        }}
        {...getMotionProps()}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 32,
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <IconButton
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            size="small"
            sx={{
              position: 'absolute',
              // Use safe-area-aware top so the button never collides with the
              // status bar / notch on mobile.
              top: 'max(env(safe-area-inset-top), 12px)',
              right: 12,
              color: 'text.secondary',
              borderRadius: '50%',
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
                color: 'text.primary',
              },
              '&:focus-visible': {
                outline: `2px solid ${alpha(theme.palette.text.primary, 0.4)}`,
                outlineOffset: 2,
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </MotionBox>
    );
  },
);
DrawerContent.displayName = 'DrawerContent';

export const DrawerHeader = ({ sx, ...props }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
      p: 3,
      textAlign: 'left',
      ...sx,
    }}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

export const DrawerFooter = ({ sx, ...props }) => (
  <Box
    sx={{
      mt: 'auto',
      display: 'flex',
      flexDirection: { xs: 'column-reverse', sm: 'row' },
      justifyContent: 'flex-end',
      gap: 1.5,
      p: 3,
      ...sx,
    }}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

export const DrawerTitle = React.forwardRef(({ sx, ...props }, ref) => (
  <Typography
    ref={ref}
    variant="h6"
    sx={{
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.015em',
      ...sx,
    }}
    {...props}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

export const DrawerDescription = React.forwardRef(({ sx, ...props }, ref) => (
  <Typography
    ref={ref}
    variant="body2"
    sx={{
      color: 'text.secondary',
      ...sx,
    }}
    {...props}
  />
));
DrawerDescription.displayName = 'DrawerDescription';
