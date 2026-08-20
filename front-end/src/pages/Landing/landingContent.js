const freezeContent = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeContent);
    Object.freeze(value);
  }
  return value;
};

export const NAV_LINKS = Object.freeze([
  { label: 'Product', href: '#product' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Security', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]);

export const DATABASES = Object.freeze([
  { name: 'PostgreSQL', logo: '/logo-postgresql.svg' },
  { name: 'MySQL', logo: '/logo-mysql.svg' },
  { name: 'SQL Server', logo: '/logo-microsoft-sql-server.svg' },
  { name: 'Oracle', logo: '/logo-oracle.svg' },
]);

export const LANDING_COPY = freezeContent({
  documentTitle: 'Moonlit - AI Database Agent',
  accountFlow: 'Sign in to connect a database and begin a conversation.',
  hero: {
    eyebrow: 'AI database agent',
    title: 'Lower the technical barrier without removing technical control.',
    description:
      'Moonlit is a database agent for asking natural-language questions while keeping schema context and generated SQL visible to inspect.',
    proof: 'PostgreSQL, MySQL, SQL Server, and Oracle',
  },
  sectionHeading: {
    eyebrow: 'Product story',
    title: 'A connected path from question to result.',
    description:
      'Moonlit carries the question through database context, schema discovery, visible SQL, bounded execution, and an inspectable result artifact.',
  },
  finalCta: {
    eyebrow: 'Start with the question',
    title: 'Keep the database work visible.',
    description:
      'Ask in plain language, then inspect the schema, SQL, and result in the same workspace.',
  },
  footer: {
    tagline: 'Moonlit is an AI database agent and workspace for inspectable database analysis.',
  },
});

export const PRODUCT_STAGES = freezeContent([
  {
    id: 'question',
    number: '01',
    eyebrow: 'Question',
    title: 'Start with the answer you need.',
    description:
      'Ask for revenue by region in plain language instead of beginning with SQL syntax.',
    metadata: 'Question received',
  },
  {
    id: 'context',
    number: '02',
    eyebrow: 'Context',
    title: 'Ground the request in the connected database.',
    description:
      'The agent works from the configured PostgreSQL connection and its available schema context.',
    metadata: 'Connection configured',
  },
  {
    id: 'schema',
    number: '03',
    eyebrow: 'Schema',
    title: 'Inspect the tables and their relationship.',
    description:
      'Schema explorer details keep orders, regions, columns, and the relationship edge in view.',
    metadata: 'Schema inspected',
  },
  {
    id: 'sql',
    number: '04',
    eyebrow: 'SQL',
    title: 'Review the generated query before it runs.',
    description: 'Query 1 keeps the read-only aggregate visible in an editor with line numbers.',
    metadata: 'SQL visible',
  },
  {
    id: 'execution',
    number: '05',
    eyebrow: 'Execution',
    title: 'Run a bounded read-only query.',
    description: 'Execution validates read-only SQL and applies configured row and timeout limits.',
    metadata: 'Read only · bounded',
  },
  {
    id: 'artifact',
    number: '06',
    eyebrow: 'Artifact',
    title: 'Continue from returned rows to an artifact.',
    description: 'Query Results can open as a FINOS Perspective Datagrid for further inspection.',
    metadata: 'Query Results · Datagrid',
  },
]);

export const PRODUCT_DEMO = freezeContent({
  question: 'Show revenue by region for this year.',
  database: {
    engine: 'PostgreSQL',
    name: 'moonlit_analytics',
    connectionLabel: 'PostgreSQL connected',
  },
  agent: {
    contextStatus: 'Schema context ready',
    activeTool: 'execute_query',
    toolStatus: 'succeeded',
  },
  schema: {
    label: 'Schema explorer',
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'uuid' },
          { name: 'region_id', type: 'uuid' },
          { name: 'total', type: 'numeric' },
          { name: 'ordered_at', type: 'timestamp with time zone' },
        ],
      },
      {
        name: 'regions',
        columns: [
          { name: 'id', type: 'uuid' },
          { name: 'name', type: 'text' },
        ],
      },
    ],
    relationships: [
      {
        from: 'orders.region_id',
        to: 'regions.id',
        label: 'orders.region_id → regions.id',
      },
    ],
  },
  query: `SELECT r.name AS region, SUM(o.total) AS revenue, COUNT(*) AS order_count
FROM orders AS o
JOIN regions AS r ON o.region_id = r.id
WHERE o.ordered_at >= date_trunc('year', CURRENT_DATE)
GROUP BY r.name
ORDER BY revenue DESC;`,
  execution: {
    access: 'Read only',
    actionLabel: 'Run query',
    maxRows: 1000,
    timeoutSeconds: 30,
    states: ['running', 'succeeded'],
  },
  results: {
    columns: [
      { name: 'region', type: 'text' },
      { name: 'revenue', type: 'numeric' },
      { name: 'order_count', type: 'bigint' },
    ],
    rows: [
      ['North America', 842190, 1240],
      ['Europe', 618420, 980],
      ['Asia Pacific', 507860, 812],
    ],
    rowCount: 3,
    executionTimeMs: 84,
  },
  artifact: {
    title: 'Query Results',
    controls: [
      'Save analysis',
      'Copy current view as CSV',
      'Download current view as CSV',
      'Export visualization',
      'Reset analysis',
    ],
  },
});

export const CAPABILITIES = freezeContent([
  {
    id: 'schema-context',
    eyebrow: 'Schema context',
    title: 'Inspect the data behind the answer',
    description:
      'Browse tables, columns, types, and relationship structure from the connected database.',
  },
  {
    id: 'visible-sql',
    eyebrow: 'Visible SQL',
    title: 'Keep generated SQL inspectable',
    description: 'Review, refine, copy, and run the generated query from the SQL workspace.',
  },
  {
    id: 'conversation-continuity',
    eyebrow: 'Conversation continuity',
    title: 'Continue without losing the thread',
    description:
      'Continue with follow-up questions in the same conversation while schema context, generated SQL, and returned results remain visible in the workspace.',
  },
  {
    id: 'integrated-artifacts',
    eyebrow: 'Integrated artifacts',
    title: 'Inspect results beyond the first row',
    description:
      'Move from query results into table and FINOS Perspective analysis artifacts in the workspace.',
  },
]);

export const TRUST_PATH = freezeContent([
  {
    id: 'authenticated-user',
    label: 'Authenticated user',
    description: 'Application access begins with an authenticated user.',
  },
  {
    id: 'configured-connection',
    label: 'Configured connection',
    description: 'The backend uses an explicitly configured database connection.',
  },
  {
    id: 'schema-context',
    label: 'Schema context',
    description: 'Database structure is available as context for the agent.',
  },
  {
    id: 'readonly-validation',
    label: 'Read-only validation',
    description: 'Query execution is limited to read-only SQL.',
  },
  {
    id: 'bounded-execution',
    label: 'Bounded execution',
    description: 'Row limits and timeouts constrain query execution.',
  },
  {
    id: 'result',
    label: 'Result',
    description: 'Returned rows remain available for inspection as a result artifact.',
  },
]);

export const AUDIENCE_POINTS = freezeContent([
  {
    id: 'natural-language-access',
    eyebrow: 'Natural-language access',
    title: 'Ask the business question directly.',
    description:
      'Moonlit helps people explore connected databases without starting from SQL syntax.',
  },
  {
    id: 'technical-control',
    eyebrow: 'Technical control',
    title: 'Keep the schema and SQL in view.',
    description:
      'Technical users can inspect context, review generated SQL, and examine returned rows.',
  },
]);

export const FAQS = freezeContent([
  {
    id: 'supported-databases',
    question: 'Which databases does Moonlit support?',
    answer:
      'Moonlit currently supports PostgreSQL, MySQL, Microsoft SQL Server, and Oracle databases that are reachable by the hosted backend.',
  },
  {
    id: 'write-access',
    question: 'Can Moonlit modify or delete my data?',
    answer:
      "Moonlit's execution path accepts a single SELECT or WITH statement and blocks direct INSERT, UPDATE, and DELETE statements. Effective access still depends on the database permissions assigned to the configured connection role.",
  },
  {
    id: 'localhost',
    question: 'Can Moonlit connect to a database on localhost?',
    answer:
      'The hosted Moonlit backend cannot reach a database bound only to your local machine. The database must be available over a network connection the backend can access.',
  },
  {
    id: 'sql-review',
    question: 'Can I review SQL before running it?',
    answer:
      'Yes. Generated SQL remains visible in the SQL workspace, where you can inspect, refine, copy, and explicitly run it.',
  },
  {
    id: 'providers',
    question: 'Which AI providers are available?',
    answer: 'Moonlit uses Amazon Bedrock model access when it is configured for the deployment.',
  },
]);

export function getLandingDestination({ loading, isAuthenticated }) {
  return loading || isAuthenticated ? '/chat' : '/auth';
}
