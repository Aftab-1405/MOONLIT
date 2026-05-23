import SvgIcon from '@mui/material/SvgIcon';

/** Sidebar / schema panel toggle — theme-aware via `currentColor`. */
function SidebarPanelIcon(props) {
  return (
    <SvgIcon viewBox="0 0 20 20" fontSize="inherit" {...props}>
      <path d="M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z" />
    </SvgIcon>
  );
}

export default SidebarPanelIcon;
