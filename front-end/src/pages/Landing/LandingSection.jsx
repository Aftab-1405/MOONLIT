import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { getScrollRevealSx, getSectionDividerSx, getStaggerDelay } from './landingAnimations';
import { getLandingPresentationSx } from './landingPresentation';
import { useScrollReveal } from './useScrollReveal';

const landingPresentationSx = getLandingPresentationSx();

export function LandingSection({ id, children, sx = {}, divider = true }) {
  return (
    <Box
      id={id}
      component="section"
      sx={{
        ...landingPresentationSx.section,
        ...(divider ? getSectionDividerSx() : {}),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  maxWidth = 760,
  descriptionMaxWidth,
}) {
  const { ref, isRevealed } = useScrollReveal();

  return (
    <Box
      ref={ref}
      sx={{
        maxWidth,
        mx: align === 'center' ? 'auto' : 0,
        textAlign: align,
        ...getScrollRevealSx(isRevealed),
      }}
    >
      <Typography sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.secondary' })}>
        {eyebrow}
      </Typography>
      <Typography
        component="h2"
        tabIndex={-1}
        sx={(theme) => ({
          ...theme.typography.displayMd,
          mt: 2,
          textWrap: 'balance',
          '&:focus-visible': {
            backgroundColor: 'transparent',
            outline: '1px solid',
            outlineColor: 'border.default',
            outlineOffset: 4,
          },
        })}
      >
        {title}
      </Typography>
      {description ? (
        <Typography
          sx={(theme) => ({
            ...theme.typography.bodyLg,
            maxWidth: descriptionMaxWidth,
            mt: 2.5,
            mx: align === 'center' ? 'auto' : 0,
            color: 'text.secondary',
          })}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

export function Reveal({ children, delay = 0, heroEntrance = false, sx = {} }) {
  if (heroEntrance) {
    return (
      <Box
        component={motion.div}
        initial={{ opacity: 0.84, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
        sx={{
          [REDUCED_MOTION_QUERY]: {
            opacity: '1 !important',
            transform: 'none !important',
            transition: 'none !important',
          },
          ...sx,
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <ScrollReveal delay={delay} sx={sx}>
      {children}
    </ScrollReveal>
  );
}

function ScrollReveal({ children, delay = 0, sx = {}, staggerIndex = 0 }) {
  const { ref, isRevealed } = useScrollReveal();
  const totalDelay = delay + getStaggerDelay(staggerIndex);

  return (
    <Box
      ref={ref}
      sx={{
        ...getScrollRevealSx(isRevealed, totalDelay),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
