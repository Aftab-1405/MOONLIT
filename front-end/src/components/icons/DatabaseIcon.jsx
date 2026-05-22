import { Box } from '@mui/material';
import databaseIcon from './database_icon.png';

function DatabaseIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={databaseIcon}
      alt={alt}
      draggable={false}
      sx={{
        width: '1em',
        height: '1em',
        objectFit: 'contain',
        display: 'inline-block',
        flexShrink: 0,
        ...sx,
      }}
      {...props}
    />
  );
}

export default DatabaseIcon;
