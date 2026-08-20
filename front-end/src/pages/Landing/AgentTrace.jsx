import { Box, Typography } from '@mui/material';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { getFlowPathSx, getStagePulseSx } from './landingAnimations';
import { getLandingPresentationSx, getTraceViewModel } from './landingPresentation';

const landingPresentationSx = getLandingPresentationSx();

const DESKTOP_STAGE_LAYOUT = [
  { gridColumn: '1 / span 8', gridRow: '1' },
  { gridColumn: '5 / span 8', gridRow: '2' },
  { gridColumn: '2 / span 9', gridRow: '3' },
  { gridColumn: '6 / span 7', gridRow: '4' },
  { gridColumn: '3 / span 9', gridRow: '5' },
  { gridColumn: '7 / span 6', gridRow: '6' },
];

const WORKSPACE_STAGE_LAYOUT = [
  { gridColumn: '1 / span 12', gridRow: '1' },
  { gridColumn: '3 / span 10', gridRow: '2' },
  { gridColumn: '1 / span 12', gridRow: '3' },
  { gridColumn: '3 / span 10', gridRow: '4' },
  { gridColumn: '1 / span 12', gridRow: '5' },
  { gridColumn: '3 / span 10', gridRow: '6' },
];

const MOBILE_STAGE_OFFSETS = ['0%', '12%', '4%', '16%', '8%', '20%'];

function getDesktopStageLayout(index, compact) {
  const stageLayout = compact ? WORKSPACE_STAGE_LAYOUT : DESKTOP_STAGE_LAYOUT;

  return (
    stageLayout[index] ?? {
      gridColumn: `${(index % 6) + 1} / span 6`,
      gridRow: `${index + 1}`,
    }
  );
}

export default function AgentTrace({
  stages,
  activeStageId = stages[0]?.id,
  variant = 'hero',
  ariaLabel = 'Moonlit agent path',
}) {
  const trace = getTraceViewModel({ stages, activeStageId, variant });
  const isWorkspace = trace.density === 'compact';
  const isStatusOnly = trace.contentMode === 'status';

  return (
    <Box
      component="ol"
      role="list"
      aria-label={ariaLabel}
      data-trace-variant={trace.variant}
      sx={{
        position: 'relative',
        isolation: 'isolate',
        display: {
          xs: landingPresentationSx.traceMobile.display.xs,
          md: landingPresentationSx.traceDesktop.display.md,
        },
        gridTemplateColumns: {
          xs: landingPresentationSx.traceMobile.gridTemplateColumns,
          md: landingPresentationSx.traceDesktop.gridTemplateColumns,
        },
        gridTemplateRows: {
          xs: landingPresentationSx.traceMobile.gridTemplateRows,
          md: landingPresentationSx.traceDesktop.gridTemplateRows,
        },
        gap: { xs: isWorkspace ? 1 : 1.5, md: 0 },
        minHeight: { md: isWorkspace ? 420 : 520 },
        m: 0,
        p: 0,
        listStyle: 'none',
      }}
    >
      {/* SVG connector path with animated flow dashes */}
      <Box
        component="svg"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          display: { xs: 'none', md: 'block' },
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Static connector line */}
        <Box
          component="path"
          d={
            isWorkspace
              ? 'M 20 8 L 34 24 L 22 41 L 38 58 L 24 75 L 40 92'
              : 'M 8 8 L 42 24 L 17 41 L 58 58 L 25 75 L 59 92'
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          sx={{ color: 'border.subtle' }}
        />
        {/* Animated flow overlay */}
        <Box
          component="path"
          d={
            isWorkspace
              ? 'M 20 8 L 34 24 L 22 41 L 38 58 L 24 75 L 40 92'
              : 'M 8 8 L 42 24 L 17 41 L 58 58 L 25 75 L 59 92'
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          sx={{
            color: 'text.disabled',
            opacity: 0.5,
            ...getFlowPathSx(),
          }}
        />
      </Box>

      {trace.stages.map((stage, index) => {
        const stageLayout = getDesktopStageLayout(index, isWorkspace);

        return (
          <Box
            component="li"
            key={stage.id}
            aria-current={stage.ariaCurrent}
            data-trace-state={stage.state}
            data-trace-stage={stage.id}
            sx={{
              position: 'relative',
              zIndex: 1,
              gridColumn: { xs: '1 / -1', md: stageLayout.gridColumn },
              gridRow: { xs: index + 1, md: stageLayout.gridRow },
              width: { xs: `calc(100% - ${MOBILE_STAGE_OFFSETS[index] ?? '0%'})`, md: 'auto' },
              ml: { xs: MOBILE_STAGE_OFFSETS[index] ?? 0, md: 0 },
              alignSelf: 'center',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: isWorkspace
                  ? '16px 10px minmax(0, 1fr)'
                  : '28px 12px minmax(0, 1fr)',
                columnGap: isWorkspace ? 0.375 : 1.25,
                alignItems: 'start',
                py: isWorkspace ? 0.5 : 1,
                backgroundColor: 'background.default',
              }}
            >
              <Typography
                aria-hidden="true"
                sx={(theme) => ({
                  ...theme.typography.captionMonoSm,
                  color: stage.state === 'active' ? 'text.primary' : 'text.secondary',
                  transition: 'color 0.3s ease',
                  [REDUCED_MOTION_QUERY]: { transition: 'none' },
                })}
              >
                {stage.number}
              </Typography>

              {/* Stage indicator dot with pulse ring on active */}
              <Box
                aria-hidden="true"
                sx={{
                  position: 'relative',
                  width: stage.state === 'active' ? 12 : 8,
                  height: stage.state === 'active' ? 12 : 8,
                  mt: 0.25,
                  border: '1px solid',
                  borderColor: stage.state === 'upcoming' ? 'text.disabled' : 'text.primary',
                  borderRadius: '9999px',
                  backgroundColor: stage.state === 'active' ? 'text.primary' : 'background.default',
                  transition:
                    'width 180ms ease, height 180ms ease, background-color 180ms ease, border-color 180ms ease',
                  [REDUCED_MOTION_QUERY]: { transition: 'none' },
                  ...getStagePulseSx(stage.state === 'active'),
                }}
              />

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.captionMonoSm,
                    color: stage.state === 'active' ? 'text.primary' : 'text.secondary',
                    textTransform: 'uppercase',
                    overflowWrap: isStatusOnly ? 'anywhere' : 'normal',
                    transition: 'color 0.3s ease',
                    [REDUCED_MOTION_QUERY]: { transition: 'none' },
                  })}
                >
                  {stage.eyebrow}
                </Typography>
                {isStatusOnly ? null : (
                  <Typography
                    sx={(theme) => ({
                      ...theme.typography.bodyMd,
                      mt: 0.5,
                      color: stage.state === 'upcoming' ? 'text.secondary' : 'text.primary',
                      textWrap: 'balance',
                      transition: 'color 0.3s ease',
                      [REDUCED_MOTION_QUERY]: { transition: 'none' },
                    })}
                  >
                    {stage.title}
                  </Typography>
                )}
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.captionMonoSm,
                    mt: isWorkspace ? 0.25 : 0.75,
                    color: stage.state === 'active' ? 'text.primary' : 'text.secondary',
                    overflowWrap: isStatusOnly ? 'anywhere' : 'normal',
                    transition: 'color 0.3s ease',
                    [REDUCED_MOTION_QUERY]: { transition: 'none' },
                  })}
                >
                  {stage.stateLabel}
                  {isStatusOnly ? '' : ` · ${stage.metadata}`}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
