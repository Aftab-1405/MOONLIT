const REACT_FLOW_PRO_OPTIONS = { hideAttribution: true };

const REACT_FLOW_ARIA_LABEL_CONFIG = {
  'node.a11yDescription.default': 'Press enter or space to select a diagram node.',
  'edge.a11yDescription.default': 'Press enter or space to select a diagram edge.',
  'controls.ariaLabel': 'Diagram controls',
  'minimap.ariaLabel': 'Diagram minimap',
};

const getReactFlowColorMode = (theme) => (theme.palette.mode === 'dark' ? 'dark' : 'light');

export const getReadOnlyReactFlowProps = (theme) => ({
  colorMode: getReactFlowColorMode(theme),
  ariaLabelConfig: REACT_FLOW_ARIA_LABEL_CONFIG,
  proOptions: REACT_FLOW_PRO_OPTIONS,
  onlyRenderVisibleElements: true,
  nodesDraggable: true,
  nodesConnectable: false,
  edgesFocusable: true,
  nodesFocusable: true,
  elevateEdgesOnSelect: true,
  elevateNodesOnSelect: true,
});
