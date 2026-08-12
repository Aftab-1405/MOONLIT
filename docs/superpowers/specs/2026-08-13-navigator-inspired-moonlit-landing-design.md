# Navigator-Inspired Moonlit Landing Page Design

## Objective

Replace Moonlit's current landing page with a tailored, product-accurate experience inspired by the Navigator template from PaulleDemon's `awesome-landing-pages` repository. The result should preserve Navigator's cinematic dark presentation while communicating Moonlit's real database-assistant capabilities and retaining the application's existing routing, authentication, theme, and accessibility behavior.

## Scope

This change is limited to the public landing page and its supporting presentation assets. It must not redesign the authenticated application, authentication page, backend, database connection flow, or global theme architecture.

The implementation will:

- Replace the current landing-page composition.
- Preserve Moonlit branding and product truth.
- Preserve authentication-aware CTA routing.
- Reuse the existing React 19, Material UI, Framer Motion, theme-token, icon, and routing infrastructure.
- Reuse Moonlit's existing PostgreSQL, MySQL, SQL Server, and Oracle logo assets.
- Add no runtime dependencies.
- Avoid fake customer logos, testimonials, metrics, pricing, articles, addresses, or enterprise claims.
- Preserve unrelated staged and unstaged repository changes.

## Source Reference and Attribution

The visual reference is the Navigator app template at:

`https://github.com/PaulleDemon/awesome-landing-pages/tree/main/src/apps/navigator`

The source repository is MIT licensed. The implementation will translate the visual concepts into the existing React/MUI system rather than importing the template's Tailwind build, Bootstrap Icons, GSAP scripts, or navigation-specific imagery. If any substantial source code or source asset is copied, its MIT copyright and permission notice must be retained in an appropriate third-party notice. Product mockups and page components should otherwise be implemented from Moonlit's existing design system and assets.

## Product Positioning

Moonlit is an AI database assistant for exploring relational databases through natural language. It supports PostgreSQL, MySQL, SQL Server, and Oracle, and provides schema discovery, generated SQL, read-only query execution, tables, charts, diagrams, and conversation memory.

The landing page should communicate this workflow directly:

1. Connect a supported database.
2. Ask a question in plain English.
3. Inspect the generated SQL and schema context.
4. Run a safe read-only query.
5. Explore the result as a table, chart, or diagram.

## Content Architecture

### 1. Navigation

The header contains:

- Moonlit brand mark and wordmark.
- Anchors for Product, Workflow, Security, and FAQ.
- A Sign in action that routes to `/auth`.
- A Get started action that uses the shared authentication-aware CTA handler.

Desktop navigation is visually transparent over the hero and gains enough background treatment to remain readable while scrolling. Mobile navigation uses the existing accessible MUI drawer pattern.

### 2. Hero

The hero uses a centered, cinematic composition inspired by Navigator:

- Eyebrow: `AI database assistant`.
- Primary headline: `Your database, understood.`
- Supporting copy explains natural-language questions, generated SQL, and verifiable results without claiming unsupported performance.
- Primary CTA: `Get started`.
- Secondary CTA scrolls to the product walkthrough.

The hero's dominant visual is a responsive Moonlit workspace mockup rather than Navigator's phone artwork.

### 3. Moonlit Workspace Mockup

The product mockup is built with lightweight React/MUI elements and reflects the actual application:

- A compact conversation area with a natural-language request.
- Schema context listing representative tables and columns.
- A generated read-only SQL query.
- A small results table or visualization.
- A connected-database status treatment.

The mockup is decorative and non-interactive. It must be hidden from assistive technology where its content duplicates nearby marketing copy. Its layout scales down without horizontal page overflow.

### 4. Supported Database Strip

A horizontally animated strip shows only the databases Moonlit currently supports:

- PostgreSQL
- MySQL
- SQL Server
- Oracle

The strip replaces Navigator's customer-logo carousel. Logos include accessible names when meaningful and the continuous movement stops or becomes static under reduced-motion preferences.

### 5. Sticky Product Walkthrough

On desktop, product benefits are listed alongside a sticky visual panel. On smaller screens, the content becomes a normal stacked sequence.

The walkthrough covers:

- Natural-language querying.
- Schema exploration.
- SQL inspection and refinement.
- Result visualization and artifacts.

The sticky panel changes emphasis as each benefit enters view, using local presentation state only. No network requests or application business logic are involved.

### 6. Capability Grid

Compact bordered cards describe truthful Moonlit capabilities:

- Multi-provider model support.
- Safe read-only query execution.
- Conversation memory and resumable sessions.
- Integrated SQL, table, chart, and diagram artifacts.

Cards use Moonlit's existing semantic tokens and icons.

### 7. Workflow

The workflow is presented in three steps:

1. `Connect` — configure a supported remote relational database.
2. `Ask` — describe the information needed in plain English.
3. `Inspect and act` — review generated SQL, run it, and explore the result.

### 8. Security

The security section communicates repository-backed behavior without overclaiming:

- Authenticated access.
- Read-only SQL enforcement.
- Query timeouts and result limits.
- Explicit database connections and controlled server-side execution.

It must not claim certifications, encryption guarantees, compliance programs, local-database access, or enterprise controls not implemented by the repository.

### 9. FAQ

The accessible accordion answers product-specific questions:

- Which databases are supported?
- Can Moonlit modify data?
- Can it connect to a database running on localhost?
- Can generated SQL be reviewed before execution?
- Which AI providers are supported?

Answers must match the README and current implementation. Accordion triggers are buttons with `aria-expanded` and keyboard support supplied by MUI.

### 10. Final CTA and Footer

The final CTA uses the message `Start exploring your data.` with the authentication-aware Get started action and the restrained note `No credit card required`, matching the existing account-creation flow.

The footer includes Moonlit branding, Product, Workflow, Security, FAQ, Sign in, and the current year. It does not include fake company addresses, social profiles, policy links, or contact routes that do not exist.

## Visual System

The landing page remains intentionally dark, consistent with Navigator's atmosphere and Moonlit's current forced-dark public routes.

- Canvas: near-black surfaces from the existing semantic theme.
- Accents: existing Moonlit purple, blue, and warm orange tokens.
- Typography: existing Inter and Geist Mono roles, with oversized gradient display text in the hero.
- Surfaces: thin borders, soft elevation through tonal contrast, and restrained radii.
- Atmosphere: blurred purple/blue glows and a subtle dot or grid texture implemented with CSS.
- Layout: generous vertical rhythm, centered hero, wide product frame, and controlled maximum content widths.

No new font, icon, animation, or styling dependency will be introduced.

## Motion and Interaction

Motion should support hierarchy rather than delay access to content:

- Hero copy and mockup enter with short fade/translate transitions.
- The mockup uses a subtle perspective tilt that settles slightly on scroll or entrance.
- Section headings and cards reveal as they enter the viewport.
- The database strip loops slowly on motion-capable devices.
- Sticky walkthrough emphasis changes smoothly.
- Hover effects are limited to hover-capable devices.

When `prefers-reduced-motion: reduce` is active:

- Smooth scrolling is disabled.
- Reveal content is immediately visible.
- Perspective transitions are removed.
- The database strip is static.
- No essential information depends on animation.

## Architecture

The implementation remains within `front-end/src/pages/Landing`. The page is divided into focused presentation components so no single file owns the entire page.

Expected responsibilities:

- `index.jsx`: page composition, navigation, footer, document title, and shared CTA routing.
- `Hero.jsx`: hero content and workspace mockup composition.
- `DatabaseStrip.jsx`: supported database display.
- `ProductShowcase.jsx`: sticky feature narrative and active visual treatment.
- `CapabilityGrid.jsx`: capability cards.
- `WorkflowSection.jsx`: three-step workflow.
- `SecuritySection.jsx`: security statements.
- `FaqSection.jsx`: accessible FAQ accordion.
- `FinalCTA.jsx`: final conversion section.
- `landingContent.js`: static copy and configuration arrays when extraction improves readability.
- `landingStyles.js`: shared landing-only style objects or animation definitions when needed.

Exact file boundaries may be reduced if a component is too small to justify a separate module, but responsibilities must remain clear and tests should target public behavior rather than implementation details.

## Data Flow

The landing page contains no remote data fetching.

- `Landing` reads `isAuthenticated` and `loading` from the existing auth context.
- `Landing` owns the shared Get started callback.
- The callback routes authenticated users to `/chat` and unauthenticated users to `/auth`, preserving current behavior.
- Presentation sections receive callbacks or static content through props.
- FAQ expansion state remains local to the accordion component.
- Product-showcase emphasis state remains local and presentation-only.

## Responsive Behavior

### Mobile

- Navigation collapses into a right-side drawer.
- Hero typography and CTAs stack.
- The workspace mockup simplifies and hides nonessential panes.
- Sticky walkthrough becomes a stacked list.
- Cards use one column.
- Logo movement does not create horizontal page overflow.

### Tablet

- Hero and mockup retain the main composition at reduced scale.
- Cards may use two columns.
- Navigation switches at the existing MUI breakpoint.

### Desktop

- Full navigation is visible.
- Hero workspace uses perspective and atmospheric glow.
- Product walkthrough uses the sticky split layout.
- Capability cards use a balanced multi-column grid.

## Accessibility

- Use semantic `header`, `nav`, `main`, `section`, and `footer` landmarks.
- Maintain one page-level `h1` and sequential section headings.
- Use real links and buttons rather than clickable generic elements.
- Provide visible focus states.
- Ensure drawer and accordion controls have accessible names and state.
- Mark decorative mockup content and background effects appropriately.
- Maintain color contrast using the existing semantic theme and contrast-audit scripts.
- Ensure touch targets are at least 44 by 44 pixels where practical.
- Ensure all content remains available with motion disabled.

## Error and Edge-Case Handling

- While authentication is loading, preserve the current safe CTA behavior rather than blocking the landing page.
- Missing decorative images must not remove the adjacent textual message.
- Long text must wrap without overlap or horizontal overflow.
- The page must remain usable when JavaScript animation APIs or intersection observers are unavailable; content defaults to visible.
- Hash navigation must account for the header and work with reduced motion.
- Accordion answers must remain available through keyboard interaction.

## Testing and Validation

Implementation validation will include:

- Targeted linting for changed landing-page files.
- Full frontend ESLint run when practical.
- Frontend production build.
- Existing `audit:interaction` and `audit:theme` scripts.
- Relevant existing frontend tests if a landing-page test harness is present.
- Manual checks at representative mobile, tablet, and desktop widths.
- Keyboard navigation through header, drawer, CTAs, and FAQ.
- Reduced-motion verification.
- Authentication-aware CTA verification for signed-in, signed-out, and loading states.
- Hash-link and document-title verification.
- Review of every changed file for dead code, debug statements, unused imports, accidental formatting, and unrelated edits.
- Final staged/unstaged diff review to confirm unrelated work remains intact.

## Acceptance Criteria

- The root route renders the new Navigator-inspired Moonlit landing page.
- The page is unmistakably Moonlit rather than a navigation-app template.
- All claims correspond to implemented Moonlit capabilities.
- The hero includes a responsive Moonlit workspace mockup.
- PostgreSQL, MySQL, SQL Server, and Oracle are represented using existing assets.
- All header and CTA navigation works with the existing router and auth state.
- The page is responsive without horizontal overflow.
- The page is keyboard accessible and respects reduced-motion preferences.
- No new runtime dependency is added.
- The frontend builds successfully and relevant lint/audit checks pass, or any pre-existing failures are reported precisely.
- Unrelated staged and unstaged work is preserved.
