import { Box } from '@mui/material';
import recentChatIcon from './recent_chat_icon.png';

function RecentChatIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={recentChatIcon}
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

export default RecentChatIcon;
