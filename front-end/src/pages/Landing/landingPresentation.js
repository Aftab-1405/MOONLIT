function normalizeProductStageId(stageId, stages) {
  const fallback = stages[0]?.id ?? '';
  return stages.some(({ id }) => id === stageId) ? stageId : fallback;
}

const WORKSPACE_STAGE_SURFACES = Object.freeze({
  question: Object.freeze({
    primarySurface: 'sql-editor',
    resultSurface: 'result-table',
    activeRegions: Object.freeze(['question']),
  }),
  context: Object.freeze({
    primarySurface: 'sql-editor',
    resultSurface: 'result-table',
    activeRegions: Object.freeze(['context']),
  }),
  schema: Object.freeze({
    primarySurface: 'schema-relationship',
    resultSurface: 'result-table',
    activeRegions: Object.freeze(['schema-explorer', 'schema-relationship']),
  }),
  sql: Object.freeze({
    primarySurface: 'sql-editor',
    resultSurface: 'result-table',
    activeRegions: Object.freeze(['sql-editor']),
  }),
  execution: Object.freeze({
    primarySurface: 'sql-editor',
    resultSurface: 'result-table',
    activeRegions: Object.freeze(['agent-tool', 'execution-status', 'result-table']),
  }),
  artifact: Object.freeze({
    primarySurface: 'sql-editor',
    resultSurface: 'artifact',
    activeRegions: Object.freeze(['artifact']),
  }),
});

const PRODUCT_WORKSPACE_GEOMETRY = Object.freeze({
  containerGutter: 24,
  showcaseGapPx: 16,
  visualFraction: 0.76,
  stickyGapPx: 8,
  traceMinWidth: 128,
  traceFraction: 0.2,
  contextMinWidth: 96,
  contextFraction: 0.24,
  surfacePaddingPx: 16,
  surfaceGapPx: 8,
  schemaMinWidth: 80,
  schemaFraction: 0.32,
  minimumEditorWidth: 180,
});

export function getProductWorkspaceViewModel(activeStageId, stages) {
  const stageId = normalizeProductStageId(activeStageId, stages);
  const surfaces = WORKSPACE_STAGE_SURFACES[stageId] ?? WORKSPACE_STAGE_SURFACES.question;

  return Object.freeze({
    stageId,
    compactSurface: stageId,
    primarySurface: surfaces.primarySurface,
    resultSurface: surfaces.resultSurface,
    activeRegions: surfaces.activeRegions,
  });
}

export function getProductWorkspaceGeometry(viewportWidth) {
  let measurement;

  if (Number.isFinite(viewportWidth)) {
    const containerWidth = Math.max(
      0,
      viewportWidth - PRODUCT_WORKSPACE_GEOMETRY.containerGutter * 2,
    );
    const showcaseWidth = Math.max(0, containerWidth - PRODUCT_WORKSPACE_GEOMETRY.showcaseGapPx);
    const stickyWidth = showcaseWidth * PRODUCT_WORKSPACE_GEOMETRY.visualFraction;
    const stickyContentWidth = Math.max(0, stickyWidth - PRODUCT_WORKSPACE_GEOMETRY.stickyGapPx);
    const traceWidth = Math.max(
      PRODUCT_WORKSPACE_GEOMETRY.traceMinWidth,
      stickyContentWidth * PRODUCT_WORKSPACE_GEOMETRY.traceFraction,
    );
    const workspaceWidth = Math.max(0, stickyContentWidth - traceWidth);
    const contextWidth = Math.max(
      PRODUCT_WORKSPACE_GEOMETRY.contextMinWidth,
      workspaceWidth * PRODUCT_WORKSPACE_GEOMETRY.contextFraction,
    );
    const workspaceSurfaceWidth = Math.max(0, workspaceWidth - contextWidth);
    const surfaceContentWidth = Math.max(
      0,
      workspaceSurfaceWidth - PRODUCT_WORKSPACE_GEOMETRY.surfacePaddingPx,
    );
    const schemaWidth = Math.max(
      PRODUCT_WORKSPACE_GEOMETRY.schemaMinWidth,
      surfaceContentWidth * PRODUCT_WORKSPACE_GEOMETRY.schemaFraction,
    );
    const editorWidth = Math.max(
      0,
      surfaceContentWidth - schemaWidth - PRODUCT_WORKSPACE_GEOMETRY.surfaceGapPx,
    );

    measurement = Object.freeze({
      workspaceWidth: Math.round(workspaceWidth),
      traceWidth: Math.round(traceWidth),
      editorWidth: Math.round(editorWidth),
      fits: editorWidth >= PRODUCT_WORKSPACE_GEOMETRY.minimumEditorWidth,
    });
  }

  return Object.freeze({
    showcaseGridTemplateColumns: 'minmax(0, 0.48fr) minmax(0, 1.52fr)',
    showcaseGap: 2,
    stickyGridTemplateColumns: 'minmax(0, 1fr) minmax(128px, 0.25fr)',
    stickyGap: 1,
    workspaceGridTemplateColumns: 'minmax(96px, 24%) minmax(0, 1fr)',
    surfaceGridTemplateColumns: 'minmax(80px, 32%) minmax(0, 1fr)',
    measurement,
  });
}

function getProductStageIndex(stageId, stages) {
  const normalized = normalizeProductStageId(stageId, stages);
  return Math.max(
    0,
    stages.findIndex(({ id }) => id === normalized),
  );
}

function getTraceStageState(activeStageId, stageId, stages) {
  const activeIndex = getProductStageIndex(activeStageId, stages);
  const stageIndex = getProductStageIndex(stageId, stages);
  if (stageIndex < activeIndex) return 'complete';
  if (stageIndex === activeIndex) return 'active';
  return 'upcoming';
}

const TRACE_STATE_LABELS = Object.freeze({
  complete: 'Complete',
  active: 'Active',
  upcoming: 'Upcoming',
});

export function getTraceViewModel({ stages, activeStageId = stages[0]?.id, variant = 'hero' }) {
  const normalizedVariant = variant === 'workspace' ? 'workspace' : 'hero';

  return Object.freeze({
    variant: normalizedVariant,
    density: normalizedVariant === 'workspace' ? 'compact' : 'spacious',
    contentMode: normalizedVariant === 'workspace' ? 'status' : 'narrative',
    stages: Object.freeze(
      stages.map((stage) => {
        const state = getTraceStageState(activeStageId, stage.id, stages);

        return Object.freeze({
          ...stage,
          state,
          stateLabel: TRACE_STATE_LABELS[state],
          ariaCurrent: state === 'active' ? 'step' : undefined,
        });
      }),
    ),
  });
}

function getMobileProductSequence(stages) {
  return stages.flatMap(({ id }) => [
    Object.freeze({ stageId: id, kind: 'narrative' }),
    Object.freeze({ stageId: id, kind: 'visual' }),
  ]);
}

export function getProductShowcaseViewModel({
  stages,
  activeStageId = stages[0]?.id,
  observerAvailable,
}) {
  const fallbackStageId = stages[0]?.id ?? '';
  const normalizedStageId = normalizeProductStageId(activeStageId, stages);
  const workspaceStageId = observerAvailable ? normalizedStageId : fallbackStageId;

  return Object.freeze({
    workspaceStageId,
    desktopItems: Object.freeze(
      stages.map(({ id }) =>
        Object.freeze({
          stageId: id,
          active: !observerAvailable || id === workspaceStageId,
          observe: Boolean(observerAvailable),
        }),
      ),
    ),
    mobileItems: Object.freeze(
      getMobileProductSequence(stages).map((item) => Object.freeze({ ...item, active: true })),
    ),
  });
}

export function getWorkspaceSurfaceMotion(prefersReducedMotion = false) {
  return Object.freeze({
    initial: prefersReducedMotion ? false : Object.freeze({ opacity: 0.86, y: 8 }),
    animate: Object.freeze({ opacity: 1, y: 0 }),
    transition: prefersReducedMotion
      ? Object.freeze({ duration: 0 })
      : Object.freeze({ duration: 0.18, ease: 'easeOut' }),
  });
}

export function getLandingPresentationSx() {
  return {
    section: {
      position: 'relative',
      width: '100%',
      px: 0,
      py: { xs: 6, md: 8 },
      scrollMarginTop: '72px',
      overflow: 'clip',
    },
    hero: {
      position: 'relative',
      minHeight: { md: 'calc(100dvh - 64px)' },
      display: 'flex',
      alignItems: 'center',
      px: 0,
      py: { xs: 8, md: 8 },
      overflow: 'clip',
    },
    heroActions: { xs: 'column', md: 'row' },
    heroGrid: {
      xs: 'minmax(0, 1fr)',
      md: 'minmax(0, 7fr) minmax(280px, 5fr)',
    },
    traceDesktop: {
      display: { xs: 'none', md: 'grid' },
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      gridTemplateRows: 'repeat(6, minmax(72px, auto))',
    },
    traceMobile: {
      display: { xs: 'grid', md: 'none' },
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'repeat(6, minmax(0, auto))',
    },
    mockup: {
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'border.subtle',
      borderRadius: '8px',
      backgroundColor: 'background.paper',
      boxShadow: 'none',
      pointerEvents: 'none',
    },
    workspace: {
      headerDividerWidth: '1px',
      relationshipNodeWidth: { full: 106, compact: 136 },
      desktopFrameMinHeight: 584,
    },
    productShowcase: {
      desktopDisplay: { xs: 'none', md: 'grid' },
      mobileDisplay: { xs: 'block', md: 'none' },
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      backgroundColor: 'background.default',
      borderBottom: '1px solid',
      borderColor: 'border.subtle',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
    footer: {
      px: 0,
      py: 6,
      borderTop: '1px solid',
      borderColor: 'border.subtle',
    },
  };
}
