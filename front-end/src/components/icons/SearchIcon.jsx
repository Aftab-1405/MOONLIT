import { Box } from '@mui/material';
import searchIcon from './search_icon.png';

function SearchIcon({ sx = {}, alt = '', ...props }) {
  return (
    <Box
      component="img"
      src={searchIcon}
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

export default SearchIcon;
