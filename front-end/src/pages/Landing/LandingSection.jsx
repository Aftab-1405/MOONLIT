import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';

export function LandingSection({ id, children, sx = {} }) {
  return (
    <Box
      id={id}
      component="section"
      sx={{
        position: 'relative',
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 9, md: 14 },
        scrollMarginTop: '72px',
        overflow: 'clip',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return (
    <Box sx={{ maxWidth: 760, mx: align === 'center' ? 'auto' : 0, textAlign: align }}>
      <Typography sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.secondary' })}>
        {eyebrow}
      </Typography>
      <Typography component="h2" sx={(theme) => ({ ...theme.typography.displayMd, mt: 2, textWrap: 'balance' })}>
        {title}
      </Typography>
      {description ? (
        <Typography sx={(theme) => ({ ...theme.typography.bodyLg, mt: 2.5, color: 'text.secondary' })}>
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

export function Reveal({ children, delay = 0, sx = {} }) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      sx={{ [REDUCED_MOTION_QUERY]: { opacity: '1 !important', transform: 'none !important' }, ...sx }}
    >
      {children}
    </Box>
  );
}
