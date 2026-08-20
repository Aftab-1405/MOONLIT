import { Box, Container, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import AgentTrace from './AgentTrace';
import { LandingSection, SectionHeading } from './LandingSection';
import { LANDING_COPY, PRODUCT_STAGES } from './landingContent';
import {
  getLandingPresentationSx,
  getProductShowcaseViewModel,
  getProductWorkspaceGeometry,
} from './landingPresentation';
import ProductWorkspace from './ProductWorkspace';

const landingPresentationSx = getLandingPresentationSx();
const productWorkspaceGeometry = getProductWorkspaceGeometry();

function ShowcaseItem({ feature, active, observe = false, desktop = false, onActivate }) {
  const itemRef = useRef(null);

  useEffect(() => {
    if (
      !observe ||
      !itemRef.current ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
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
  }, [feature.id, observe, onActivate]);

  return (
    <Box
      ref={itemRef}
      component="article"
      aria-current={desktop && observe && active ? 'step' : undefined}
      data-product-narrative={feature.id}
      data-product-narrative-state={active ? 'active' : 'inactive'}
      sx={{
        minHeight: { md: '58vh' },
        py: { xs: 3, md: 8 },
        pl: { xs: 2, md: 1 },
        borderLeft: '2px solid',
        borderColor: active ? 'text.primary' : 'border.subtle',
        opacity: active ? 1 : 0.72,
        transition: 'border-color 0.4s ease, opacity 0.4s ease',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Typography
        sx={(theme) => ({
          ...theme.typography.captionMonoSm,
          color: active ? 'text.primary' : 'text.secondary',
        })}
      >
        {feature.number}
      </Typography>
      <Typography
        sx={(theme) => ({
          ...theme.typography.captionMonoSm,
          mt: 4,
          color: active ? 'text.primary' : 'text.secondary',
        })}
      >
        {feature.eyebrow}
      </Typography>
      <Typography
        component="h3"
        sx={(theme) => ({
          ...theme.typography.displaySm,
          mt: 1.5,
          maxWidth: 460,
          color: active ? 'text.primary' : 'text.secondary',
          fontSize: {
            xs: theme.typography.displaySm.fontSize.xs,
            md: 'clamp(1.75rem, 3.65vw, 2rem)',
          },
          textWrap: 'balance',
        })}
      >
        {feature.title}
      </Typography>
      <Typography
        sx={(theme) => ({
          ...theme.typography.bodyMd,
          mt: 2,
          maxWidth: 520,
          color: 'text.secondary',
        })}
      >
        {feature.description}
      </Typography>
    </Box>
  );
}

export default function ProductShowcase() {
  const [activeStageId, setActiveStageId] = useState(PRODUCT_STAGES[0].id);
  const desktopLayout = useMediaQuery((theme) => theme.breakpoints.up('md'));
  const observerAvailable = typeof window !== 'undefined' && 'IntersectionObserver' in window;
  const showcaseViewModel = getProductShowcaseViewModel({
    stages: PRODUCT_STAGES,
    activeStageId,
    observerAvailable,
  });

  return (
    <LandingSection id="product">
      <Container maxWidth="xl">
        <SectionHeading
          eyebrow={LANDING_COPY.sectionHeading.eyebrow}
          title={LANDING_COPY.sectionHeading.title}
          description={LANDING_COPY.sectionHeading.description}
        />

        <Box
          sx={{
            display: landingPresentationSx.productShowcase.desktopDisplay,
            gridTemplateColumns: productWorkspaceGeometry.showcaseGridTemplateColumns,
            gap: productWorkspaceGeometry.showcaseGap,
            alignItems: 'start',
            mt: 8,
          }}
        >
          <Box>
            {showcaseViewModel.desktopItems.map(({ stageId, active, observe }) => {
              const feature = PRODUCT_STAGES.find(({ id }) => id === stageId);
              if (!feature) return null;

              return (
                <ShowcaseItem
                  key={stageId}
                  feature={feature}
                  active={active}
                  observe={observe}
                  desktop={desktopLayout}
                  onActivate={setActiveStageId}
                />
              );
            })}
          </Box>

          <Box
            sx={{
              position: 'sticky',
              top: 88,
              minWidth: 0,
              display: 'grid',
              gridTemplateColumns: productWorkspaceGeometry.stickyGridTemplateColumns,
              alignItems: 'center',
              gap: productWorkspaceGeometry.stickyGap,
              '@media (max-height: 680px)': {
                position: 'relative',
                top: 'auto',
              },
            }}
          >
            <ProductWorkspace activeStageId={showcaseViewModel.workspaceStageId} />
            <AgentTrace
              stages={PRODUCT_STAGES}
              activeStageId={showcaseViewModel.workspaceStageId}
              variant="workspace"
              ariaLabel="Product workspace progression"
            />
          </Box>
        </Box>

        <Box sx={{ display: landingPresentationSx.productShowcase.mobileDisplay, mt: 3 }}>
          {showcaseViewModel.mobileItems.map(({ stageId, kind, active }) => {
            const stage = PRODUCT_STAGES.find(({ id }) => id === stageId);
            if (!stage) return null;

            if (kind === 'narrative') {
              return (
                <ShowcaseItem
                  key={`${stageId}-${kind}`}
                  feature={stage}
                  active={active}
                  onActivate={setActiveStageId}
                />
              );
            }

            return (
              <Box key={`${stageId}-${kind}`} sx={{ mb: 5, minWidth: 0 }}>
                <ProductWorkspace activeStageId={stageId} compact />
              </Box>
            );
          })}
        </Box>
      </Container>
    </LandingSection>
  );
}
