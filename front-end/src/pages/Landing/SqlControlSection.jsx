import { Box, Container, Stack, Typography } from '@mui/material';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { PRODUCT_DEMO } from './landingContent';

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

function SqlLine({ line, lineNumber }) {
  const tokens = line.split(
    /\b(SELECT|FROM|JOIN|ON|WHERE|GROUP|BY|ORDER|DESC|AS|SUM|COUNT|CURRENT_DATE)\b/g,
  );

  return (
    <Box
      sx={{
        minWidth: 'max-content',
        display: 'grid',
        gridTemplateColumns: '42px minmax(640px, 1fr)',
        minHeight: 30,
      }}
    >
      <Typography
        component="span"
        aria-hidden="true"
        sx={(theme) => ({
          ...theme.typography.uiCaptionXs,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          pr: 1.5,
          color: 'text.disabled',
          backgroundColor: 'layer.faint',
          fontFamily: theme.typography.fontFamilyMono,
          userSelect: 'none',
        })}
      >
        {lineNumber}
      </Typography>
      <Box
        component="code"
        sx={(theme) => ({
          display: 'block',
          px: 1.5,
          color: 'text.secondary',
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: '0.75rem',
          lineHeight: '30px',
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

function EditorChrome() {
  const lines = PRODUCT_DEMO.query.split('\n');

  return (
    <Box
      aria-label="Static SQL editor representation"
      sx={{
        minWidth: 0,
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: '8px',
        backgroundColor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 1.25, sm: 1.5 },
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: '8px',
            backgroundColor: 'layer.soft',
          }}
        >
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}>
            Query 1
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: '9999px',
              bgcolor: 'success.main',
            }}
          />
          <Typography
            noWrap
            sx={(theme) => ({
              ...theme.typography.uiCaptionXs,
              minWidth: 0,
              color: 'text.secondary',
            })}
          >
            Schema explorer · {PRODUCT_DEMO.schema.tables.length} tables
          </Typography>
        </Stack>
      </Box>

      <Box
        sx={{
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: 1.5,
          backgroundColor: 'background.sunken',
          overscrollBehaviorX: 'contain',
        }}
      >
        {lines.map((line, index) => (
          <SqlLine key={`${index + 1}-${line}`} line={line} lineNumber={index + 1} />
        ))}
      </Box>

      <Box
        sx={{
          minHeight: 52,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) auto',
            md: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          },
          alignItems: 'center',
          gap: 1,
          px: { xs: 1.25, sm: 1.5 },
          borderTop: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
          <Typography
            data-workspace-state="Read only"
            sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'success.main' })}
          >
            {PRODUCT_DEMO.execution.access}
          </Typography>
          <Typography
            noWrap
            sx={(theme) => ({
              ...theme.typography.captionMonoSm,
              display: { xs: 'none', md: 'block' },
              minWidth: 0,
              color: 'text.disabled',
            })}
          >
            {PRODUCT_DEMO.execution.maxRows} rows · {PRODUCT_DEMO.execution.timeoutSeconds}s timeout
          </Typography>
        </Stack>
        <Box
          data-workspace-action="Run query"
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: '8px',
            backgroundColor: 'text.primary',
          }}
        >
          <Typography
            sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'background.default' })}
          >
            {PRODUCT_DEMO.execution.actionLabel}
          </Typography>
        </Box>
        <Typography
          sx={(theme) => ({
            ...theme.typography.captionMonoSm,
            display: { xs: 'none', md: 'block' },
            color: 'text.disabled',
            textAlign: 'right',
          })}
        >
          Ctrl ↵
        </Typography>
      </Box>
    </Box>
  );
}

export default function SqlControlSection() {
  return (
    <LandingSection>
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(240px, 1fr) minmax(0, 3fr)' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
            >
              04 / SQL visible
            </Typography>
            <SectionHeading
              eyebrow="SQL control"
              title="The generated query stays in the open."
              description="Review the join, aggregation, and date boundary in a familiar editor surface before asking Moonlit to run the read-only query."
            />
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'border.subtle' }}>
              <Typography
                sx={(theme) => ({ ...theme.typography.uiCaptionSm, color: 'text.primary' })}
              >
                Bounded execution
              </Typography>
              <Typography
                sx={(theme) => ({ ...theme.typography.bodySm, mt: 0.75, color: 'text.secondary' })}
              >
                {PRODUCT_DEMO.execution.maxRows.toLocaleString('en-US')} row limit ·{' '}
                {PRODUCT_DEMO.execution.timeoutSeconds} second timeout
              </Typography>
            </Box>
          </Box>

          <Reveal sx={{ minWidth: 0 }}>
            <EditorChrome />
          </Reveal>
        </Box>
      </Container>
    </LandingSection>
  );
}
