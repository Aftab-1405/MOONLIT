import { Box } from '@mui/material';
import codeEditorIcon from './code_editor_icon.png';

function CodeEditorIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={codeEditorIcon}
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

export default CodeEditorIcon;
