import Dagre from '@dagrejs/dagre';

const VALID_DIRECTIONS = new Set(['LR', 'RL', 'TB', 'BT']);
const VALID_LAYOUTS = new Set(['hierarchical', 'radial', 'manual']);
const VALID_NODE_TYPES = new Set([
  'actor',
  'aggregate',
  'data',
  'decision',
  'entity',
  'event',
  'filter',
  'group',
  'input',
  'join',
  'note',
  'output',
  'process',
  'scan',
  'sort',
]);
const VALID_EDGE_TYPES = new Set([
  'default',
  'floating',
  'simplebezier',
  'smoothstep',
  'step',
  'straight',
]);
const VALID_MARKERS = new Set(['none', 'arrow', 'arrow-closed']);
const NODE_STATUSES = new Set([
  'active',
  'blocked',
  'cached',
  'disabled',
  'error',
  'pending',
  'ready',
  'running',
  'success',
  'warning',
]);
const FORBIDDEN_STYLE_KEYS = new Set([
  'bottom',
  'display',
  'height',
  'left',
  'position',
  'right',
  'top',
  'width',
  'zIndex',
]);

const isFinitePoint = (value) => value && Number.isFinite(value.x) && Number.isFinite(value.y);

const kebabToCamel = (value) =>
  value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

const normalizeDiagramStyle = (style) => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return undefined;
  const normalized = {};
  Object.entries(style).forEach(([key, value]) => {
    const camelKey = kebabToCamel(key);
    if (!FORBIDDEN_STYLE_KEYS.has(camelKey) && ['string', 'number'].includes(typeof value)) {
      normalized[camelKey] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())
    .slice(0, 4);
};

const normalizeColumns = (columns) => {
  if (!Array.isArray(columns)) return [];
  return columns
    .map((column) => {
      if (typeof column === 'string' && column.trim()) return { name: column.trim() };
      if (!column || typeof column !== 'object' || Array.isArray(column)) return null;
      const name = typeof column.name === 'string' ? column.name.trim() : '';
      if (!name) return null;
      return {
        name,
        ...(typeof column.type === 'string' && column.type.trim()
          ? { type: column.type.trim() }
          : {}),
        ...(typeof column.key === 'string' && column.key.trim()
          ? { key: column.key.trim().toUpperCase() }
          : {}),
        ...(typeof column.nullable === 'boolean' ? { nullable: column.nullable } : {}),
      };
    })
    .filter(Boolean);
};

const normalizeNodeStyle = (node) => {
  const rawStyle =
    node.style && typeof node.style === 'object'
      ? node.style
      : node.data?.style && typeof node.data.style === 'object'
        ? node.data.style
        : {};
  const style = normalizeDiagramStyle(rawStyle) || {};
  const color = node.color || node.data?.color;
  const backgroundColor = node.backgroundColor || node.data?.backgroundColor;
  const borderColor = node.borderColor || node.data?.borderColor;
  if (typeof color === 'string') style.color = color;
  if (typeof backgroundColor === 'string') style.backgroundColor = backgroundColor;
  if (typeof borderColor === 'string') {
    style.borderColor = borderColor;
    style.border = style.border || `1px solid ${borderColor}`;
  }
  return Object.keys(style).length > 0 ? style : undefined;
};

const normalizeEdgeStyle = (edge) => {
  const rawStyle =
    edge.style && typeof edge.style === 'object'
      ? edge.style
      : edge.data?.style && typeof edge.data.style === 'object'
        ? edge.data.style
        : {};
  const style = normalizeDiagramStyle(rawStyle) || {};
  const color = edge.color || edge.data?.color;
  if (typeof color === 'string') style.stroke = color;
  const dashed = edge.dashed !== undefined ? edge.dashed : edge.data?.dashed;
  if (dashed) style.strokeDasharray = style.strokeDasharray || '6 4';
  return Object.keys(style).length > 0 ? style : undefined;
};

export const normalizeDiagram = (diagram) => {
  if (!diagram || typeof diagram !== 'object' || Array.isArray(diagram)) {
    throw new Error('Diagram data must be a JSON object.');
  }

  const rawDirection = String(diagram.direction || '').toUpperCase();
  const direction =
    rawDirection === 'TD' ? 'TB' : VALID_DIRECTIONS.has(rawDirection) ? rawDirection : 'LR';
  const rawLayout = String(diagram.layout || '').toLowerCase();
  const layout = VALID_LAYOUTS.has(rawLayout) ? rawLayout : 'hierarchical';

  if (!Array.isArray(diagram.nodes) || diagram.nodes.length === 0) {
    throw new Error('Diagram data needs at least one node.');
  }

  const nodes = [];
  const nodeIds = new Set();
  diagram.nodes.forEach((node) => {
    const id = typeof node?.id === 'string' ? node.id.trim() : '';
    if (!id || nodeIds.has(id)) return;
    nodeIds.add(id);

    const labelValue = node.label ?? node.data?.label ?? node.data;
    const label = typeof labelValue === 'string' && labelValue.trim() ? labelValue.trim() : id;
    const subtitleValue = node.subtitle ?? node.data?.subtitle;
    const typeValue = String(node.type || node.data?.type || 'process').toLowerCase();
    const statusValue = String(node.status || node.data?.status || '').toLowerCase();
    const countValue = node.count !== undefined ? node.count : node.data?.count;
    const positionValue = node.position ?? node.data?.position;

    nodes.push({
      id,
      type: VALID_NODE_TYPES.has(typeValue) ? typeValue : 'process',
      label,
      subtitle:
        typeof subtitleValue === 'string' && subtitleValue.trim() ? subtitleValue.trim() : '',
      count: Number.isFinite(countValue) ? countValue : undefined,
      status: NODE_STATUSES.has(statusValue) ? statusValue : undefined,
      tags: normalizeTags(node.tags ?? node.data?.tags),
      columns: normalizeColumns(node.columns ?? node.data?.columns),
      position: isFinitePoint(positionValue)
        ? { x: positionValue.x, y: positionValue.y }
        : undefined,
      style: normalizeNodeStyle(node),
    });
  });

  if (nodes.length === 0) throw new Error('Diagram nodes need stable string IDs.');

  const edges = [];
  const edgeIds = new Set();
  if (Array.isArray(diagram.edges)) {
    diagram.edges.forEach((edge, index) => {
      const source = typeof edge?.source === 'string' ? edge.source.trim() : '';
      const target = typeof edge?.target === 'string' ? edge.target.trim() : '';
      if (!nodeIds.has(source) || !nodeIds.has(target)) return;
      const baseId =
        typeof edge.id === 'string' && edge.id.trim()
          ? edge.id.trim()
          : `${source}-${target}-${index}`;
      let id = baseId;
      let duplicateIndex = 2;
      while (edgeIds.has(id)) {
        id = `${baseId}-${duplicateIndex}`;
        duplicateIndex += 1;
      }
      edgeIds.add(id);
      const typeValue = String(edge.type || edge.data?.type || 'floating').toLowerCase();
      const markerStart = String(
        edge.markerStart || edge.data?.markerStart || 'none',
      ).toLowerCase();
      const markerEnd = String(
        edge.markerEnd || edge.data?.markerEnd || 'arrow-closed',
      ).toLowerCase();
      const labelValue = edge.label ?? edge.data?.label;

      edges.push({
        id,
        source,
        target,
        type: VALID_EDGE_TYPES.has(typeValue) ? typeValue : 'floating',
        label: typeof labelValue === 'string' ? labelValue.trim() : '',
        style: normalizeEdgeStyle(edge),
        animated: Boolean(edge.animated ?? edge.data?.animated),
        markerStart: VALID_MARKERS.has(markerStart) ? markerStart : 'none',
        markerEnd: VALID_MARKERS.has(markerEnd) ? markerEnd : 'arrow-closed',
      });
    });
  }

  return { direction, layout, nodes, edges };
};

export const getDiagramNodeDimensions = (node, isMobile = false) => {
  const columnCount = Array.isArray(node.columns) ? node.columns.length : 0;
  if (node.type === 'entity') {
    return {
      width: isMobile ? 244 : 286,
      height: (isMobile ? 104 : 112) + Math.min(columnCount, 8) * (isMobile ? 21 : 23),
    };
  }
  if (node.type === 'decision')
    return { width: isMobile ? 132 : 156, height: isMobile ? 112 : 132 };
  if (node.type === 'event' || node.type === 'actor') {
    return { width: isMobile ? 126 : 144, height: isMobile ? 82 : 92 };
  }
  if (node.type === 'group') return { width: isMobile ? 236 : 280, height: isMobile ? 128 : 156 };
  if (node.type === 'note') return { width: isMobile ? 180 : 210, height: isMobile ? 104 : 118 };
  return { width: isMobile ? 186 : 210, height: isMobile ? 90 : 98 };
};

const layoutManually = (nodes) => ({
  nodes: nodes.map((node, index) => ({
    ...node,
    position: node.position || { x: (index % 3) * 260, y: Math.floor(index / 3) * 160 },
  })),
});

const layoutRadially = (nodes, edges) => {
  const incoming = new Map(nodes.map(({ id }) => [id, 0]));
  const outgoing = new Map(nodes.map(({ id }) => [id, 0]));
  edges.forEach(({ source, target }) => {
    incoming.set(target, (incoming.get(target) || 0) + 1);
    outgoing.set(source, (outgoing.get(source) || 0) + 1);
  });
  const root = [...nodes].sort((left, right) => {
    const leftRoot = incoming.get(left.id) === 0 ? 1 : 0;
    const rightRoot = incoming.get(right.id) === 0 ? 1 : 0;
    return rightRoot - leftRoot || (outgoing.get(right.id) || 0) - (outgoing.get(left.id) || 0);
  })[0];
  const satellites = nodes.filter(({ id }) => id !== root.id);
  const positionedNodes = new Map([
    [
      root.id,
      {
        x: -root.width / 2,
        y: -root.height / 2,
      },
    ],
  ]);
  const rootRadius = Math.hypot(root.width, root.height) / 2;
  const nodeGap = 48;
  let previousOuterRadius = rootRadius;

  for (let ringStart = 0; ringStart < satellites.length; ringStart += 8) {
    const ringNodes = satellites.slice(ringStart, ringStart + 8);
    const largestRadius = Math.max(
      ...ringNodes.map((node) => Math.hypot(node.width, node.height) / 2),
    );
    const chordRadius =
      ringNodes.length > 1
        ? (largestRadius * 2 + nodeGap) / (2 * Math.sin(Math.PI / ringNodes.length))
        : 0;
    const ringRadius = Math.max(previousOuterRadius + largestRadius + nodeGap, chordRadius);

    ringNodes.forEach((node, ringIndex) => {
      const angle = -Math.PI / 2 + (ringIndex * Math.PI * 2) / ringNodes.length;
      positionedNodes.set(node.id, {
        x: Math.round(Math.cos(angle) * ringRadius - node.width / 2),
        y: Math.round(Math.sin(angle) * ringRadius - node.height / 2),
      });
    });
    previousOuterRadius = ringRadius + largestRadius;
  }

  return {
    nodes: nodes.map((node) => ({ ...node, position: positionedNodes.get(node.id) })),
  };
};

const layoutHierarchically = (nodes, edges, direction, isMobile) => {
  const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: isMobile ? 36 : 54,
    ranksep: isMobile ? 82 : 116,
  });
  nodes.forEach((node) => {
    graph.setNode(node.id, { width: node.width, height: node.height });
  });
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });
  Dagre.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const position = graph.node(node.id);
      return {
        ...node,
        position: {
          x: position.x - node.width / 2,
          y: position.y - node.height / 2,
        },
      };
    }),
  };
};

export const layoutDiagramElements = (
  nodes,
  edges,
  { layout = 'hierarchical', direction = 'LR', isMobile = false } = {},
) => {
  const normalizedDirection = VALID_DIRECTIONS.has(direction) ? direction : 'LR';
  const sizedNodes = nodes.map((node) => {
    const dimensions = getDiagramNodeDimensions(node, isMobile);
    return {
      ...node,
      width: Number.isFinite(node.width) ? node.width : dimensions.width,
      height: Number.isFinite(node.height) ? node.height : dimensions.height,
    };
  });

  if (layout === 'manual') return { ...layoutManually(sizedNodes), edges };
  if (layout === 'radial') return { ...layoutRadially(sizedNodes, edges), edges };
  return { ...layoutHierarchically(sizedNodes, edges, normalizedDirection, isMobile), edges };
};
