import IconBase from './IconBase';

function SchemaIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="8.5" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
      <rect x="14" y="16" width="7" height="5" rx="1.5" />
      <path d="M12 8v4M6.5 16v-2.5A1.5 1.5 0 0 1 8 12h8a1.5 1.5 0 0 1 1.5 1.5V16" />
    </IconBase>
  );
}

export default SchemaIcon;
