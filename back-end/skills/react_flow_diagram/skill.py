"""
react_flow_diagram — Skill for generating database schema visualizations
and workflow diagrams using the custom diagram-flow JSON format.

Injected when the user asks to visualize a schema, draw relationships,
create an ERD, or produce any kind of flow diagram.
"""

SKILL_NAME = "react_flow_diagram"
SKILL_DESCRIPTION = "Diagram output specification for schema and workflow visualizations."

# Regex patterns (matched case-insensitively against the lowercased user message)
SKILL_TRIGGERS: list = [
    r"\bdiagram\b",
    r"\bvisuali[sz]e?\b",
    r"\bschema map\b",
    r"\berd\b",
    r"\bentity.relation",
    r"\bflow\b",
    r"\bdiagram.flow\b",
    r"\bnode\b",
    r"\bedge\b",
    r"\brelationship.*(map|visual|chart|diagram)\b",
    r"\b(show|draw|render|generate).*(schema|table|relation|structure)\b",
    r"\bgraph\b",
]

SKILL_PROMPT = """
<skill name="react_flow_diagram">
<diagram_output>
For database schemas, query execution plans, or workflow diagrams, output ONLY valid JSON inside ```diagram-flow:

{
  "direction": "LR" | "TB",
  "nodes": [
    {
      "id": "node_id",
      "type": "entity" | "process" | "premium",
      "label": "Primary Title",
      "subtitle": "Secondary description or detail",
      "count": 42,
      "status": "ready" | "active" | "pending" | "blocked" | "disabled",
      "tags": ["tag1", "tag2"],
      "style": {
        "backgroundColor": "#hex",
        "color": "#hex",
        "borderColor": "#hex",
        "borderStyle": "solid" | "dashed" | "dotted",
        "borderWidth": "2px",
        "borderRadius": "8px",
        "boxShadow": "0 4px 8px rgba(0,0,0,0.15)"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "optional label",
      "type": "floating" | "smoothstep",
      "dashed": true | false,
      "animated": true | false,
      "style": {
        "stroke": "#hex",
        "strokeWidth": "2.5px"
      }
    }
  ]
}

DIAGRAM DESIGN RULES:
- Use custom styles, distinct colors, and premium properties (tags, status, count) to make diagrams visually premium, professional, and informative.
- You can use ANY standard CSS presentation properties inside the "style" object (e.g., padding, margin, fontSize, fontStyle, opacity, textShadow, background, etc.) EXCEPT layout-breaking properties (position, display, zIndex, width, height).
- For database schemas: use "entity" type for tables, label = table name, subtitle = row count or key column, tags = index names.
- For FK relationships: use animated edges with a label showing the FK column name.
- For query execution plans: use "process" type nodes, status to show cost level (active=cheap, pending=medium, blocked=expensive).
- Always use "LR" direction for wide schemas (>5 tables), "TB" for tall pipelines or query plans.
- Assign meaningfully contrasting colors to logically related table groups (e.g., all auth tables share one hue family, all order tables another).

WHEN TO PRODUCE A DIAGRAM:
- User asks to "visualize", "diagram", "show relationships", "draw the schema", "ERD", or similar.
- After get_schema_overview: proactively offer a diagram if the schema has multiple related tables and the user hasn't asked for it yet.
- Do NOT produce a diagram just because a table has foreign keys — wait for explicit or clearly implied intent.
</diagram_output>
</skill>
"""
