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

export const SHOWCASE_FEATURES = Object.freeze([
  {
    id: 'query',
    number: '01',
    eyebrow: 'Natural language',
    title: 'Ask the question, not the query.',
    description: 'Describe the answer you need. Moonlit uses your schema context to produce SQL you can inspect before it runs.',
  },
  {
    id: 'schema',
    number: '02',
    eyebrow: 'Schema context',
    title: 'Understand how the data connects.',
    description: 'Explore tables, columns, keys, and relationships without losing the thread of your conversation.',
  },
  {
    id: 'sql',
    number: '03',
    eyebrow: 'SQL workspace',
    title: 'Keep the generated SQL visible.',
    description: 'Review, refine, copy, and execute read-only SQL from a focused editor instead of trusting a hidden query.',
  },
  {
    id: 'results',
    number: '04',
    eyebrow: 'Integrated artifacts',
    title: 'Turn rows into something useful.',
    description: 'Continue from query results into tables, charts, and diagrams without exporting data into another workflow.',
  },
]);

export const CAPABILITIES = Object.freeze([
  {
    id: 'models',
    icon: 'ai',
    eyebrow: 'Model choice',
    title: 'Use the model that fits the task',
    description: 'Moonlit supports Gemini, Cerebras, Anthropic, and OpenAI when those providers are configured.',
    accent: 'twilight',
  },
  {
    id: 'readonly',
    icon: 'shield',
    eyebrow: 'Controlled execution',
    title: 'Read data without writing to it',
    description: 'Database execution is restricted to read-only SELECT queries, with result limits and timeouts.',
    accent: 'sunset',
  },
  {
    id: 'memory',
    icon: 'chat',
    eyebrow: 'Conversation memory',
    title: 'Resume with the context intact',
    description: 'Conversation history and agent state let you continue analysis across sessions.',
    accent: 'breeze',
  },
  {
    id: 'artifacts',
    icon: 'diagram',
    eyebrow: 'One workspace',
    title: 'Move between SQL and artifacts',
    description: 'Inspect queries, result tables, charts, and relationship diagrams beside the conversation.',
    accent: 'sunsetSoft',
  },
]);

export const WORKFLOW_STEPS = Object.freeze([
  { number: '01', title: 'Connect', description: 'Add a supported remote PostgreSQL, MySQL, SQL Server, or Oracle database.' },
  { number: '02', title: 'Ask', description: 'Describe the answer you need in plain English while Moonlit gathers schema context.' },
  { number: '03', title: 'Inspect and act', description: 'Review the SQL, run the read-only query, and explore the result as an artifact.' },
]);

export const SECURITY_POINTS = Object.freeze([
  { icon: 'auth', title: 'Authenticated access', description: 'Firebase identity and server-side session checks protect application access.' },
  { icon: 'readonly', title: 'Read-only execution', description: 'Moonlit accepts SELECT queries for database execution and rejects write operations.' },
  { icon: 'limits', title: 'Bounded queries', description: 'Configurable row limits and query timeouts keep database reads controlled.' },
  { icon: 'server', title: 'Server-side connections', description: 'Database connections are explicitly configured and executed through the backend.' },
]);

export const FAQS = Object.freeze([
  { id: 'supported-databases', question: 'Which databases does Moonlit support?', answer: 'Moonlit currently supports PostgreSQL, MySQL, Microsoft SQL Server, and Oracle databases that are reachable by the hosted backend.' },
  { id: 'write-access', question: 'Can Moonlit modify or delete my data?', answer: 'No. The database execution path is restricted to read-only SELECT statements, so generated queries cannot insert, update, or delete records.' },
  { id: 'localhost', question: 'Can Moonlit connect to a database on localhost?', answer: 'The hosted Moonlit backend cannot reach a database bound only to your local machine. The database must be available over a network connection the backend can access.' },
  { id: 'sql-review', question: 'Can I review SQL before running it?', answer: 'Yes. Generated SQL remains visible in the SQL workspace, where you can inspect, refine, copy, and explicitly run it.' },
  { id: 'providers', question: 'Which AI providers are available?', answer: 'The codebase supports Gemini, Cerebras, Anthropic, and OpenAI. A deployment exposes only providers that its operator has configured.' },
]);

export function getLandingDestination({ loading, isAuthenticated }) {
  return loading || isAuthenticated ? '/chat' : '/auth';
}
