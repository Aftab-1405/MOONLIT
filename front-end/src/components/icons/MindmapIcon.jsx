import SvgIcon from '@mui/material/SvgIcon';

/** Schema mindmap / relationship graph — custom vector in theme `currentColor`. */
function MindmapIcon(props) {
  return (
    <SvgIcon viewBox="0 0 24 24" fontSize="inherit" {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="7" r="2" />
      <circle cx="19" cy="7" r="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M12 9.5V7.2M9.8 13.2 7.4 14.8M14.2 13.2l2.4 1.6M10.2 10.8 6.6 8.4M13.8 10.8l3.6-2.4M10.5 13.8 8.2 17M13.5 13.8l2.3 3.2"
      />
    </SvgIcon>
  );
}

export default MindmapIcon;
