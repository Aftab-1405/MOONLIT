import { Box, ButtonBase, Collapse, Link, Typography, useTheme } from '@mui/material';
import { useId, useState } from 'react';
import { ExpandMoreIcon } from '@/components/icons';
import { MarkdownRenderer } from '@/features/chat';
import { getDetailedResult } from '@/features/chat/ai-response-steps/stepUtils';
import { getFlatStepControlSx } from '@/features/chat/ai-response-steps/timelineShared';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { getInteractionColors } from '@/styles/shared';
import { TRANSITIONS } from '@/theme/index';
import { normalizeCitationMarkdown } from '@/utils/toolResultFormatting';

const getStepTypeScale = (theme) => {
  return {
    sectionLabel: {
      color: theme.palette.text.disabled,
      ...theme.typography.uiCaptionMd,
      fontWeight: 400,
      letterSpacing: 0,
      textTransform: 'none',
    },
    metaLabel: {
      color: theme.palette.text.disabled,
      ...theme.typography.uiCaptionSm,
      fontWeight: theme.typography.fontWeightMedium,
    },
    metaValue: {
      color: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamilyMono,
      ...theme.typography.uiCaptionSm,
      fontWeight: theme.typography.fontWeightMedium,
      letterSpacing: '0',
    },
    primaryMono: {
      color: theme.palette.text.primary,
      fontFamily: theme.typography.fontFamilyMono,
      ...theme.typography.uiCaptionMd,
      fontWeight: theme.typography.fontWeightMedium,
      letterSpacing: '0',
    },
    secondaryMono: {
      color: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamilyMono,
      ...theme.typography.uiCaptionSm,
      fontWeight: theme.typography.fontWeightRegular,
      letterSpacing: '0',
    },
    mutedMono: {
      color: theme.palette.text.disabled,
      fontFamily: theme.typography.fontFamilyMono,
      ...theme.typography.uiCaption2xs,
      fontWeight: theme.typography.fontWeightRegular,
      letterSpacing: '0',
    },
    body: {
      color: theme.palette.text.secondary,
      ...theme.typography.uiResponseCompact,
      fontFamily: theme.typography.fontFamily,
      fontWeight: theme.typography.fontWeightRegular,
      letterSpacing: 0,
      maxWidth: '72ch',
    },
  };
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const getColumnName = (column) => {
  if (typeof column === 'string') return column;
  return column?.name || column?.column_name || String(column || '');
};

const getColumnMeta = (column) => {
  if (!column || typeof column === 'string') return [];
  return [
    column.type,
    column.is_primary_key ? 'PK' : null,
    column.nullable === false ? 'NOT NULL' : null,
    column.default ? `DEFAULT ${column.default}` : null,
  ].filter(Boolean);
};

const normalizeTableKey = (value = '') =>
  String(value).replace(/["'`]/g, '').split('.').pop().toLowerCase();

const resolveColumnsForTable = (columnsByTable, table) => {
  if (!columnsByTable) return null;

  if (Array.isArray(columnsByTable)) {
    const normalizedTable = normalizeTableKey(table);
    const matches = columnsByTable.filter(
      (column) =>
        normalizeTableKey(column?.table || column?.table_name || column?.tableName) ===
        normalizedTable,
    );
    return matches.length ? matches : null;
  }

  if (typeof columnsByTable !== 'object') return null;
  if (Array.isArray(columnsByTable[table])) return columnsByTable[table];

  const normalizedTable = normalizeTableKey(table);
  const matchingKey = Object.keys(columnsByTable).find(
    (key) => normalizeTableKey(key) === normalizedTable,
  );

  return matchingKey && Array.isArray(columnsByTable[matchingKey])
    ? columnsByTable[matchingKey]
    : null;
};

// ─── Shared primitives ────────────────────────────────────────────────────────

export const DetailLabel = ({ children }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        mb: 0.8,
        ...type.sectionLabel,
      }}
    >
      {children}
    </Typography>
  );
};

const MetaPill = ({ children }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        ...type.mutedMono,
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </Box>
  );
};

const FieldBadge = ({ label, value }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  if (value === undefined || value === null || value === '') return null;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.55, minWidth: 0 }}>
      <Typography sx={type.metaLabel}>{label}</Typography>
      <Typography sx={{ ...type.metaValue, minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
};

const EmptyResult = ({ children = 'No details returned.' }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  return <Typography sx={type.body}>{children}</Typography>;
};

const ColumnChip = ({ column }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  const name = getColumnName(column);
  const meta = getColumnMeta(column);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.45,
        minWidth: 0,
        maxWidth: '100%',
        px: 0.8,
        py: 0.35,
        borderRadius: 9999,
        bgcolor: theme.palette.layer.faint,
      }}
    >
      <Typography
        sx={{
          ...type.secondaryMono,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </Typography>
      {meta.slice(0, 2).map((item) => (
        <Typography key={item} sx={{ ...type.mutedMono, lineHeight: 1, flexShrink: 0 }}>
          {item}
        </Typography>
      ))}
    </Box>
  );
};

const ColumnList = ({ columns, limit }) => {
  const list = toArray(columns);
  const visibleColumns = typeof limit === 'number' ? list.slice(0, limit) : list;
  const hiddenCount = list.length - visibleColumns.length;
  if (list.length === 0) return <EmptyResult>No columns returned.</EmptyResult>;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, minWidth: 0 }}>
      {visibleColumns.map((column, index) => (
        <ColumnChip key={`${getColumnName(column)}-${index}`} column={column} />
      ))}
      {hiddenCount > 0 && <MetaPill>+{hiddenCount} more</MetaPill>}
    </Box>
  );
};

const ToolMetaGrid = ({ items }) => {
  const visibleItems = items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== '',
  );
  if (visibleItems.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.4, rowGap: 0.3, mb: 1.2 }}>
      {visibleItems.map((item) => (
        <FieldBadge key={item.label} label={item.label} value={item.value} />
      ))}
    </Box>
  );
};

// ─── Schema result ────────────────────────────────────────────────────────────

const SchemaResultDetails = ({ result }) => {
  const [expandedTables, setExpandedTables] = useState(() => new Set());
  const schemaDetailsId = useId();
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  const tables = toArray(result.tables);
  const columnsByTable =
    result.columns && typeof result.columns === 'object' ? result.columns : null;
  const hasColumnPayload = Boolean(columnsByTable);

  const toggleTable = (table) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  return (
    <Box>
      <ToolMetaGrid
        items={[
          { label: 'Database', value: result.database },
          { label: 'Tables', value: result.table_count ?? tables.length },
          { label: 'Source', value: result.source },
        ]}
      />
      <DetailLabel>Tables</DetailLabel>
      {tables.length === 0 ? (
        <EmptyResult>No tables returned.</EmptyResult>
      ) : (
        <Box sx={{ display: 'grid', gap: 0 }}>
          {tables.map((table, index) => {
            const columns = resolveColumnsForTable(columnsByTable, table);
            const isExpanded = expandedTables.has(table);
            const canExpand = Boolean(columns?.length);
            const tableDetailsId = `${schemaDetailsId}-${index}`;
            const columnCountLabel = columns
              ? `${columns.length} column${columns.length !== 1 ? 's' : ''}`
              : 'not loaded';
            return (
              <Box
                key={table}
                sx={{
                  py: 0.5,
                  '&:first-of-type': { pt: 0 },
                  '&:last-of-type': { pb: 0 },
                }}
              >
                <ButtonBase
                  onClick={() => canExpand && toggleTable(table)}
                  disabled={!canExpand}
                  aria-expanded={canExpand ? isExpanded : undefined}
                  aria-controls={canExpand ? tableDetailsId : undefined}
                  aria-label={
                    canExpand
                      ? `${isExpanded ? 'Collapse' : 'Expand'} columns for ${table}`
                      : undefined
                  }
                  sx={{
                    ...(canExpand
                      ? getFlatStepControlSx(theme)
                      : { minHeight: { xs: 44, md: 32 } }),
                    width: '100%',
                    display: 'block',
                    textAlign: 'left',
                    px: { xs: 0.5, md: 1 },
                    py: 0.5,
                    cursor: canExpand ? 'pointer' : 'default',
                  }}
                  disableRipple
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 1.2,
                    }}
                  >
                    <Typography sx={{ ...type.primaryMono, minWidth: 0, overflowWrap: 'anywhere' }}>
                      {table}
                    </Typography>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.4,
                        flexShrink: 0,
                      }}
                    >
                      <Typography sx={type.metaLabel}>{columnCountLabel}</Typography>
                      {canExpand && (
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 15,
                            color: theme.palette.text.secondary,
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: TRANSITIONS.default,
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                  {canExpand && !isExpanded && (
                    <Box sx={{ mt: 0.4 }}>
                      <ColumnList columns={columns} limit={5} />
                    </Box>
                  )}
                </ButtonBase>
                <Collapse in={isExpanded} timeout={200} unmountOnExit>
                  <Box
                    id={tableDetailsId}
                    sx={{
                      px: { xs: 0.5, md: 1 },
                      pb: 0.5,
                      pt: 0,
                    }}
                  >
                    <ColumnList columns={columns} />
                  </Box>
                </Collapse>
                {!hasColumnPayload && (
                  <Typography sx={{ px: 0.25, pb: 0.6, ...type.metaLabel }}>
                    Column details were not included in this schema response.
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ─── Table columns result ─────────────────────────────────────────────────────

const TableColumnsResultDetails = ({ result, args }) => (
  <Box>
    <ToolMetaGrid
      items={[
        { label: 'Table', value: result.table || args?.table_name },
        { label: 'Columns', value: result.column_count ?? toArray(result.columns).length },
        { label: 'Source', value: result.source },
      ]}
    />
    <DetailLabel>Columns</DetailLabel>
    <ColumnList columns={result.columns} />
  </Box>
);

// ─── Foreign keys result ──────────────────────────────────────────────────────

const ForeignKeysResultDetails = ({ result, args }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  const rows = toArray(result.foreign_keys);

  return (
    <Box>
      <ToolMetaGrid
        items={[
          { label: 'Table', value: result.table || args?.table_name || 'All tables' },
          { label: 'Relationships', value: result.count ?? rows.length },
        ]}
      />
      <DetailLabel>Relationships</DetailLabel>
      {rows.length === 0 ? (
        <EmptyResult>No foreign key relationships returned.</EmptyResult>
      ) : (
        <Box sx={{ display: 'grid', gap: 0 }}>
          {rows.map((fk, index) => (
            <Box
              key={`${fk.table_name}-${fk.column_name}-${fk.referenced_table}-${fk.referenced_column}-${index}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
                alignItems: 'center',
                gap: { xs: 0.5, md: 1 },
                px: 0.5,
                py: 0.5,
                bgcolor: 'transparent',
              }}
            >
              <Typography sx={{ ...type.primaryMono, overflowWrap: 'anywhere' }}>
                {fk.table_name}.{fk.column_name}
              </Typography>
              <Typography sx={{ ...type.metaLabel, textAlign: { xs: 'left', md: 'center' } }}>
                →
              </Typography>
              <Typography sx={{ ...type.primaryMono, overflowWrap: 'anywhere' }}>
                {fk.referenced_table}.{fk.referenced_column}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Web search result ────────────────────────────────────────────────────────

const WebSearchResultDetails = ({ result, args }) => {
  const theme = useTheme();
  const interaction = getInteractionColors(theme);
  const type = getStepTypeScale(theme);
  const rows = toArray(result.results);
  const query = result.query || args?.query;

  return (
    <Box>
      <ToolMetaGrid
        items={[
          { label: 'Query', value: query },
          { label: 'Sources', value: result.count ?? rows.length },
        ]}
      />
      <DetailLabel>Citations</DetailLabel>
      {rows.length === 0 ? (
        <EmptyResult>No citations returned.</EmptyResult>
      ) : (
        <Box sx={{ display: 'grid', gap: 0 }}>
          {rows.map((item, index) => {
            const normalizedContent = normalizeCitationMarkdown(item.content);
            return (
              <Box
                key={`${item.url}-${index}`}
                sx={{
                  py: { xs: 0.85, sm: 1.1 },
                  px: 0,
                  bgcolor: 'transparent',
                }}
              >
                {/* Title link */}
                <Link
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: interaction.activeColor,
                    ...theme.typography.uiBodySm,
                    fontWeight: theme.typography.fontWeightMedium,
                    textDecoration: 'none',
                    overflowWrap: 'anywhere',
                    transition: TRANSITIONS.default,
                    [HOVER_CAPABLE_QUERY]: {
                      '&:hover': {
                        color: interaction.hoverColor,
                        textDecoration: 'underline',
                      },
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${interaction.focusRing}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  {index + 1}. {item.title || item.url || 'Untitled source'}
                </Link>

                {/* URL */}
                {item.url && (
                  <Link
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{
                      display: 'block',
                      mt: 0.2,
                      ...type.mutedMono,
                      color: interaction.restingColor,
                      textDecoration: 'none',
                      overflowWrap: 'anywhere',
                      transition: TRANSITIONS.default,
                      [HOVER_CAPABLE_QUERY]: {
                        '&:hover': {
                          color: interaction.hoverColor,
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        },
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${interaction.focusRing}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {item.url}
                  </Link>
                )}

                {/* Snippet content */}
                {normalizedContent && (
                  <Box
                    sx={{
                      mt: 0.6,
                      ...type.body,
                      lineHeight: 1.6,
                      '& p': { mt: 0, mb: 0.65 },
                      '& p:last-child': { mb: 0 },
                      '& strong': {
                        color: theme.palette.text.primary,
                        fontWeight: theme.typography.fontWeightMedium,
                      },
                      '& h1, & h2, & h3, & h4, & h5, & h6': {
                        mt: 0.65,
                        mb: 0.3,
                        color: theme.palette.text.primary,
                        ...theme.typography.uiBodySm,
                        fontWeight: theme.typography.fontWeightMedium,
                      },
                      '& a': {
                        color: interaction.restingColor,
                        textDecorationColor: theme.palette.border.subtle,
                        textUnderlineOffset: '3px',
                      },
                      [HOVER_CAPABLE_QUERY]: {
                        '& a:hover': {
                          color: interaction.hoverColor,
                        },
                      },
                      '& a:focus-visible': {
                        color: interaction.hoverColor,
                        outline: `2px solid ${interaction.focusRing}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <MarkdownRenderer content={normalizedContent} variant="compact" />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ─── Generic result ───────────────────────────────────────────────────────────

const GenericResultDetails = ({ stepName, result, isError }) => {
  const theme = useTheme();
  const type = getStepTypeScale(theme);
  return (
    <Typography
      sx={{
        ...type.body,
        color: isError ? theme.palette.error.main : type.body.color,
        lineHeight: 1.6,
      }}
    >
      {getDetailedResult(stepName, result)}
    </Typography>
  );
};

// ─── Entry point ──────────────────────────────────────────────────────────────

export function ToolResultDetails({ stepName, result, args, isError }) {
  if (isError)
    return <GenericResultDetails stepName={stepName} result={result} isError={isError} />;

  switch (stepName) {
    case 'get_schema_overview':
      return <SchemaResultDetails result={result} />;
    case 'get_table_columns':
      return <TableColumnsResultDetails result={result} args={args} />;
    case 'get_foreign_keys':
      return <ForeignKeysResultDetails result={result} args={args} />;
    case 'web_search':
      return <WebSearchResultDetails result={result} args={args} />;
    default:
      return <GenericResultDetails stepName={stepName} result={result} isError={isError} />;
  }
}
