import IconBase from './IconBase';

/** Canonical table glyph; shares the same outline geometry as database and schema. */
function TableIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9h17M9 4.5v15" />
    </IconBase>
  );
}

export default TableIcon;
