import { Box } from '@mui/material';
import newChatIcon from './new_chat.png';

function NewChatIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={newChatIcon}
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

export default NewChatIcon;
