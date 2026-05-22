import { Box } from '@mui/material';
import mindmapIcon from './mindmap_icon.png';

function MindmapIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={mindmapIcon}
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

export default MindmapIcon;
