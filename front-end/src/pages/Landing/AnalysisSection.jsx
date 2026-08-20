import { Box, Container, Stack, Typography } from '@mui/material';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { PRODUCT_DEMO } from './landingContent';

const PERSPECTIVE_CONFIG_LABELS = [
  'Datagrid',
  'Columns 3',
  'Group by',
  'Split by',
  'Filter',
  'Sort',
];

function ResultValue({ value, columnName, muted = false }) {
  const formattedValue =
    columnName === 'revenue' && typeof value === 'number'
      ? `$${value.toLocaleString('en-US')}`
      : typeof value === 'number'
        ? value.toLocaleString('en-US')
        : String(value);

  return (
    <Typography
      role="cell"
      noWrap
      sx={(theme) => ({
        ...theme.typography.uiCaptionXs,
        minWidth: 0,
        px: { xs: 1, sm: 1.5 },
        color: muted ? 'text.secondary' : 'text.primary',
        fontFamily: theme.typography.fontFamilyMono,
        fontVariantNumeric: 'tabular-nums',
      })}
    >
      {formattedValue}
    </Typography>
  );
}

function DataGrid({ compact = false }) {
  return (
    <Box
      role="table"
      aria-label={compact ? 'Returned query rows' : 'Perspective Datagrid representation'}
      sx={{ minWidth: compact ? 560 : 520, fontVariantNumeric: 'tabular-nums' }}
    >
      <Box
        role="row"
        sx={{
          minHeight: 39,
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr 0.8fr',
          alignItems: 'center',
          backgroundColor: 'layer.faint',
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        {PRODUCT_DEMO.results.columns.map((column) => (
          <Box role="columnheader" key={column.name} sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 } }}>
            <Typography
              noWrap
              sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}
            >
              {column.name}
            </Typography>
            {compact ? (
              <Typography
                noWrap
                sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.disabled' })}
              >
                {column.type}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>

      {PRODUCT_DEMO.results.rows.map((row) => (
        <Box
          role="row"
          key={`${compact ? 'result' : 'artifact'}-${String(row[0])}`}
          sx={{
            minHeight: 38,
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr 0.8fr',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
            '&:last-of-type': { borderBottom: 0 },
          }}
        >
          {row.map((value, columnIndex) => (
            <ResultValue
              key={PRODUCT_DEMO.results.columns[columnIndex].name}
              value={value}
              columnName={PRODUCT_DEMO.results.columns[columnIndex].name}
              muted={compact}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

function RevenueProfile() {
  const maxRevenue = Math.max(...PRODUCT_DEMO.results.rows.map((row) => row[1]));

  return (
    <Box sx={{ minWidth: 0, p: { xs: 1.5, sm: 2 } }}>
      <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
        Revenue by region
      </Typography>
      <Typography
        sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 0.25, color: 'text.disabled' })}
      >
        analytical view of returned rows
      </Typography>

      <Stack spacing={2} sx={{ mt: 3 }}>
        {PRODUCT_DEMO.results.rows.map(([region, revenue]) => (
          <Box key={region} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography
                noWrap
                sx={(theme) => ({
                  ...theme.typography.uiCaptionXs,
                  minWidth: 0,
                  color: 'text.secondary',
                })}
              >
                {region}
              </Typography>
              <Typography
                sx={(theme) => ({
                  ...theme.typography.uiCaptionXs,
                  flexShrink: 0,
                  color: 'text.primary',
                  fontFamily: theme.typography.fontFamilyMono,
                  fontVariantNumeric: 'tabular-nums',
                })}
              >
                ${revenue.toLocaleString('en-US')}
              </Typography>
            </Box>
            <Box
              sx={{ height: 8, mt: 0.75, backgroundColor: 'layer.soft', borderRadius: '9999px' }}
            >
              <Box
                sx={{
                  width: `${(revenue / maxRevenue) * 100}%`,
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: 'identity.accent.breeze',
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function PerspectiveArtifact() {
  return (
    <Box sx={{ minWidth: 0, borderTop: '1px solid', borderColor: 'border.subtle' }}>
      <Box
        sx={{
          minHeight: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.primary' })}>
            {PRODUCT_DEMO.artifact.title}
          </Typography>
          <Typography
            sx={(theme) => ({
              ...theme.typography.captionMonoSm,
              mt: 0.25,
              color: 'text.disabled',
            })}
          >
            FINOS Perspective workspace
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          {PRODUCT_DEMO.artifact.controls.slice(0, 3).map((label) => (
            <Box
              key={label}
              title={label}
              sx={{ width: 7, height: 7, borderRadius: '9999px', bgcolor: 'text.disabled' }}
            />
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          minHeight: 44,
          overflowX: 'auto',
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
          backgroundColor: 'background.sunken',
          overscrollBehaviorX: 'contain',
        }}
      >
        {PERSPECTIVE_CONFIG_LABELS.map((label, index) => (
          <Typography
            noWrap
            key={label}
            sx={(theme) => ({
              ...theme.typography.uiCaptionXs,
              flexShrink: 0,
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

      <Box
        sx={{
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 1.55fr) minmax(240px, 0.65fr)',
          },
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            p: { xs: 1, sm: 2 },
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
          }}
        >
          <DataGrid />
        </Box>
        <Box
          sx={{
            minWidth: 0,
            borderTop: { xs: '1px solid', md: 0 },
            borderLeft: { xs: 0, md: '1px solid' },
            borderColor: 'border.subtle',
            backgroundColor: 'layer.faint',
          }}
        >
          <RevenueProfile />
        </Box>
      </Box>
    </Box>
  );
}

export default function AnalysisSection() {
  return (
    <LandingSection>
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(12, minmax(0, 1fr))' },
            alignItems: 'end',
            gap: { xs: 3, md: 2 },
          }}
        >
          <Box sx={{ minWidth: 0, gridColumn: { md: '1 / span 7' } }}>
            <SectionHeading
              eyebrow="Analysis artifact"
              title="Returned rows become an inspectable workspace."
              description="The same revenue-by-region result continues from the inline table into Query Results—then into a representation derived from Moonlit's FINOS Perspective workspace."
            />
          </Box>
          <Box sx={{ minWidth: 0, gridColumn: { md: '9 / -1' }, pb: { md: 0.5 } }}>
            <Typography
              sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
            >
              05 → 06 / result to artifact
            </Typography>
            <Typography
              sx={(theme) => ({ ...theme.typography.bodySm, mt: 1, color: 'text.secondary' })}
            >
              A static product representation, not a live analysis session.
            </Typography>
          </Box>
        </Box>

        <Reveal sx={{ mt: { xs: 4, md: 6 }, minWidth: 0 }}>
          <Box
            sx={{
              minWidth: 0,
              border: '1px solid',
              borderColor: 'border.subtle',
              borderRadius: '8px',
              backgroundColor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ minWidth: 0, p: { xs: 1, sm: 2 }, backgroundColor: 'background.sunken' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: { xs: 0.5, sm: 0 },
                  pb: 1.25,
                }}
              >
                <Typography
                  sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}
                >
                  Query result
                </Typography>
                <Typography
                  sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
                >
                  {PRODUCT_DEMO.results.rowCount} rows · {PRODUCT_DEMO.results.executionTimeMs} ms
                </Typography>
              </Box>
              <Box sx={{ minWidth: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
                <DataGrid compact />
              </Box>
            </Box>

            <Box
              aria-hidden="true"
              sx={{
                minHeight: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                borderTop: '1px solid',
                borderColor: 'border.subtle',
              }}
            >
              <Typography
                sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
              >
                open as artifact
              </Typography>
              <Typography
                sx={(theme) => ({
                  ...theme.typography.captionMonoSm,
                  color: 'identity.accent.breeze',
                })}
              >
                ↓
              </Typography>
            </Box>

            <PerspectiveArtifact />
          </Box>
        </Reveal>
      </Container>
    </LandingSection>
  );
}
