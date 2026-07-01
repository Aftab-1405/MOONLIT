import IconBase from './IconBase';

function SidebarPanelIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16M6 8h.01M6 11h.01" strokeWidth="2" />
    </IconBase>
  );
}

export default SidebarPanelIcon;
