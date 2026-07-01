---
name: react-flow-diagram
description: Produce grounded React Flow artifacts for schemas, ERDs, relationships, query plans, and workflows.
when_to_use: The requested output is a diagram, ERD, schema map, relationship graph, node/edge visualization, workflow graph, or diagram-flow artifact.
avoid_when: The user only asks for textual explanation, SQL/query results, or schema facts without requesting a visual artifact.
---

# React Flow Diagram

For database schemas, query execution plans, or workflow diagrams, output only valid JSON inside a fenced `diagram-flow` code block.

```diagram-flow
{
  "direction": "LR",
  "nodes": [
    {
      "id": "node_id",
      "type": "entity",
      "label": "Primary Title",
      "subtitle": "Secondary description",
      "count": 42,
      "status": "ready",
      "tags": ["tag1"],
      "style": {
        "backgroundColor": "#hex",
        "color": "#hex",
        "borderColor": "#hex",
        "borderStyle": "solid",
        "borderWidth": "2px",
        "borderRadius": "8px"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "optional label",
      "type": "floating",
      "dashed": false,
      "animated": true,
      "style": {
        "stroke": "#hex",
        "strokeWidth": "2.5px"
      }
    }
  ]
}
```

## Design Rules

Use distinct colors and meaningful tags/status/count fields when known. For database schemas, use `entity` nodes for tables. Set `label` to the table name, `subtitle` to the key column or relationship role, and `tags` to PK/FK/category facts.

For foreign keys, use animated edges with labels showing FK column names.

Use `LR` for wide schemas and `TB` for tall pipelines or query plans.

Do not use layout-breaking CSS properties inside `style`: `position`, `display`, `zIndex`, `width`, or `height`.

## Grounding Rules

Before producing a database schema diagram, use `get_schema_overview` unless the exact table list and FK relationships are already visible in active context.

If the user asks for "my schema", "entire schema", "full schema", or does not name a subset, include every table returned by `get_schema_overview`.

If showing only a subset, say it is a subset and name what was omitted.

Never invent row counts, index names, table names, columns, or relationships. Include `count` only when row count is explicitly available.

Edges must exactly match known relationships. Do not draw likely relationships based only on column names.

## When to Produce

Produce a diagram when the user asks to visualize, diagram, show relationships, draw schema, create an ERD, or similar.

After schema inspection, you may proactively offer a diagram if multiple related tables exist, but do not generate one unless intent is explicit or clearly implied.
