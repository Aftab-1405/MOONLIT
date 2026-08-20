import { Box, Container, Stack, Typography } from '@mui/material';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { PRODUCT_DEMO } from './landingContent';

function ColumnRow({ tableName, column }) {
  const keyMarker =
    column.name === 'id'
      ? 'PK'
      : tableName === 'orders' && column.name === 'region_id'
        ? 'FK'
        : null;

  return (
    <Box
      sx={{
        minHeight: 38,
        display: 'grid',
        gridTemplateColumns: '28px minmax(86px, 1fr) minmax(82px, 0.9fr)',
        alignItems: 'center',
        gap: 1,
        px: { xs: 1.25, sm: 1.5 },
        py: 0.625,
        borderTop: '1px solid',
        borderColor: 'border.subtle',
      }}
    >
      <Typography
        component="span"
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          color: keyMarker ? 'identity.accent.breeze' : 'text.disabled',
          fontFamily: theme.typography.fontFamilyMono,
        })}
      >
        {keyMarker ?? '—'}
      </Typography>
      <Typography
        noWrap
        sx={(theme) => ({
          ...theme.typography.uiCaptionSm,
          minWidth: 0,
          color: 'text.primary',
          fontFamily: theme.typography.fontFamilyMono,
        })}
      >
        {column.name}
      </Typography>
      <Typography
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          minWidth: 0,
          color: 'text.disabled',
          fontFamily: theme.typography.fontFamilyMono,
          lineHeight: 1.35,
          overflowWrap: 'anywhere',
          textAlign: 'right',
        })}
      >
        {column.type}
      </Typography>
    </Box>
  );
}

function SchemaNode({ table }) {
  return (
    <Box
      component="article"
      aria-labelledby={`schema-table-${table.name}`}
      sx={{
        minWidth: 0,
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: '8px',
        backgroundColor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, backgroundColor: 'layer.soft' }}>
        <Typography
          component="h3"
          id={`schema-table-${table.name}`}
          sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.primary' })}
        >
          {table.name}
        </Typography>
        <Typography
          sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 0.25, color: 'text.disabled' })}
        >
          table · {table.columns.length} columns
        </Typography>
      </Box>
      {table.columns.map((column) => (
        <ColumnRow key={`${table.name}-${column.name}`} tableName={table.name} column={column} />
      ))}
    </Box>
  );
}

function RelationshipBridge() {
  const relationship = PRODUCT_DEMO.schema.relationships[0];

  return (
    <Box
      aria-label={`Relationship ${relationship.label}`}
      sx={{
        minWidth: 0,
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 1,
        py: { xs: 1, md: 0 },
      }}
    >
      <Box
        component="svg"
        aria-hidden="true"
        viewBox="0 0 120 20"
        preserveAspectRatio="none"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: '100%',
          height: 20,
          color: 'text.disabled',
        }}
      >
        <Box
          component="path"
          d="M 0 10 H 120 M 112 4 L 120 10 L 112 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </Box>
      <Box sx={{ minWidth: 0, maxWidth: '100%', textAlign: 'center' }}>
        <Typography
          noWrap
          sx={(theme) => ({
            ...theme.typography.uiCaptionXs,
            color: 'identity.accent.breeze',
            fontFamily: theme.typography.fontFamilyMono,
            fontSize: '0.625rem',
            letterSpacing: 0,
          })}
        >
          {relationship.from}
        </Typography>
        <Typography
          noWrap
          sx={(theme) => ({
            ...theme.typography.uiCaptionXs,
            color: 'identity.accent.breeze',
            fontFamily: theme.typography.fontFamilyMono,
            fontSize: '0.625rem',
            letterSpacing: 0,
          })}
        >
          → {relationship.to}
        </Typography>
      </Box>
      <Typography
        sx={(theme) => ({
          ...theme.typography.captionMonoSm,
          display: { xs: 'block', md: 'none' },
          color: 'text.disabled',
          textAlign: 'center',
        })}
      >
        relationship
      </Typography>
    </Box>
  );
}

function TraceMetadata({ number, label, value, state }) {
  return (
    <Box
      data-trace-state={state}
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 1,
        py: 1.25,
        borderTop: '1px solid',
        borderColor: 'border.subtle',
      }}
    >
      <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}>
        {number}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
          {label}
        </Typography>
        <Typography
          sx={(theme) => ({
            ...theme.typography.uiCaptionXs,
            mt: 0.25,
            color: 'text.secondary',
            overflowWrap: 'anywhere',
          })}
        >
          {value}
        </Typography>
      </Box>
      <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.disabled' })}>
        {state}
      </Typography>
    </Box>
  );
}

export default function SchemaIntelligenceSection() {
  const [orders, regions] = PRODUCT_DEMO.schema.tables;

  return (
    <LandingSection id="workflow">
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(240px, 1fr)' },
            columnGap: { md: 5 },
            rowGap: { xs: 4, md: 0 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ minWidth: 0, gridColumn: { md: 2 }, gridRow: { md: 1 } }}>
            <SectionHeading
              eyebrow="Schema intelligence"
              title="See the relationship before trusting the query."
              description="Moonlit keeps the connected schema legible: real tables, ordered columns, types, and the key path used by the generated SQL."
            />
            <Stack sx={{ mt: 4 }}>
              <TraceMetadata
                number="02"
                label="Context"
                value={`${PRODUCT_DEMO.database.name} · ${PRODUCT_DEMO.agent.contextStatus}`}
                state="Complete"
              />
              <TraceMetadata
                number="03"
                label={PRODUCT_DEMO.schema.label}
                value={`${PRODUCT_DEMO.schema.tables.length} tables · relationship resolved`}
                state="Active"
              />
            </Stack>
          </Box>

          <Reveal sx={{ minWidth: 0, gridColumn: { md: 1 }, gridRow: { md: 1 } }}>
            <Box
              sx={{
                minWidth: 0,
                p: { xs: 1.5, sm: 2, md: 3 },
                border: '1px solid',
                borderColor: 'border.subtle',
                borderRadius: '8px',
                backgroundColor: 'background.sunken',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                  pb: 2,
                }}
              >
                <Box>
                  <Typography
                    sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.primary' })}
                  >
                    {PRODUCT_DEMO.database.name}
                  </Typography>
                  <Typography
                    sx={(theme) => ({
                      ...theme.typography.captionMonoSm,
                      mt: 0.25,
                      color: 'text.disabled',
                    })}
                  >
                    {PRODUCT_DEMO.database.engine} · schema map
                  </Typography>
                </Box>
                <Typography
                  sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.secondary' })}
                >
                  PK primary · FK foreign
                </Typography>
              </Box>

              <Box
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'minmax(0, 1fr) minmax(124px, 0.38fr) minmax(0, 1fr)',
                  },
                  alignItems: 'center',
                  gap: { xs: 1, md: 0 },
                }}
              >
                <SchemaNode table={orders} />
                <RelationshipBridge />
                <SchemaNode table={regions} />
              </Box>
            </Box>
          </Reveal>
        </Box>
      </Container>
    </LandingSection>
  );
}
