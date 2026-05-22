import { Box } from '@mui/material';
import schemaIcon from './schema_icon.png';

function SchemaIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={schemaIcon}
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

export default SchemaIcon;
