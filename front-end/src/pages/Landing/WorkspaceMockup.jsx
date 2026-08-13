import { Box, Stack, Typography } from '@mui/material';

const MOCK_QUERY = `SELECT r.name AS region, SUM(o.total) AS revenue
FROM orders AS o
JOIN regions AS r ON o.region_id = r.id
WHERE o.ordered_at >= date_trunc('year', CURRENT_DATE)
GROUP BY r.name
ORDER BY revenue DESC;`;

const RESULT_ROWS = [
  ['North America', '$842,190'],
  ['Europe', '$618,420'],
  ['Asia Pacific', '$507,860'],
];

export default function WorkspaceMockup({ activeFeature = 'query', compact = false }) {
  const activeBorder = (feature) => (activeFeature === feature ? 'identity.accent.twilight' : 'border.subtle');

  return (
    <Box
      aria-hidden="true"
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: { xs: '10px', md: '14px' },
        bgcolor: 'background.paper',
        boxShadow: '0 36px 90px rgba(0, 0, 0, 0.48)',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Typography sx={(theme) => theme.typography.captionMonoSm}>Moonlit</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}>
            PostgreSQL connected
          </Typography>
        </Stack>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : { xs: '1fr', md: '0.8fr 1.2fr' },
          minHeight: { xs: 360, md: 520 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: { xs: 2, md: 3 },
            borderRight: { md: '1px solid' },
            borderColor: { md: activeBorder('query') },
          }}
        >
          <Box sx={{ alignSelf: 'flex-end', maxWidth: '88%', p: 1.5, borderRadius: '10px 10px 2px 10px', bgcolor: 'layer.soft' }}>
            <Typography sx={(theme) => theme.typography.bodySm}>Show revenue by region for this year</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: '1px solid', borderColor: activeBorder('query'), borderRadius: '2px 10px 10px' }}>
            <Typography sx={(theme) => ({ ...theme.typography.bodySm, color: 'text.secondary' })}>
              I found the relevant orders and regions tables. Here is a read-only query you can review.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gap: 1.5, p: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Box sx={{ p: 1.5, border: '1px solid', borderColor: activeBorder('schema'), borderRadius: '8px', bgcolor: 'background.sunken' }}>
            <Typography sx={(theme) => theme.typography.captionMonoSm}>orders</Typography>
            <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.5, color: 'text.disabled' })}>
              id · region_id · total · ordered_at
            </Typography>
            <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 1.25 })}>regions</Typography>
            <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, mt: 0.5, color: 'text.disabled' })}>
              id · name
            </Typography>
          </Box>
          <Box
            component="pre"
            sx={(theme) => ({
              m: 0,
              p: { xs: 1.5, sm: 2 },
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              border: '1px solid',
              borderColor: activeBorder('sql'),
              borderRadius: '8px',
              bgcolor: 'background.sunken',
              color: 'text.secondary',
              fontFamily: theme.typography.fontFamilyMono,
              fontSize: { xs: '0.68rem', sm: '0.78rem' },
              lineHeight: 1.65,
            })}
          >
            {MOCK_QUERY}
          </Box>
          <Box sx={{ display: { xs: compact ? 'none' : 'block', sm: 'block' }, p: 1.5, border: '1px solid', borderColor: activeBorder('results'), borderRadius: '8px' }}>
            {RESULT_ROWS.map(([region, revenue], index) => (
              <Box key={region} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1, mt: index ? 1.25 : 0 }}>
                <Typography sx={(theme) => theme.typography.uiCaptionXs}>{region}</Typography>
                <Typography sx={(theme) => ({ ...theme.typography.uiCaptionXs, color: 'text.secondary' })}>{revenue}</Typography>
                <Box sx={{ gridColumn: '1 / -1', width: `${92 - index * 18}%`, height: 3, borderRadius: 999, bgcolor: 'identity.accent.breeze' }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
