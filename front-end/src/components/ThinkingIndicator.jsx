import { useState, useEffect } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
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
  // No local colors needed - handled by global MuiAccordion theme overrides

  if (!content && !isThinking) return null;

  return (
    <Accordion 
      expanded={expanded} 
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      sx={{ mb: 1.5, maxWidth: '100%' }}
    >
      <AccordionSummary
        expandIcon={<KeyboardArrowDownIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
        sx={{
          flexDirection: 'row-reverse',
          '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
            transform: 'rotate(0deg)',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            transform: 'rotate(-90deg)',
          },
          '& .MuiAccordionSummary-content': {
            ml: 1,
            alignItems: 'center',
            gap: 0.75,
          },
        }}
      >
        {/* Brain Icon */}
        <PsychologyRoundedIcon sx={{ fontSize: 14, color: 'text.primary' }} />
        
        {/* Title */}
        <Typography 
          sx={{ 
            color: 'text.primary', 
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
                  bgcolor: 'text.primary',
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
              opacity: 0.8,
              ml: 'auto'
            }}
          >
            • {content.length} chars
          </Typography>
        )}
      </AccordionSummary>
      
      <AccordionDetails 
        sx={{ 
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
      </AccordionDetails>
    </Accordion>
  );
};

export default ThinkingIndicator;
