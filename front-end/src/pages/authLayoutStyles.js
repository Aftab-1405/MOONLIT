export function getAuthLayoutSx(theme) {
  const separator = `1px solid ${theme.palette.border.subtle}`;

  return {
    page: {
      height: '100dvh',
      display: 'grid',
      gridTemplateColumns: {
        xs: 'minmax(0, 1fr)',
        md: '44% minmax(0, 56%)',
      },
      overflowY: 'auto',
      backgroundColor: 'background.default',
      color: 'text.primary',
    },
    brandPanel: {
      position: 'relative',
      minWidth: 0,
      minHeight: { xs: 'auto', md: '100%' },
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      px: { xs: 2, sm: 3, md: 5, lg: 7 },
      py: { xs: 3, sm: 4, md: 5 },
      borderRight: { xs: 0, md: separator },
      borderBottom: { xs: separator, md: 0 },
    },
    brandContent: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: 560,
      minHeight: { md: '100%' },
      display: 'flex',
      flexDirection: 'column',
    },
    productBlock: {
      mt: { xs: 4, md: 'auto' },
      mb: { xs: 0, md: 2 },
    },
    desktopProductCopy: {
      display: { xs: 'none', md: 'block' },
    },
    mobileProductCopy: {
      display: { xs: 'block', md: 'none' },
    },
    formPanel: {
      minWidth: 0,
      minHeight: { xs: 'auto', md: '100%' },
      display: 'grid',
      alignItems: { xs: 'start', md: 'center' },
      px: { xs: 2, sm: 3, md: 5, lg: 7 },
      py: { xs: 3, sm: 4, md: 5 },
    },
    formInner: {
      width: '100%',
      maxWidth: 480,
      mx: 'auto',
    },
    orbit: {
      position: 'absolute',
      display: { xs: 'none', md: 'block' },
      width: { md: 320, lg: 420 },
      height: { md: 320, lg: 420 },
      left: { md: -220, lg: -270 },
      bottom: { md: 72, lg: 88 },
      border: separator,
      borderRadius: '50%',
      pointerEvents: 'none',
      animation: 'none',
    },
  };
}
