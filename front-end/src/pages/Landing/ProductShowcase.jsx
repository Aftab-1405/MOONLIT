import { Box, Container, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { LandingSection, SectionHeading } from './LandingSection';
import { SHOWCASE_FEATURES } from './landingContent';
import WorkspaceMockup from './WorkspaceMockup';

function ShowcaseItem({ feature, active, onActivate }) {
  const itemRef = useRef(null);

  useEffect(() => {
    if (!itemRef.current || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onActivate(feature.id);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: 0.15 },
    );

    observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [feature.id, onActivate]);

  return (
    <Box
      ref={itemRef}
      component="article"
      sx={{
        minHeight: { md: '58vh' },
        py: { xs: 4, md: 8 },
        opacity: active ? 1 : 0.5,
        transition: 'opacity 240ms ease',
        [REDUCED_MOTION_QUERY]: { transition: 'none' },
      }}
    >
      <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}>
        {feature.number}
      </Typography>
      <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 4, color: 'text.secondary' })}>
        {feature.eyebrow}
      </Typography>
      <Typography
        component="h3"
        sx={(theme) => ({ ...theme.typography.displaySm, mt: 1.5, maxWidth: 460, textWrap: 'balance' })}
      >
        {feature.title}
      </Typography>
      <Typography sx={(theme) => ({ ...theme.typography.bodyMd, mt: 2, maxWidth: 520, color: 'text.secondary' })}>
        {feature.description}
      </Typography>
    </Box>
  );
}

export default function ProductShowcase() {
  const [activeFeature, setActiveFeature] = useState(SHOWCASE_FEATURES[0].id);
  const observerAvailable = typeof window !== 'undefined' && 'IntersectionObserver' in window;

  return (
    <LandingSection id="product">
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Product walkthrough"
          title="From question to evidence, without losing context."
        />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.72fr) minmax(0, 1.28fr)' },
            gap: { xs: 4, md: 8 },
            alignItems: 'start',
            mt: { xs: 4, md: 8 },
          }}
        >
          <Box>
            {SHOWCASE_FEATURES.map((feature) => (
              <ShowcaseItem
                key={feature.id}
                feature={feature}
                active={!observerAvailable || feature.id === activeFeature}
                onActivate={setActiveFeature}
              />
            ))}
          </Box>

          <Box sx={{ position: { xs: 'static', md: 'sticky' }, top: { md: 112 }, minWidth: 0 }}>
            <WorkspaceMockup activeFeature={activeFeature} />
          </Box>
        </Box>
      </Container>
    </LandingSection>
  );
}
