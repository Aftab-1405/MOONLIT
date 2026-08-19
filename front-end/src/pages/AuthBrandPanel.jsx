import { Box, Button, Typography } from '@mui/material';

const PRODUCT_COPY = 'Agentic workflows, database engineering, and data analysis—without requiring technical expertise.';

function AuthBrandPanel({ actionSx, layoutSx, onNavigateHome }) {
  return (
    <Box component="section" aria-labelledby="auth-product-heading" sx={layoutSx.brandPanel}>
      <Box component="span" aria-hidden="true" sx={layoutSx.orbit} />
      <Box sx={layoutSx.brandContent}>
        <Button
          variant="text"
          onClick={onNavigateHome}
          sx={{
            alignSelf: 'flex-start',
            px: 0,
            borderRadius: 0,
            minHeight: actionSx.minHeight,
          }}
        >
          <Typography sx={(theme) => theme.typography.uiBrandWordmark}>Moonlit</Typography>
        </Button>

        <Box sx={layoutSx.productBlock}>
          <Typography sx={(theme) => ({
            ...theme.typography.captionMonoSm,
            color: 'text.secondary',
            textTransform: 'uppercase',
          })}>
            One intelligent workspace
          </Typography>
          <Typography
            id="auth-product-heading"
            component="h2"
            sx={(theme) => ({
              ...theme.typography.displayMd,
              maxWidth: 520,
              mt: { xs: 1.5, md: 2 },
              textWrap: 'balance',
            })}
          >
            From database to insight, all in one place.
          </Typography>

          <Box sx={layoutSx.desktopProductCopy}>
            <Typography sx={{ maxWidth: 480, mt: 2.5, color: 'text.secondary' }}>
              {PRODUCT_COPY}
            </Typography>
            <Typography sx={(theme) => ({
              ...theme.typography.captionMonoSm,
              mt: 3,
              color: 'text.disabled',
              textTransform: 'uppercase',
            })}>
              Secure by design · Work with confidence
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export { PRODUCT_COPY };
export default AuthBrandPanel;
