import IconBase from './IconBase';

function CodeEditorIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 8.5h18M7.5 13l2 2-2 2M12.5 17h4" />
      <path d="M6.25 6.25h.01M9 6.25h.01" strokeWidth="2" />
    </IconBase>
  );
}

export default CodeEditorIcon;
