'use client';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { useMemo } from 'react';
import { DARK, LIGHT } from '@/theme/tokens';

// Information Icon SVG
const InfoIcon = ({ style }) => (
  <svg
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Success Icon SVG
const SuccessIcon = ({ style }) => (
  <svg
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Warning Icon SVG
const WarningIcon = ({ style }) => (
  <svg
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

// Error Icon SVG
const ErrorIcon = ({ style }) => (
  <svg
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Close Icon SVG
const CloseIcon = ({ style }) => (
  <svg
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Loading Spinner SVG (using framer-motion for smooth spinning)
const LoadingSpinner = ({ style }) => (
  <motion.svg
    style={style}
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      style={{ opacity: 0.25 }}
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      style={{ opacity: 0.75 }}
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </motion.svg>
);

const Notification = ({ type, title, message, showIcon = true, duration, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tokens = isDark ? DARK : LIGHT;

  // Resolve config styling and icons dynamically based on mode tokens
  const config = useMemo(() => {
    const iconSize = { width: '20px', height: '20px' };
    switch (type) {
      case 'success':
        return {
          iconColor: tokens.success000,
          icon: <SuccessIcon style={iconSize} />,
          gradientBg: `linear-gradient(135deg, ${alpha(tokens.success000, 0.12)} 0%, transparent 100%)`,
        };
      case 'error':
        return {
          iconColor: tokens.danger000,
          icon: <ErrorIcon style={iconSize} />,
          gradientBg: `linear-gradient(135deg, ${alpha(tokens.danger000, 0.12)} 0%, transparent 100%)`,
        };
      case 'warning':
        return {
          iconColor: tokens.warning000,
          icon: <WarningIcon style={iconSize} />,
          gradientBg: `linear-gradient(135deg, ${alpha(tokens.warning000, 0.12)} 0%, transparent 100%)`,
        };
      case 'loading':
        return {
          iconColor: tokens.text400,
          icon: <LoadingSpinner style={iconSize} />,
          gradientBg: `linear-gradient(135deg, ${alpha(tokens.text400, 0.12)} 0%, transparent 100%)`,
        };
      default:
        return {
          iconColor: tokens.info000,
          icon: <InfoIcon style={iconSize} />,
          gradientBg: `linear-gradient(135deg, ${alpha(tokens.info000, 0.12)} 0%, transparent 100%)`,
        };
    }
  }, [type, tokens]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '12px',
        padding: '14px 16px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: alpha(tokens.bg100, 0.8),
        border: `1px solid ${alpha(tokens.border200, 0.08)}`,
        boxShadow: isDark
          ? `0 10px 30px -5px ${alpha(tokens.bg000, 0.6)}, 0 8px 12px -6px ${alpha(tokens.bg000, 0.6)}`
          : `0 10px 25px -5px ${alpha(tokens.text000, 0.08)}, 0 8px 10px -6px ${alpha(tokens.text000, 0.04)}`,
        overflow: 'hidden',
        pointerEvents: 'auto',
        transition: 'transform 0.15s ease-in-out',
      }}
    >
      {/* Dynamic Background Gradient Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: config.gradientBg,
          opacity: 0.65,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          width: '100%',
        }}
      >
        {showIcon && (
          <div
            style={{
              flexShrink: 0,
              color: config.iconColor,
              display: 'flex',
              alignItems: 'center',
              height: '20px',
            }}
          >
            {config.icon}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: tokens.text000,
              lineHeight: 1.45,
            }}
          >
            {title}
          </span>
          {message && (
            <span
              style={{
                fontSize: '12px',
                color: tokens.text200,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                marginTop: '1px',
              }}
            >
              {message}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            borderRadius: '50%',
            color: tokens.text400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = alpha(tokens.text000, 0.06);
            e.currentTarget.style.color = tokens.text000;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = tokens.text400;
          }}
        >
          <CloseIcon style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {duration && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            width: '100%',
            backgroundColor: alpha(tokens.border200, 0.05),
            zIndex: 2,
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            onAnimationComplete={onClose}
            style={{
              height: '100%',
              backgroundColor: config.iconColor,
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default Notification;
