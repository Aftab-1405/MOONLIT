import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import {
  ReactFlow,
  BaseEdge,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
} from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import {
  FLOW_NODE_CARD_CLASS,
  HIDDEN_FLOW_HANDLE_STYLE,
  getReactFlowBackgroundColor,
  getReactFlowCanvasSx,
  getReactFlowDefaultEdgeOptions,
  getReactFlowEdgeStyle,
  getReactFlowNodeCardSx,
} from '../styles/reactFlowStyles';
import { getReadOnlyReactFlowProps } from '../config/reactFlow';

const MOBILE_BREAKPOINT_QUERY = 'sm';

const CustomBezierEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return <BaseEdge id={id} path={edgePath} style={style} />;
};
const DatabaseNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = data.isMobile;

  return (
    <Box
      className={FLOW_NODE_CARD_CLASS}
      sx={{
        ...getReactFlowNodeCardSx(theme),
        px: { xs: 1.75, sm: 1.5 },
        py: { xs: 1.25, sm: 1 },
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.055),
        borderColor: alpha(theme.palette.text.primary, isDark ? 0.22 : 0.16),
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: isMobile ? 164 : 150,
        minHeight: isMobile ? 54 : 48,
        '&:hover': {
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.36 : 0.26),
        },
      }}
    >
      <StorageRoundedIcon
        sx={{
          fontSize: { xs: 18, sm: 16 },
          color: theme.palette.text.primary,
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          variant="body2"
          sx={{
            fontWeight: 650,
            color: theme.palette.text.primary,
            ...theme.typography.uiSchemaDbLabel,
          }}
        >
          {data.label}
        </Typography>
        <Typography
          noWrap
          variant="caption"
          sx={{
            color: alpha(theme.palette.text.primary, isDark ? 0.58 : 0.52),
            ...theme.typography.uiCaption2xs,
          }}
        >
          {data.tableCount} tables
        </Typography>
      </Box>
      <ChevronRightRoundedIcon
        sx={{
          fontSize: { xs: 18, sm: 14 },
          color: alpha(theme.palette.text.primary, 0.5),
          ml: 'auto',
        }}
      />
      <Handle type="source" position={Position.Right} style={HIDDEN_FLOW_HANDLE_STYLE} />
    </Box>
  );
});
DatabaseNode.displayName = 'DatabaseNode';
const TableNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = data.isMobile;
  const hasColumns = data.columnCount > 0;
  const handleToggle = useCallback(() => {
    if (hasColumns && data.onToggle) data.onToggle(data.id);
  }, [data, hasColumns]);
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  return (
    <Box
      className={FLOW_NODE_CARD_CLASS}
      role={hasColumns ? 'button' : undefined}
      tabIndex={hasColumns ? 0 : undefined}
      aria-expanded={hasColumns ? data.expanded : undefined}
      sx={{
        ...getReactFlowNodeCardSx(theme, { interactive: hasColumns }),
        px: { xs: 1.5, sm: 1.25 },
        py: { xs: 1.1, sm: 0.95 },
        borderColor: data.expanded
          ? alpha(theme.palette.text.primary, isDark ? 0.38 : 0.3)
          : alpha(theme.palette.text.primary, isDark ? 0.12 : 0.1),
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 0.75 },
        minWidth: isMobile ? 160 : 144,
        minHeight: isMobile ? 52 : 46,
        boxShadow: data.expanded
          ? `0 0 0 3px ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)}, 0 18px 38px -30px ${alpha(theme.palette.common.black, isDark ? 0.86 : 0.28)}`
          : undefined,
      }}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      <Handle type="target" position={Position.Left} style={HIDDEN_FLOW_HANDLE_STYLE} />
      
      <TableChartRoundedIcon
        sx={{
          fontSize: { xs: 16, sm: 14 },
          color: data.expanded ? theme.palette.text.primary : 'text.secondary',
        }}
      />
      
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          variant="caption"
          sx={{
            fontWeight: 650,
            color: data.expanded ? theme.palette.text.primary : 'text.primary',
            ...theme.typography.uiSchemaTableLabel,
          }}
        >
          {data.label}
        </Typography>
        <Typography
          noWrap
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.25,
            color: 'text.secondary',
            ...theme.typography.uiCaption2xs,
          }}
        >
          {data.columnCount} columns
        </Typography>
      </Box>
      
      {hasColumns && (
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}>
          <ChevronRightRoundedIcon
            sx={{
              fontSize: { xs: 16, sm: 14 },
              color: 'text.secondary',
              transform: data.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </Box>
      )}
      
      <Handle type="source" position={Position.Right} style={HIDDEN_FLOW_HANDLE_STYLE} />
    </Box>
  );
});
TableNode.displayName = 'TableNode';
const ColumnNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = data.isMobile;
  const isPK = data.isPrimaryKey;

  return (
    <Box
      className={FLOW_NODE_CARD_CLASS}
      sx={{
        ...getReactFlowNodeCardSx(theme),
        px: { xs: 1.25, sm: 1 },
        py: { xs: 0.75, sm: 0.625 },
        backgroundColor: isPK 
          ? alpha(theme.palette.warning.main, isDark ? 0.12 : 0.08)
          : alpha(theme.palette.background.paper, isDark ? 0.92 : 0.96),
        borderColor: isPK 
          ? alpha(theme.palette.warning.main, isDark ? 0.34 : 0.24)
          : alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08),
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.75, sm: 0.5 },
        minWidth: isMobile ? 138 : 124,
        minHeight: isMobile ? 38 : 32,
        '&:hover': {
          borderColor: isPK 
            ? alpha(theme.palette.warning.main, isDark ? 0.48 : 0.38)
            : alpha(theme.palette.text.primary, isDark ? 0.22 : 0.16),
        },
      }}
    >
      <Handle type="target" position={Position.Left} style={HIDDEN_FLOW_HANDLE_STYLE} />
      
      {isPK && (
        <KeyRoundedIcon
          sx={{
            fontSize: { xs: 12, sm: 10 },
            color: theme.palette.warning.main,
          }}
        />
      )}
      
      <Typography
        variant="caption"
        sx={{
          color: isPK ? theme.palette.warning.main : 'text.primary',
          fontWeight: isPK ? 600 : 500,
          ...theme.typography.uiSchemaColumnLabel,
          fontFamily: theme.typography.fontFamilyMono,
        }}
      >
        {data.label}
      </Typography>
      
      {data.type && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            ...theme.typography.uiSchemaColumnType,
            ml: 'auto',
            fontFamily: theme.typography.fontFamilyMono,
            opacity: 0.7,
          }}
        >
          {data.type}
        </Typography>
      )}
    </Box>
  );
});
ColumnNode.displayName = 'ColumnNode';
const nodeTypes = {
  database: DatabaseNode,
  table: TableNode,
  column: ColumnNode,
};

const edgeTypes = {
  custom: CustomBezierEdge,
};
const getLayoutedElements = (nodes, edges, direction = 'LR', isMobile = false) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: direction, 
    nodesep: isMobile ? 16 : 24, 
    ranksep: isMobile ? 50 : 80,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.width || 120, height: node.height || 32 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 120) / 2,
        y: nodeWithPosition.y - (node.height || 32) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
function SchemaFlowDiagram({ database, tables, columns }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT_QUERY));
  const [expandedTables, setExpandedTables] = useState(new Set());
  const validTableIds = useMemo(() => new Set(tables.map((tableName) => `table-${tableName}`)), [tables]);
  const activeExpandedTables = useMemo(
    () => new Set([...expandedTables].filter((tableId) => validTableIds.has(tableId))),
    [expandedTables, validTableIds]
  );

  const toggleTable = useCallback((tableId) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  }, []);
  const edgeStyle = useMemo(() => ({
    ...getReactFlowEdgeStyle(theme, { isMobile }),
  }), [isMobile, theme]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    const dbNodeWidth = isMobile ? 176 : 160;
    const dbNodeHeight = isMobile ? 58 : 52;
    const tableNodeWidth = isMobile ? 170 : 154;
    const tableNodeHeight = isMobile ? 58 : 52;
    const colNodeWidth = isMobile ? 148 : 134;
    const colNodeHeight = isMobile ? 40 : 34;
    nodes.push({
      id: 'db',
      type: 'database',
      data: {
        label: database,
        tableCount: tables.length,
        isMobile,
      },
      position: { x: 0, y: 0 },
      width: dbNodeWidth,
      height: dbNodeHeight,
    });
    tables.forEach((tableName) => {
      const tableId = `table-${tableName}`;
      const tableColumns = columns[tableName] || [];
      const isExpanded = activeExpandedTables.has(tableId);

      nodes.push({
        id: tableId,
        type: 'table',
        data: {
          id: tableId,
          label: tableName,
          columnCount: tableColumns.length,
          expanded: isExpanded,
          onToggle: toggleTable,
          isMobile,
        },
        position: { x: 0, y: 0 },
        width: tableNodeWidth,
        height: tableNodeHeight,
      });

      edges.push({
        id: `db-${tableId}`,
        source: 'db',
        target: tableId,
        type: 'custom',
        style: edgeStyle,
        interactionWidth: 18,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
      if (isExpanded) {
        tableColumns.forEach((col) => {
          const colName = typeof col === 'object' ? col.name : col;
          const colType = typeof col === 'object' ? col.type : null;
          const isPK = typeof col === 'object' && (col.is_primary_key || col.key === 'PRI');
          const columnId = `${tableId}-col-${colName}`;

          nodes.push({
            id: columnId,
            type: 'column',
            data: {
              label: colName,
              type: colType,
              isPrimaryKey: isPK,
              isMobile,
            },
            position: { x: 0, y: 0 },
            width: colNodeWidth,
            height: colNodeHeight,
          });

          edges.push({
            id: `${tableId}-${columnId}`,
            source: tableId,
            target: columnId,
            type: 'custom',
            style: getReactFlowEdgeStyle(theme, { isMobile, emphasis: 'subtle' }),
            interactionWidth: 18,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'LR', isMobile);
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [database, tables, columns, activeExpandedTables, toggleTable, edgeStyle, isMobile, theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowProps = useMemo(() => getReadOnlyReactFlowProps(theme), [theme]);
  const defaultEdgeOptions = useMemo(
    () => getReactFlowDefaultEdgeOptions(theme, { isMobile }),
    [isMobile, theme],
  );

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 300,
        borderRadius: '6px',
        overflow: 'hidden',
        touchAction: 'pan-y',
        border: '1px solid',
        borderColor: theme.palette.border.subtle,
        backgroundColor: alpha(theme.palette.background.default, isDark ? 0.6 : 0.5),
      }}
    >
      <Box sx={getReactFlowCanvasSx(theme, { tone: 'schema' })}>
        <ReactFlow
          aria-label="Database schema diagram"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: isMobile ? 0.2 : 0.34 }}
          minZoom={0.2}
          maxZoom={2}
          {...reactFlowProps}
          panOnScroll={!isMobile}
          panOnDrag={true}
          zoomOnScroll={!isMobile}
          zoomOnPinch={true}
          preventScrolling={true}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Background gap={22} size={0.8} color={getReactFlowBackgroundColor(theme)} />
        </ReactFlow>
      </Box>
    </Box>
  );
}

export default memo(SchemaFlowDiagram);
