import { useState, useEffect } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';

/**
 * ThinkingIndicator - Displays AI's reasoning/thinking process
 * 
 * Shows a collapsible panel with the model's internal reasoning.
 * Expands while thinking, auto-collapses when complete.
 */
const ThinkingIndicator = ({ content, isThinking }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(isThinking);
  
  // Auto-collapse when thinking finishes
  useEffect(() => {
    if (isThinking) {
      setExpanded(true);
    } else if (content) {
      // Auto-collapse after a short delay when thinking ends
      const timer = setTimeout(() => setExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isThinking, content]);

  // Purple/violet color scheme for thinking (distinct from teal tools)
  // Mapped to secondary (Indigo) for consistency
  const colors = {
    bg: alpha(theme.palette.secondary.main, 0.08),
    border: alpha(theme.palette.secondary.main, 0.2),
    text: theme.palette.secondary.light
  };

  if (!content && !isThinking) return null;

  return (
    <Box 
      sx={{ 
        display: 'inline-flex',
        flexDirection: 'column',
        borderRadius: 2, 
        bgcolor: colors.bg, 
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        mb: 1.5,
        maxWidth: '100%',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header - Clickable to expand/collapse */}
      <Box 
        onClick={() => setExpanded(!expanded)} 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 0.75, 
          py: 0.75, 
          px: 1.25,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.03)
          }
        }}
      >
        {/* Expand Arrow */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)'
          }}
        >
          <KeyboardArrowDownIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        </Box>

        {/* Brain Icon */}
        <PsychologyRoundedIcon sx={{ fontSize: 14, color: colors.text }} />
        
        {/* Title */}
        <Typography 
          sx={{ 
            color: colors.text, 
            fontWeight: 500, 
            fontSize: '0.8rem' 
          }}
        >
          {isThinking ? 'Thinking' : 'Thinking'}
        </Typography>
        
        {/* Animated dots while thinking */}
        {isThinking && (
          <Box sx={{ display: 'flex', gap: 0.3, ml: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box 
                key={i} 
                sx={{
                  width: 4, 
                  height: 4, 
                  borderRadius: '50%',
                  bgcolor: colors.text,
                  animation: 'pulse 1.4s infinite',
                  animationDelay: `${i * 0.2}s`,
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.3 },
                    '50%': { opacity: 1 }
                  }
                }} 
              />
            ))}
          </Box>
        )}
        
        {/* Character count when collapsed */}
        {!expanded && content && (
          <Typography 
            sx={{ 
              color: 'text.secondary', 
              fontSize: '0.75rem',
              opacity: 0.8 
            }}
          >
            • {content.length} chars
          </Typography>
        )}
      </Box>
      
      {/* Expanded Content */}
      <Collapse in={expanded} timeout={200}>
        <Box 
          sx={{ 
            px: 1.5, 
            pb: 1.25, 
            pt: 0.75,
            borderTop: `1px solid ${colors.border}`,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            maxHeight: 200,
            overflow: 'auto',
            lineHeight: 1.5,
          }}
        >
          {content || 'Processing...'}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ThinkingIndicator;
