import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import ReactFlow, {
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';

/**
 * Custom Bezier Edge - Smooth curved connections like NotebookLM
 */
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

  return (
    <path
      id={id}
      style={style}
      className="react-flow__edge-path"
      d={edgePath}
      fill="none"
    />
  );
};

/**
 * NotebookLM-style pill node for database root
 */
const DatabaseNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderRadius: '20px',
        backgroundColor: isDark ? '#2a2a2f' : '#e8e8ec',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 100,
        transition: 'all 0.15s ease',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          color: theme.palette.text.primary,
          fontSize: '0.85rem',
        }}
      >
        {data.label}
      </Typography>
      <ChevronRightRoundedIcon
        sx={{
          fontSize: 16,
          color: theme.palette.text.secondary,
        }}
      />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
});
DatabaseNode.displayName = 'DatabaseNode';

/**
 * NotebookLM-style pill node for tables (expandable)
 */
const TableNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasColumns = data.columnCount > 0;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.75,
        borderRadius: '16px',
        backgroundColor: isDark ? '#2a2a2f' : '#e8e8ec',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 80,
        cursor: hasColumns ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        '&:hover': hasColumns ? {
          backgroundColor: isDark ? '#35353a' : '#dcdce0',
        } : {},
      }}
      onClick={() => hasColumns && data.onToggle && data.onToggle(data.id)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 500,
          color: theme.palette.text.primary,
          fontSize: '0.8rem',
        }}
      >
        {data.label}
      </Typography>
      {hasColumns && (
        <ChevronRightRoundedIcon
          sx={{
            fontSize: 14,
            color: theme.palette.text.secondary,
            transform: data.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
});
TableNode.displayName = 'TableNode';

/**
 * NotebookLM-style pill node for columns
 */
const ColumnNode = memo(({ data }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isPK = data.isPrimaryKey;

  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: '14px',
        backgroundColor: isDark ? '#2a2a2f' : '#e8e8ec',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 60,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {isPK && (
        <KeyRoundedIcon
          sx={{
            fontSize: 12,
            color: theme.palette.warning.main,
          }}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          color: isPK ? theme.palette.warning.main : theme.palette.text.primary,
          fontWeight: isPK ? 600 : 400,
          fontSize: '0.75rem',
        }}
      >
        {data.label}
      </Typography>
      {data.type && (
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.disabled,
            fontSize: '0.65rem',
            ml: 'auto',
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

/**
 * Apply dagre layout with NotebookLM-style spacing
 */
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 30, ranksep: 100 });

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

/**
 * SchemaFlowDiagram - NotebookLM-style mindmap visualization
 */
function SchemaFlowDiagram({ database, tables, columns }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [expandedTables, setExpandedTables] = useState(new Set());

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

  // Edge styling using theme colors
  const edgeStyle = useMemo(() => ({
    stroke: isDark ? '#52525B' : '#94A3B8',
    strokeWidth: 1.5,
  }), [isDark]);

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    // Database root node
    nodes.push({
      id: 'db',
      type: 'database',
      data: { label: database },
      position: { x: 0, y: 0 },
      width: 140,
      height: 36,
    });

    // Table nodes
    tables.forEach((tableName) => {
      const tableId = `table-${tableName}`;
      const tableColumns = columns[tableName] || [];
      const isExpanded = expandedTables.has(tableId);

      nodes.push({
        id: tableId,
        type: 'table',
        data: {
          id: tableId,
          label: tableName,
          columnCount: tableColumns.length,
          expanded: isExpanded,
          onToggle: toggleTable,
        },
        position: { x: 0, y: 0 },
        width: 120,
        height: 32,
      });

      edges.push({
        id: `db-${tableId}`,
        source: 'db',
        target: tableId,
        type: 'custom',
        style: edgeStyle,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      // Column nodes (only if expanded)
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
            },
            position: { x: 0, y: 0 },
            width: 110,
            height: 28,
          });

          edges.push({
            id: `${tableId}-${columnId}`,
            source: tableId,
            target: columnId,
            type: 'custom',
            style: { ...edgeStyle, strokeWidth: 1 },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [database, tables, columns, expandedTables, toggleTable, edgeStyle]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 500,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: isDark ? '#18181b' : '#fafafa',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: isDark ? '#27272a' : '#fff',
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`,
          }}
        />
      </ReactFlow>
    </Box>
  );
}

export default memo(SchemaFlowDiagram);
