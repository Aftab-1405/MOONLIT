import IconBase from './IconBase';

function MindmapIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="8.5" y="9" width="7" height="6" rx="2" />
      <rect x="3" y="3" width="5" height="4" rx="1.5" />
      <rect x="16" y="3" width="5" height="4" rx="1.5" />
      <rect x="3" y="17" width="5" height="4" rx="1.5" />
      <rect x="16" y="17" width="5" height="4" rx="1.5" />
      <path d="m8.5 10.5-3-3.5M15.5 10.5l3-3.5M8.5 13.5l-3 3.5M15.5 13.5l3 3.5" />
    </IconBase>
  );
}

export default MindmapIcon;
