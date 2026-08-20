import { Box, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { getAmbientGlowSx } from './landingAnimations';
import { PRODUCT_DEMO, PRODUCT_STAGES } from './landingContent';
import {
  getLandingPresentationSx,
  getProductWorkspaceGeometry,
  getProductWorkspaceViewModel,
  getWorkspaceSurfaceMotion,
} from './landingPresentation';

const landingPresentationSx = getLandingPresentationSx();
const productWorkspaceGeometry = getProductWorkspaceGeometry();
const WORKSPACE_LABELS = Object.freeze({
  schemaExplorer: 'Schema explorer',
  queryTab: 'Query 1',
  readOnly: 'Read only',
  artifactTitle: 'Query Results',
  artifactEntry: 'Datagrid',
});
const SQL_KEYWORDS = new Set([
  'AS',
  'BY',
  'COUNT',
  'CURRENT_DATE',
  'DESC',
  'FROM',
  'GROUP',
  'JOIN',
  'ON',
  'ORDER',
  'SELECT',
  'SUM',
  'WHERE',
]);

function getRegionSx(active, { fill = false } = {}) {
  return {
    border: '1px solid',
    borderColor: active ? 'text.secondary' : 'border.subtle',
    borderRadius: '8px',
    backgroundColor: active ? 'background.paper' : fill ? 'background.sunken' : 'transparent',
    color: active ? 'text.primary' : 'text.secondary',
    opacity: active ? 1 : 0.62,
    transform: 'none',
    transition: 'opacity 180ms ease, border-color 180ms ease, background-color 180ms ease',
    [REDUCED_MOTION_QUERY]: {
      transform: 'none',
      transition: 'none',
    },
  };
}

function SurfaceEntrance({ surfaceKey, kind, children }) {
  const prefersReducedMotion = useReducedMotion();
  const motionContract = getWorkspaceSurfaceMotion(prefersReducedMotion);

  return (
    <Box
      component={motion.div}
      data-workspace-transition={kind}
      data-workspace-surface={surfaceKey}
      initial={motionContract.initial}
      animate={motionContract.animate}
      transition={motionContract.transition}
      sx={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        [REDUCED_MOTION_QUERY]: {
          opacity: '1 !important',
          transform: 'none !important',
          transition: 'none !important',
        },
      }}
    >
      {children}
    </Box>
  );
}

function WorkspaceHeader({ database }) {
  return (
    <Box
      sx={{
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        px: { xs: 1.25, sm: 1.75 },
        borderBottom: '1px solid',
        borderColor: 'border.subtle',
        backgroundColor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
        <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.primary' })}>
          Moonlit
        </Typography>
        <Box
          sx={{
            width: landingPresentationSx.workspace.headerDividerWidth,
            height: 16,
            backgroundColor: 'border.subtle',
            flexShrink: 0,
          }}
        />
        <Typography
          noWrap
          sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}
        >
          {WORKSPACE_LABELS.artifactTitle}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
        <Box sx={{ width: 6, height: 6, borderRadius: '9999px', bgcolor: 'success.main' }} />
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}>
          {database.connectionLabel}
        </Typography>
      </Stack>
    </Box>
  );
}

function RailLabel({ children }) {
  return (
    <Typography
      sx={(theme) => ({
        ...theme.typography.captionMonoSm,
        color: 'text.disabled',
        textTransform: 'uppercase',
      })}
    >
      {children}
    </Typography>
  );
}

function AgentContextRail({ viewModel, compact }) {
  const tableCount = PRODUCT_DEMO.schema.tables.length;
  const columnCount = PRODUCT_DEMO.schema.tables.reduce(
    (total, table) => total + table.columns.length,
    0,
  );
  const isActive = (region) => viewModel.activeRegions.includes(region);

  if (compact) {
    return (
      <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'border.subtle' }}>
        <Box sx={{ ...getRegionSx(isActive('question'), { fill: true }), p: 1.25 }}>
          <RailLabel>Question</RailLabel>
          <Typography sx={(theme) => ({ ...theme.typography.bodySm, mt: 0.75 })}>
            {PRODUCT_DEMO.question}
          </Typography>
        </Box>
        {viewModel.compactSurface === 'context' ? (
          <Box sx={{ ...getRegionSx(true), mt: 1, p: 1.25 }}>
            <RailLabel>Database context</RailLabel>
            <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, mt: 0.75 })}>
              {PRODUCT_DEMO.database.name}
            </Typography>
            <Typography
              sx={(theme) => ({
                ...theme.typography.uiCaptionXs,
                mt: 0.25,
                color: 'text.secondary',
              })}
            >
              {PRODUCT_DEMO.agent.contextStatus} · {tableCount} tables · {columnCount} columns
            </Typography>
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minWidth: 0,
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderRight: '1px solid',
        borderColor: 'border.subtle',
        backgroundColor: 'background.sunken',
      }}
    >
      <Box sx={{ ...getRegionSx(isActive('question'), { fill: true }), p: 1.25 }}>
        <RailLabel>Question</RailLabel>
        <Typography sx={(theme) => ({ ...theme.typography.bodySm, mt: 0.75 })}>
          {PRODUCT_DEMO.question}
        </Typography>
      </Box>

      <Box sx={{ ...getRegionSx(isActive('context')), p: 1.25 }}>
        <RailLabel>Database context</RailLabel>
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, mt: 0.75 })}>
          {PRODUCT_DEMO.database.name}
        </Typography>
        <Typography
          sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.25, color: 'text.secondary' })}
        >
          {PRODUCT_DEMO.agent.contextStatus}
        </Typography>
        <Typography
          sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 0.75, color: 'text.disabled' })}
        >
          {tableCount} tables · {columnCount} columns
        </Typography>
      </Box>

      <Box sx={{ ...getRegionSx(isActive('agent-tool')), mt: 'auto', p: 1.25 }}>
        <RailLabel>Current tool</RailLabel>
        <Typography
          sx={(theme) => ({
            ...theme.typography.uiCaptionXs,
            mt: 0.75,
            fontFamily: theme.typography.fontFamilyMono,
            overflowWrap: 'anywhere',
          })}
        >
          {PRODUCT_DEMO.agent.activeTool}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" mt={0.75}>
          <Box sx={{ width: 6, height: 6, borderRadius: '9999px', bgcolor: 'success.main' }} />
          <Typography
            sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}
          >
            {PRODUCT_DEMO.agent.toolStatus}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function SchemaExplorerPreview({ active, compact = false }) {
  return (
    <Box
      sx={{
        ...getRegionSx(active),
        minWidth: 0,
        height: compact ? 'auto' : '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 46,
          px: 1.25,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.primary' })}>
          {WORKSPACE_LABELS.schemaExplorer}
        </Typography>
        <Typography
          noWrap
          sx={(theme) => ({
            ...theme.typography.uiCaptionXs,
            mt: 0.125,
            color: 'text.disabled',
            fontFamily: theme.typography.fontFamilyMono,
          })}
        >
          {PRODUCT_DEMO.database.name}
        </Typography>
      </Box>

      <Box sx={{ p: 0.75 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minHeight: 30, px: 0.5 }}>
          <Typography
            aria-hidden="true"
            sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
          >
            ▾
          </Typography>
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
            {PRODUCT_DEMO.database.name}
          </Typography>
          <Typography
            sx={(theme) => ({
              ...theme.typography.uiCaptionXs,
              ml: 'auto',
              color: 'text.disabled',
            })}
          >
            {PRODUCT_DEMO.schema.tables.length}
          </Typography>
        </Stack>

        {PRODUCT_DEMO.schema.tables.map((table) => (
          <Box key={table.name} sx={{ mt: 0.25 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ minHeight: 28, pl: 1.5, pr: 0.5 }}
            >
              <Typography
                aria-hidden="true"
                sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
              >
                ▾
              </Typography>
              <Typography
                sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}
              >
                {table.name}
              </Typography>
            </Stack>
            <Box sx={{ pl: compact ? 3.75 : 1.5, pr: 0.5 }}>
              {table.columns.map((column) => (
                <Box
                  key={`${table.name}-${column.name}`}
                  sx={{
                    minHeight: 25,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <Typography
                    noWrap
                    sx={(theme) => ({
                      ...theme.typography.uiCaptionXs,
                      color: 'text.secondary',
                      fontFamily: theme.typography.fontFamilyMono,
                    })}
                  >
                    {column.name}
                  </Typography>
                  <Typography
                    noWrap
                    sx={(theme) => ({
                      ...theme.typography.uiCaptionXs,
                      maxWidth: compact ? 132 : 78,
                      color: 'text.disabled',
                      fontFamily: theme.typography.fontFamilyMono,
                    })}
                  >
                    {column.type}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function RelationshipTableNode({ table, sx }) {
  return (
    <Box sx={{ position: 'absolute', width: 136, p: 1, ...getRegionSx(true), ...sx }}>
      <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.primary' })}>
        {table.name}
      </Typography>
      <Typography
        sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.5, color: 'text.disabled' })}
      >
        {table.columns.length} columns
      </Typography>
      <Typography
        sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.75, color: 'text.secondary' })}
      >
        {table.columns
          .slice(0, 2)
          .map(({ name }) => name)
          .join(' · ')}
      </Typography>
    </Box>
  );
}

function SchemaRelationshipPreview({ active, compact = false }) {
  const [orders, regions] = PRODUCT_DEMO.schema.tables;

  return (
    <Box
      sx={{
        ...getRegionSx(active, { fill: true }),
        position: 'relative',
        height: compact ? 196 : '100%',
        minHeight: 180,
        overflow: 'hidden',
      }}
    >
      <Typography
        sx={(theme) => ({
          ...theme.typography.captionMonoSm,
          position: 'absolute',
          top: 12,
          left: 14,
          color: 'text.disabled',
          textTransform: 'uppercase',
        })}
      >
        Relationship
      </Typography>
      <Box
        component="svg"
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          color: 'text.disabled',
        }}
      >
        <Box
          component="path"
          d="M 36 55 C 48 55, 52 55, 64 55"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
      <RelationshipTableNode
        table={orders}
        sx={{
          left: '7%',
          top: '35%',
          width: compact ? landingPresentationSx.workspace.relationshipNodeWidth.compact : '38%',
          maxWidth:
            landingPresentationSx.workspace.relationshipNodeWidth[compact ? 'compact' : 'full'],
        }}
      />
      <RelationshipTableNode
        table={regions}
        sx={{
          right: '7%',
          top: '35%',
          width: compact ? landingPresentationSx.workspace.relationshipNodeWidth.compact : '38%',
          maxWidth:
            landingPresentationSx.workspace.relationshipNodeWidth[compact ? 'compact' : 'full'],
        }}
      />
      <Typography
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          position: 'absolute',
          left: '50%',
          bottom: 14,
          color: 'text.secondary',
          transform: 'translateX(-50%)',
          width: '90%',
          textAlign: 'center',
          overflowWrap: 'anywhere',
        })}
      >
        {PRODUCT_DEMO.schema.relationships[0].label}
      </Typography>
    </Box>
  );
}

function SqlLine({ line, lineNumber }) {
  const tokens = line.split(
    /\b(SELECT|FROM|JOIN|ON|WHERE|GROUP|BY|ORDER|DESC|AS|SUM|COUNT|CURRENT_DATE)\b/g,
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', minHeight: 21 }}>
      <Typography
        component="span"
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          pr: 1,
          color: 'text.disabled',
          fontFamily: theme.typography.fontFamilyMono,
          textAlign: 'right',
          userSelect: 'none',
        })}
      >
        {lineNumber}
      </Typography>
      <Box
        component="code"
        sx={(theme) => ({
          minWidth: 0,
          color: 'text.secondary',
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: '0.68rem',
          lineHeight: 1.85,
          whiteSpace: 'pre',
        })}
      >
        {tokens.map((token, tokenIndex) => (
          <Box
            component="span"
            key={`${lineNumber}-${tokenIndex}-${token}`}
            sx={{ color: SQL_KEYWORDS.has(token) ? 'identity.accent.breeze' : 'inherit' }}
          >
            {token}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SqlEditorPreview({ active, compact = false }) {
  const lines = PRODUCT_DEMO.query.split('\n');

  return (
    <Box
      sx={{
        ...getRegionSx(active),
        height: '100%',
        minHeight: compact ? 238 : 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Box sx={{ px: 1, py: 0.5, borderRadius: '8px', backgroundColor: 'layer.soft' }}>
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.primary' })}>
            {WORKSPACE_LABELS.queryTab}
          </Typography>
        </Box>
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.disabled' })}>
          Schema
        </Typography>
      </Box>
      <Box
        sx={{
          height: 'calc(100% - 42px)',
          overflow: 'hidden',
          py: 1.25,
          pr: 1.25,
          backgroundColor: 'background.sunken',
        }}
      >
        {lines.map((line, index) => (
          <SqlLine key={`${index + 1}-${line}`} line={line} lineNumber={index + 1} />
        ))}
      </Box>
    </Box>
  );
}

function ExecutionStatusPreview({ active }) {
  return (
    <Box
      sx={{
        ...getRegionSx(active),
        minHeight: 54,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
        alignItems: 'center',
        columnGap: 1,
        px: 1,
        py: 0.375,
        overflow: 'hidden',
      }}
    >
      <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'success.main' })}>
        {WORKSPACE_LABELS.readOnly}
      </Typography>
      <Box
        sx={{
          gridColumn: 2,
          gridRow: 1,
          px: 1.25,
          py: 0.5,
          borderRadius: '8px',
          backgroundColor: 'text.primary',
        }}
      >
        <Typography
          sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'background.default' })}
        >
          {PRODUCT_DEMO.execution.actionLabel}
        </Typography>
      </Box>
      <Typography
        noWrap
        sx={(theme) => ({ ...theme.typography.captionMonoSm, minWidth: 0, color: 'text.disabled' })}
      >
        {PRODUCT_DEMO.execution.maxRows} row limit · {PRODUCT_DEMO.execution.timeoutSeconds}s
        timeout
      </Typography>
      <Typography
        noWrap
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          gridColumn: 2,
          gridRow: 2,
          color: 'text.disabled',
          textAlign: 'right',
        })}
      >
        {PRODUCT_DEMO.execution.states.join(' → ')}
      </Typography>
    </Box>
  );
}

function formatResultValue(value, columnName) {
  if (value === null || value === undefined) return 'NULL';
  if (columnName === 'revenue' && typeof value === 'number')
    return `$${value.toLocaleString('en-US')}`;
  return typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
}

function ResultTablePreview({ active, compact = false }) {
  return (
    <Box
      sx={{
        ...getRegionSx(active),
        height: '100%',
        minHeight: compact ? 192 : 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.25,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
          backgroundColor: 'layer.faint',
        }}
      >
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
          Query result
        </Typography>
        <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}>
          {PRODUCT_DEMO.results.rowCount} rows · {PRODUCT_DEMO.results.executionTimeMs} ms
        </Typography>
      </Box>
      <Box role="table" sx={{ minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>
        <Box
          role="row"
          sx={{
            minHeight: 38,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 0.8fr',
            alignItems: 'center',
            backgroundColor: 'layer.faint',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
          }}
        >
          {PRODUCT_DEMO.results.columns.map((column) => (
            <Box role="columnheader" key={column.name} sx={{ minWidth: 0, px: 1 }}>
              <Typography
                noWrap
                sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}
              >
                {column.name}
              </Typography>
              <Typography
                noWrap
                sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.disabled' })}
              >
                {column.type}
              </Typography>
            </Box>
          ))}
        </Box>
        {PRODUCT_DEMO.results.rows.map((row) => (
          <Box
            role="row"
            key={String(row[0])}
            sx={{
              minHeight: 36,
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 0.8fr',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'border.subtle',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            {row.map((value, columnIndex) => (
              <Typography
                role="cell"
                noWrap
                key={PRODUCT_DEMO.results.columns[columnIndex].name}
                sx={(theme) => ({
                  ...theme.typography.uiCaptionXs,
                  minWidth: 0,
                  px: 1,
                  color: value === null || value === undefined ? 'text.disabled' : 'text.primary',
                  fontFamily: theme.typography.fontFamilyMono,
                  fontStyle: value === null || value === undefined ? 'italic' : 'normal',
                })}
              >
                {formatResultValue(value, PRODUCT_DEMO.results.columns[columnIndex].name)}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function PerspectiveArtifactPreview({ active, compact = false }) {
  const actionLabels = ['Save analysis', 'Copy current view as CSV', 'Reset analysis'];

  return (
    <Box
      sx={{
        ...getRegionSx(active),
        height: '100%',
        minHeight: compact ? 282 : 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
            {WORKSPACE_LABELS.artifactTitle}
          </Typography>
          <Typography
            sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
          >
            PERSPECTIVE
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {actionLabels.map((label) => (
            <Box
              key={label}
              title={label}
              sx={{ width: 6, height: 6, borderRadius: '9999px', bgcolor: 'text.disabled' }}
            />
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
          backgroundColor: 'background.sunken',
        }}
      >
        {[
          WORKSPACE_LABELS.artifactEntry,
          'Columns 3',
          'Group by',
          'Split by',
          'Filter',
          'Sort',
        ].map((label, index) => (
          <Typography
            noWrap
            key={label}
            sx={(theme) => ({
              ...theme.typography.uiCaptionXs,
              px: index === 0 ? 1 : 0,
              py: index === 0 ? 0.5 : 0,
              borderRadius: index === 0 ? '8px' : 0,
              color: index === 0 ? 'text.primary' : 'text.disabled',
              backgroundColor: index === 0 ? 'layer.soft' : 'transparent',
            })}
          >
            {label}
          </Typography>
        ))}
      </Box>

      <Box sx={{ p: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr 0.8fr',
            minHeight: 30,
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
            backgroundColor: 'layer.faint',
          }}
        >
          {PRODUCT_DEMO.results.columns.map((column) => (
            <Typography
              noWrap
              key={column.name}
              sx={(theme) => ({
                ...theme.typography.uiCaptionXs,
                px: 0.75,
                color: 'text.secondary',
              })}
            >
              {column.name}
            </Typography>
          ))}
        </Box>
        {PRODUCT_DEMO.results.rows.map((row) => (
          <Box
            key={`artifact-${String(row[0])}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.25fr 1fr 0.8fr',
              minHeight: 30,
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'border.subtle',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            {row.map((value, columnIndex) => (
              <Typography
                noWrap
                key={`artifact-${PRODUCT_DEMO.results.columns[columnIndex].name}`}
                sx={(theme) => ({
                  ...theme.typography.uiCaptionXs,
                  minWidth: 0,
                  px: 0.75,
                  color: 'text.primary',
                  fontFamily: theme.typography.fontFamilyMono,
                  fontVariantNumeric: 'tabular-nums',
                })}
              >
                {formatResultValue(value, PRODUCT_DEMO.results.columns[columnIndex].name)}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function CompactStageSurface({ surfaceId }) {
  if (surfaceId === 'question') {
    return (
      <Box sx={{ ...getRegionSx(true), p: 1.25 }}>
        <RailLabel>Agent path</RailLabel>
        <Typography
          sx={(theme) => ({ ...theme.typography.uiCaptionSm, mt: 0.75, color: 'text.primary' })}
        >
          Question received
        </Typography>
        <Typography
          sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.5, color: 'text.secondary' })}
        >
          Next: inspect the connected database context.
        </Typography>
      </Box>
    );
  }

  if (surfaceId === 'context') {
    return (
      <Box sx={{ ...getRegionSx(true), p: 1.25 }}>
        <RailLabel>Connection</RailLabel>
        <Stack direction="row" alignItems="center" spacing={0.75} mt={0.75}>
          <Box sx={{ width: 6, height: 6, borderRadius: '9999px', bgcolor: 'success.main' }} />
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
            {PRODUCT_DEMO.database.engine} · {PRODUCT_DEMO.database.name}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (surfaceId === 'schema') {
    return (
      <Box sx={{ display: 'grid', gap: 1 }}>
        <SchemaExplorerPreview active compact />
        <SchemaRelationshipPreview active compact />
      </Box>
    );
  }

  if (surfaceId === 'sql') return <SqlEditorPreview active compact />;

  if (surfaceId === 'execution') {
    return (
      <Box sx={{ display: 'grid', gap: 1 }}>
        <ExecutionStatusPreview active />
        <ResultTablePreview active compact />
      </Box>
    );
  }

  return <PerspectiveArtifactPreview active compact />;
}

function WorkspaceSurface({ viewModel, compact }) {
  if (compact) {
    return (
      <Box sx={{ minWidth: 0, p: 1.25, backgroundColor: 'background.sunken' }}>
        <CompactStageSurface surfaceId={viewModel.compactSurface} />
      </Box>
    );
  }

  const isActive = (region) => viewModel.activeRegions.includes(region);
  const showRelationship = viewModel.primarySurface === 'schema-relationship';
  const showArtifact = viewModel.resultSurface === 'artifact';

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: productWorkspaceGeometry.surfaceGridTemplateColumns,
        gridTemplateRows: 'minmax(0, 1.25fr) 54px minmax(0, 0.75fr)',
        gap: 1,
        p: 1,
        backgroundColor: 'background.sunken',
      }}
    >
      <Box sx={{ minWidth: 0, minHeight: 0, gridColumn: 1, gridRow: 1 }}>
        <SchemaExplorerPreview active={isActive('schema-explorer')} />
      </Box>
      <Box sx={{ minWidth: 0, minHeight: 0, gridColumn: 2, gridRow: 1 }}>
        <SurfaceEntrance
          key={`primary-${viewModel.primarySurface}`}
          surfaceKey={viewModel.primarySurface}
          kind="primary"
        >
          {showRelationship ? (
            <SchemaRelationshipPreview active={isActive('schema-relationship')} />
          ) : (
            <SqlEditorPreview active={isActive('sql-editor')} />
          )}
        </SurfaceEntrance>
      </Box>
      <Box sx={{ minWidth: 0, minHeight: 0, gridColumn: '1 / -1', gridRow: 2 }}>
        <ExecutionStatusPreview active={isActive('execution-status')} />
      </Box>
      <Box sx={{ minWidth: 0, minHeight: 0, gridColumn: '1 / -1', gridRow: 3 }}>
        <SurfaceEntrance
          key={`result-${viewModel.resultSurface}`}
          surfaceKey={viewModel.resultSurface}
          kind="result"
        >
          {showArtifact ? (
            <PerspectiveArtifactPreview active={isActive('artifact')} />
          ) : (
            <ResultTablePreview active={isActive('result-table')} />
          )}
        </SurfaceEntrance>
      </Box>
    </Box>
  );
}

export default function ProductWorkspace({ activeStageId, compact = false }) {
  const viewModel = getProductWorkspaceViewModel(activeStageId, PRODUCT_STAGES);

  return (
    <Box
      aria-hidden="true"
      data-product-stage={viewModel.stageId}
      sx={{
        ...landingPresentationSx.mockup,
        ...getAmbientGlowSx(true),
        width: '100%',
        minWidth: 0,
        height: compact ? 'auto' : landingPresentationSx.workspace.desktopFrameMinHeight,
        minHeight: compact ? 0 : landingPresentationSx.workspace.desktopFrameMinHeight,
      }}
    >
      <WorkspaceHeader database={PRODUCT_DEMO.database} />
      <Box
        data-workspace-layout={compact ? 'compact' : 'full'}
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'minmax(0, 1fr)'
            : productWorkspaceGeometry.workspaceGridTemplateColumns,
          height: compact ? 'auto' : 'calc(100% - 44px)',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <AgentContextRail viewModel={viewModel} compact={compact} />
        <WorkspaceSurface viewModel={viewModel} compact={compact} />
      </Box>
    </Box>
  );
}
