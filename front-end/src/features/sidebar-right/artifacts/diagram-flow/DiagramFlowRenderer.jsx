import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  BaseEdge,
  Background,
  Handle,
  MarkerType,
  Position,
  getBezierPath,
  useInternalNode,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import {
  Box,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import MindmapIcon from '@/components/icons/MindmapIcon';
import { ArtifactShell } from '@/features/sidebar-right/artifact-loader';
import {
  FLOW_NODE_CARD_CLASS,
  HIDDEN_FLOW_HANDLE_STYLE,
  getReactFlowBackgroundColor,
  getReactFlowCanvasSx,
  getReactFlowCountBadgeSx,
  getReactFlowCustomNodeAccentSx,
  getReactFlowDefaultEdgeOptions,
  getReactFlowEdgeStyle,
  getReactFlowNodeCardSx,
  getReactFlowNodeChromeSx,
  getReactFlowNodeStatusDotSx,
  getReactFlowStatusSx,
  getReactFlowTagChipSx,
} from '@/styles/reactFlowStyles';
import { getReadOnlyReactFlowProps } from '@/config/reactFlow';

const VALID_DIRECTIONS = new Set(['LR', 'TD']);
const STREAM_SETTLE_MS = 350;
// Slightly larger default nodes give more room for rich content
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 96;
const MOBILE_NODE_WIDTH = 186;
const MOBILE_NODE_HEIGHT = 90;
const INLINE_VIEWPORT = { width: 720, height: 340 };
const MOBILE_VIEWPORT = { width: 320, height: 230 };
const STYLE_KEYS = new Set([
  'background',
  'backgroundColor',
  'border',
  'borderColor',
  'color',
  'fontWeight',
  'lineHeight',
  'stroke',
  'strokeDasharray',
  'strokeWidth',
]);

const PREMIUM_NODE_TYPE = 'premium';
const NODE_STATUSES = new Set(['ready', 'active', 'pending', 'blocked', 'disabled']);

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())
    .slice(0, 3);
};

const normalizeNodeStatus = (status) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return NODE_STATUSES.has(normalized) ? normalized : undefined;
};

const normalizeStyle = (style) => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return undefined;
  const normalized = {};
  Object.entries(style).forEach(([key, value]) => {
    if (STYLE_KEYS.has(key) && ['string', 'number'].includes(typeof value)) {
      normalized[key] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeNodeStyle = (node) => {
  const style = normalizeStyle(node.style) || {};
  if (typeof node.color === 'string') style.color = node.color;
  if (typeof node.backgroundColor === 'string') style.backgroundColor = node.backgroundColor;
  if (typeof node.borderColor === 'string') {
    style.borderColor = node.borderColor;
    style.border = style.border || `1px solid ${node.borderColor}`;
  }
  return Object.keys(style).length > 0 ? style : undefined;
};

const normalizeEdgeStyle = (edge) => {
  const style = normalizeStyle(edge.style) || {};
  if (typeof edge.color === 'string') style.stroke = edge.color;
  if (edge.dashed) style.strokeDasharray = style.strokeDasharray || '6 4';
  return Object.keys(style).length > 0 ? style : undefined;
};

const getDiagramViewport = (nodes, viewportSize, isMobile) => {
  if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 };

  const fallback = isMobile ? MOBILE_VIEWPORT : INLINE_VIEWPORT;
  const viewportWidth = viewportSize.width || fallback.width;
  const viewportHeight = viewportSize.height || fallback.height;
  const padding = isMobile ? 24 : 36;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + (node.width || DEFAULT_NODE_WIDTH)));
  const maxY = Math.max(...nodes.map((node) => node.position.y + (node.height || DEFAULT_NODE_HEIGHT)));
  const graphWidth = Math.max(maxX - minX, 1);
  const graphHeight = Math.max(maxY - minY, 1);
  const zoom = Math.min(
    Math.max((viewportWidth - padding * 2) / graphWidth, 0.2),
    Math.max((viewportHeight - padding * 2) / graphHeight, 0.2),
    1,
  );

  return {
    x: (viewportWidth - graphWidth * zoom) / 2 - minX * zoom,
    y: (viewportHeight - graphHeight * zoom) / 2 - minY * zoom,
    zoom,
  };
};

const getLayoutedElements = (nodes, edges, direction, isMobile) => {
  const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    // More generous breathing room between nodes
    nodesep: isMobile ? 36 : 52,
    ranksep: isMobile ? 82 : 112,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: node.width || 196,
      height: node.height || 74,
    });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  Dagre.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const layoutNode = graph.node(node.id);
      const width = node.width || 196;
      const height = node.height || 74;
      return {
        ...node,
        position: {
          x: layoutNode.x - width / 2,
          y: layoutNode.y - height / 2,
        },
      };
    }),
    edges,
  };
};

const parseJsonDiagram = (code) => {
  let parsed;
  try {
    parsed = JSON.parse(code);
  } catch {
    throw new Error('Diagram data must be valid JSON.');
  }
  return normalizeDiagram(parsed);
};

const normalizeDiagram = (diagram) => {
  if (!diagram || typeof diagram !== 'object' || Array.isArray(diagram)) {
    throw new Error('Diagram data must be a JSON object.');
  }

  const direction = VALID_DIRECTIONS.has(String(diagram.direction || '').toUpperCase())
    ? String(diagram.direction).toUpperCase()
    : 'LR';

  if (!Array.isArray(diagram.nodes) || diagram.nodes.length === 0) {
    throw new Error('Diagram data needs at least one node.');
  }

  const nodes = [];
  const nodeIds = new Set();
  diagram.nodes.forEach((node) => {
    const id = typeof node?.id === 'string' ? node.id.trim() : '';
    if (!id || nodeIds.has(id)) return;
    nodeIds.add(id);
    const label = typeof node.label === 'string' && node.label.trim() ? node.label.trim() : id;
    const subtitle = typeof node.subtitle === 'string' && node.subtitle.trim() ? node.subtitle.trim() : '';
    const count = Number.isFinite(node.count) ? node.count : undefined;
    nodes.push({
      id,
      label,
      subtitle,
      count,
      status: normalizeNodeStatus(node.status),
      tags: normalizeTags(node.tags),
      style: normalizeNodeStyle(node),
    });
  });

  if (nodes.length === 0) {
    throw new Error('Diagram nodes need stable string IDs.');
  }

  const edges = [];
  if (Array.isArray(diagram.edges)) {
    diagram.edges.forEach((edge, index) => {
      const source = typeof edge?.source === 'string' ? edge.source.trim() : '';
      const target = typeof edge?.target === 'string' ? edge.target.trim() : '';
      if (!nodeIds.has(source) || !nodeIds.has(target)) return;
      const id = typeof edge.id === 'string' && edge.id.trim()
        ? edge.id.trim()
        : `${source}-${target}-${index}`;
      edges.push({
        id,
        source,
        target,
        label: typeof edge.label === 'string' ? edge.label.trim() : '',
        dashed: Boolean(edge.dashed),
        style: normalizeEdgeStyle(edge),
        animated: Boolean(edge.animated),
      });
    });
  }

  return { direction, nodes, edges };
};

const buildFlowElements = (diagram, isMobile, theme) => {
  const nodeWidth = isMobile ? MOBILE_NODE_WIDTH : DEFAULT_NODE_WIDTH;
  const nodeHeight = isMobile ? MOBILE_NODE_HEIGHT : DEFAULT_NODE_HEIGHT;
  const edgeBaseStyle = getReactFlowEdgeStyle(theme, { isMobile });

  const nodes = diagram.nodes.map((node) => ({
    id: node.id,
    type: PREMIUM_NODE_TYPE,
    data: {
      title: node.label,
      subtitle: node.subtitle,
      count: node.count,
      status: node.status,
      tags: node.tags,
      customStyle: node.style,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    position: { x: 0, y: 0 },
    width: nodeWidth,
    height: nodeHeight,
  }));

  const edges = diagram.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'floating',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      // Cleaner, proportionate arrowhead
      width: 14,
      height: 14,
      color: edge.style?.stroke || edgeBaseStyle.stroke,
    },
    style: {
      ...edgeBaseStyle,
      ...(edge.style || {}),
    },
    interactionWidth: 20,
    labelStyle: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0,
    },
    animated: edge.animated,
  }));

  return getLayoutedElements(nodes, edges, diagram.direction, isMobile);
};

// ─── Premium Node Component ───────────────────────────────────────────────────

const DiagramFlowNode = memo(function DiagramFlowNode({ data }) {
  const theme = useTheme();
  const status = data.status;
  const showStatus = status && status !== 'ready';
  const hasTags = data.tags?.length > 0;
  const hasCount = Number.isFinite(data.count);
  const hasFooter = showStatus || hasTags || hasCount;
  const disabled = status === 'disabled';
  const accentSx = getReactFlowCustomNodeAccentSx(theme, data.customStyle, disabled);

  return (
    <Box
      className={FLOW_NODE_CARD_CLASS}
      sx={{
        ...getReactFlowNodeCardSx(theme, { disabled, interactive: true }),
        ...getReactFlowNodeChromeSx(theme, disabled),
        position: 'relative',
        height: '100%',
        minHeight: 90,
        px: 1.75,
        py: 1.5,
        color: disabled ? 'text.disabled' : 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: hasFooter ? 'space-between' : 'center',
        gap: hasFooter ? 1.25 : 0,
        textAlign: 'center',
        opacity: disabled ? 0.62 : 1,
        ...accentSx,
      }}
    >
      <Handle type="target" position={data.targetPosition || Position.Left} style={HIDDEN_FLOW_HANDLE_STYLE} />

      {/* Status indicator dot — top-right corner */}
      {status && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 6,
            height: 6,
            borderRadius: '50%',
            zIndex: 2,
            ...getReactFlowNodeStatusDotSx(theme, status),
          }}
        />
      )}

      {/* Primary content: label + subtitle */}
      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Typography
          noWrap
          sx={{
            ...theme.typography.uiBodySm,
            lineHeight: 1.25,
            fontWeight: 660,
            letterSpacing: 0,
            color: disabled ? 'text.disabled' : 'text.primary',
            textAlign: 'center',
          }}
        >
          {data.title}
        </Typography>
        {data.subtitle && (
          <Typography
            noWrap
            sx={{
              mt: 0.4,
              ...theme.typography.uiCaption2xs,
              lineHeight: 1.35,
              letterSpacing: 0,
              color: disabled ? 'text.disabled' : 'text.secondary',
              textAlign: 'center',
            }}
          >
            {data.subtitle}
          </Typography>
        )}
      </Box>

      {/* Footer row: status badge, count pill, tag chips */}
      {hasFooter && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            minWidth: 0,
            width: '100%',
          }}
        >
          {showStatus && (
            <Box
              component="span"
              sx={{
                px: 0.875,
                py: 0.375,
                borderRadius: theme.shape.radius?.full ?? '999px',
                border: '1px solid',
                fontFamily: theme.typography.fontFamilyMono,
                fontSize: 10.5,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: 0,
                textTransform: 'none',
                ...getReactFlowStatusSx(theme, status),
              }}
            >
              {status}
            </Box>
          )}

          {hasCount && (
            <Box component="span" sx={getReactFlowCountBadgeSx(theme)}>
              {data.count}
            </Box>
          )}

          {/* Individual tag chips instead of a joined string */}
          {hasTags && data.tags.map((tag) => (
            <Box key={tag} component="span" sx={getReactFlowTagChipSx(theme)}>
              {tag}
            </Box>
          ))}
        </Box>
      )}

      <Handle type="source" position={data.sourcePosition || Position.Right} style={HIDDEN_FLOW_HANDLE_STYLE} />
    </Box>
  );
});

const nodeTypes = {
  [PREMIUM_NODE_TYPE]: DiagramFlowNode,
};

// ─── Floating Edge ────────────────────────────────────────────────────────────

const getNodeGeometry = (node) => {
  if (!node) return null;
  const position = node.internals?.positionAbsolute || node.position || { x: 0, y: 0 };
  const width = node.measured?.width || node.width || node.initialWidth || DEFAULT_NODE_WIDTH;
  const height = node.measured?.height || node.height || node.initialHeight || DEFAULT_NODE_HEIGHT;

  return {
    x: position.x,
    y: position.y,
    width,
    height,
    centerX: position.x + width / 2,
    centerY: position.y + height / 2,
  };
};

const getBorderCenterPoint = (sourceNode, targetNode) => {
  const source = getNodeGeometry(sourceNode);
  const target = getNodeGeometry(targetNode);
  if (!source || !target) return null;

  const dx = target.centerX - source.centerX;
  const dy = target.centerY - source.centerY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? source.x + source.width : source.x,
      y: source.centerY,
      position: dx >= 0 ? Position.Right : Position.Left,
    };
  }

  return {
    x: source.centerX,
    y: dy >= 0 ? source.y + source.height : source.y,
    position: dy >= 0 ? Position.Bottom : Position.Top,
  };
};

const FloatingBorderCenterEdge = memo(function FloatingBorderCenterEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const sourcePoint = getBorderCenterPoint(sourceNode, targetNode);
  const targetPoint = getBorderCenterPoint(targetNode, sourceNode);

  if (!sourcePoint || !targetPoint) return null;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePoint.position,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: targetPoint.position,
    // Slightly more graceful curve
    curvature: 0.28,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  );
});

const edgeTypes = {
  floating: FloatingBorderCenterEdge,
};

// ─── Main Renderer ────────────────────────────────────────────────────────────

function DiagramFlowRenderer({
  code,
  title,
  onClose,
  onRequestClose,
  isFullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  chrome = 'standalone',
  workspaceContainerRef,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const copyTimeoutRef = useRef(null);
  const settleTimeoutRef = useRef(null);
  const flowInstanceRef = useRef(null);
  const flowViewportRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [flowReadyToken, setFlowReadyToken] = useState(0);
  const [stableCode, setStableCode] = useState(code);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [viewportReadySignature, setViewportReadySignature] = useState('');
  const isReceiving = stableCode !== code;

  useEffect(() => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(() => {
      setStableCode(code);
    }, STREAM_SETTLE_MS);

    return () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, [code]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
  }, []);

  const parseResult = useMemo(() => {
    if (!stableCode || isReceiving) return { diagram: null, error: null };
    try {
      const diagram = parseJsonDiagram(stableCode);
      return { diagram, error: null };
    } catch (error) {
      return { diagram: null, error: error.message || 'Diagram data could not be rendered.' };
    }
  }, [stableCode, isReceiving]);

  const flowElements = useMemo(() => {
    if (!parseResult.diagram) return { nodes: [], edges: [] };
    return buildFlowElements(parseResult.diagram, isMobile, theme);
  }, [parseResult.diagram, isMobile, theme]);
  
  const reactFlowProps = useMemo(() => getReadOnlyReactFlowProps(theme), [theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowElements.edges);
  
  const initialViewport = useMemo(
    () => getDiagramViewport(nodes, viewportSize, isMobile),
    [isMobile, nodes, viewportSize],
  );
  
  const defaultEdgeOptions = useMemo(
    () => getReactFlowDefaultEdgeOptions(theme, { isMobile }),
    [isMobile, theme],
  );

  useEffect(() => {
    setNodes(flowElements.nodes);
    setEdges(flowElements.edges);
  }, [flowElements, setNodes, setEdges]);

  const flowKey = useMemo(
    () => `${stableCode.length}`,
    [stableCode.length],
  );

  const fitDiagramViewport = useCallback((instance = flowInstanceRef.current) => {
    if (!instance || nodes.length === 0) return false;
    if (typeof instance.fitView === 'function') {
      instance.fitView({
        padding: isFullscreen ? 0.16 : 0.12,
        duration: 0,
      });
    } else {
      instance.setViewport(initialViewport, { duration: 0 });
    }
    return true;
  }, [initialViewport, isFullscreen, nodes.length]);

  const handleFlowInit = useCallback((instance) => {
    flowInstanceRef.current = instance;
    setFlowReadyToken((value) => value + 1);
  }, []);

  const viewportSignature = `${isFullscreen ? 'full' : 'inline'}-${viewportSize.width}x${viewportSize.height}-${nodes.length}-${edges.length}-${stableCode.length}-${flowReadyToken}`;
  const viewportReady = viewportReadySignature === viewportSignature;

  useEffect(() => {
    if (isReceiving || parseResult.error || nodes.length === 0) return undefined;
    if (!viewportSize.width || !viewportSize.height || !flowReadyToken) return undefined;

    let firstFrame = null;
    let secondFrame = null;
    let revealFrame = null;

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        try {
          fitDiagramViewport();
        } catch {
          flowInstanceRef.current?.setViewport?.(initialViewport, { duration: 0 });
        }
        revealFrame = requestAnimationFrame(() => {
          setViewportReadySignature(viewportSignature);
        });
      });
    });

    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (revealFrame) cancelAnimationFrame(revealFrame);
    };
  }, [
    fitDiagramViewport,
    flowReadyToken,
    initialViewport,
    isReceiving,
    nodes.length,
    parseResult.error,
    viewportSignature,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    const viewport = flowViewportRef.current;
    if (!viewport) return undefined;

    let frame = null;
    const updateViewportSize = ({ width, height }) => {
      setViewportSize((current) => {
        const nextWidth = Math.round(width);
        const nextHeight = Math.round(height);
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewportSize(viewport.getBoundingClientRect());

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(([entry]) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        updateViewportSize(entry.contentRect);
      });
    });

    observer.observe(viewport);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isFullscreen]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const graphTitle = title || 'Flow Diagram';

  if (parseResult.error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <ArtifactShell
          title={graphTitle}
          icon={<MindmapIcon sx={{ width: 20, height: 20 }} />}
          chrome={chrome}
          onClose={onClose}
          onRequestClose={onRequestClose}
          isFullscreen={isFullscreen}
          onEnterFullscreen={onEnterFullscreen}
          onExitFullscreen={onExitFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          workspaceContainerRef={workspaceContainerRef}
          bodyScroll="auto"
          bodySx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
          actions={[
            {
              key: 'copy',
              label: copied ? 'Copied!' : 'Copy code',
              icon: copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
              onClick: handleCopy,
            },
          ]}
        >
          <Box
            sx={{
              p: isMobile ? 1.5 : 2,
              borderBottom: '1px solid',
              borderColor: theme.palette.border.subtle,
              bgcolor: alpha(theme.palette.error.main, isDark ? 0.08 : 0.04),
              flexShrink: 0,
            }}
          >
            <Typography sx={{ ...theme.typography.uiCaptionMd, color: 'error.main' }}>
              {parseResult.error}
            </Typography>
          </Box>
          <Box
            component="pre"
            sx={{
              flex: 1,
              minHeight: 0,
              m: 0,
              p: isMobile ? 1.5 : 2,
              overflow: 'auto',
              fontFamily: theme.typography.fontFamilyMono,
              ...theme.typography.uiBodySm,
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.02 : 0.01),
            }}
          >
            <code>{code}</code>
          </Box>
        </ArtifactShell>
      </Box>
    );
  }

  const flowContent = (
    <ArtifactShell
      title={graphTitle}
      icon={<MindmapIcon sx={{ width: 20, height: 20 }} />}
      chrome={chrome}
      onClose={onClose}
      onRequestClose={onRequestClose}
      isFullscreen={isFullscreen}
      onEnterFullscreen={onEnterFullscreen}
      onExitFullscreen={onExitFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      workspaceContainerRef={workspaceContainerRef}
      actions={[
        {
          key: 'copy',
          label: copied ? 'Copied!' : 'Copy code',
          icon: copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
          onClick: handleCopy,
        },
      ]}
    >
      <Box
        ref={flowViewportRef}
        sx={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          position: 'relative',
          zIndex: 0,
          isolation: 'isolate',
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.02 : 0.01),
        }}
      >
        {isReceiving ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <CircularProgress size={32} sx={{ color: 'text.secondary' }} />
            <Typography sx={{ ...theme.typography.uiCaptionMd, color: 'text.secondary' }}>
              Receiving diagram data...
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              ...getReactFlowCanvasSx(theme),
              zIndex: 0,
              isolation: 'isolate',
              opacity: viewportReady ? 1 : 0,
              transition: viewportReady ? 'opacity 120ms ease' : 'none',
            }}
          >
            <ReactFlow
              key={flowKey}
              aria-label="Diagram flow"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onInit={handleFlowInit}
              defaultViewport={initialViewport}
              defaultEdgeOptions={defaultEdgeOptions}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              minZoom={0.2}
              maxZoom={2}
              {...reactFlowProps}
              panOnScroll={!isMobile}
              panOnDrag
              zoomOnScroll={!isMobile}
              zoomOnPinch
              preventScrolling
            >
              <Background gap={24} size={0.9} color={getReactFlowBackgroundColor(theme)} />
            </ReactFlow>
          </Box>
        )}
      </Box>
    </ArtifactShell>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate',
      }}
    >
      {flowContent}
    </Box>
  );
}

export default memo(DiagramFlowRenderer);
