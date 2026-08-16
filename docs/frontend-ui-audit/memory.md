# Project Memory

## Current Focus

Current phase: Phase 4 — Authentication and administration
Current task: Audit authenticated entry, validation/provider states, guards, and authorized admin
surfaces
Current component: Auth page, route guards/loaders, and AdminDashboard
Current file(s): `pages/Auth.jsx`, `pages/AdminDashboard.jsx`, `guards/**`, and directly shared form
or dialog primitives
Status: Phase 3 complete; Phase 4 audit/plan complete and awaiting authorization-scope approval

## Recently Completed

Date: 2026-08-16
Task: Phase 3C renderer internals and Phase 3 completion
Summary: Replaced nested SQL query-tab interactions with sibling native tab/Close controls and a
stable active tabpanel; restored true-modal focus ownership and reduced-motion behavior to the
schema mindmap; and completed public-wrapper semantics/containment for Perspective without changing
query state, graph layout, or third-party data/configuration behavior.
Files changed: SQL QueryTabs/QueryWorkspace, SchemaMindmapDialog, data-visualization wrappers, the
focused workspace audit, Phase 3 plan checklist, and audit documentation.
Validation: Seven Node tests; workspace, dark, theme, interaction, and input-focus audits; full
lint; Knip; production build; diff check; and the cumulative authenticated Phase 3 browser matrix
passed. The diagram fixture covered artifact behaviors and responsive breakpoints. SQL, schema, and
Perspective live states remain unavailable without a safe connected-database fixture. Opening the
SQL entry only confirmed and canceled the prerequisite dialog. No database, query, conversation,
setting, account, download, or clipboard mutation occurred. The known Perspective chunk warning
remains.
Important decisions: Active SQL tabs alone reference the mounted panel; native tab/Close controls
remain independently focusable without a partial roving-tabindex implementation; the mindmap uses
MUI modal ownership; Perspective internals remain untouched.

Date: 2026-08-16
Task: Phase 3B artifact shell and fullscreen compliance
Summary: Added responsive artifact action geometry and semantic loading/error states; supplied
bounded separator values; made fullscreen a named, locally keyboard-owned region with deterministic
entry/return focus and reduced-motion behavior; retained one renderer instance; and removed the
desktop resize separator from narrow full-screen overlays after browser testing exposed a 10px
width loss.
Files changed: Shared artifact layout/loader utilities, ResizeHandle, workspace-canvas bounds wiring,
MainInterface narrow topology, the focused workspace audit, and Phase 3 documentation.
Validation: Seven Node test files; workspace, dark, theme, interaction, and input-focus audits; full
lint; Knip; production build; diff check; and authenticated diagram browser checks passed. Browser
coverage included pointer/keyboard resize, fullscreen focus/Escape/return, state preservation,
close, 390×844, 767px, 768px, and overflow. Reduced motion is covered by the executable hook/style
contract because the available browser viewport capability does not emulate media preferences. The
existing Perspective chunk warning remains. A historical Emotion `:first-child` console entry did
not reproduce on a fresh loaded reload and was not changed speculatively.
Important decisions: Fullscreen interaction stays local to the persistent artifact root; narrow
artifact overlays never render the desktop separator; artifact actions retain their caller-defined
desktop size while becoming 44px touch targets below 768px.

Date: 2026-08-16
Task: Phase 3A shared overlays/preferences plus interruption fixes
Summary: Added the focused workspace-overlay audit; made preference, dialog, confirmation, and
notification controls responsive; coordinated mobile drawer exit with Settings/Database entry;
added deterministic focus entry/return and topmost Escape ownership; separated toast duration from
visual motion; fixed artifact action `key` spreading and deprecated drawer motion creation; and
stabilized workspace-canvas callbacks so left-sidebar animation no longer reconciles long message
lists.
Files changed: Preference surfaces, Settings/Database overlays, shared Drawer/Dialog/Confirm/toast
primitives, chat/sidebar controller wiring, artifact header action mapping, workspace-canvas hook,
the focused Phase 3 audit, and Phase 3 specification/plan documentation. `front-end/DESIGN.md` was
not changed.
Validation: Seven Node test files; workspace, dark, theme, interaction, and input-focus audits; full
lint; Knip; and production build passed. Browser checks covered desktop, 390px, 767px, and 768px,
drawer-to-overlay sequencing, focus entry/return, nested Escape order, confirmation cancellation,
artifact warning removal, and long-transcript sidebar render isolation. The existing Perspective
chunk-size warning remains.
Important decisions: Keep one overlay owner and wait for mobile drawer exit before opening a
preference surface; keep dialog helper logic outside component files for Fast Refresh; use refs to
read current sidebar width without changing callback identity; preserve Settings Reset behavior
for now. Browser review exposed that Reset applies immediately; the prior Mistral model was
restored, leaving no intended settings change.

Date: 2026-08-15
Task: Phase 2 sidebar and conversation-history compliance
Summary: Added deterministic conversation-list loading/error/retry state; replaced nested row
interactions with sibling native selection/options controls; added the canonical active indicator,
8px rename chrome, and 44px sub-768 geometry; made Search and collapsed History focus deterministic;
removed unsupported shortcut labels; and upgraded the animated mobile drawer to MUI modal focus
ownership with reduced-motion support.
Files changed: Sidebar components/styles, shared Drawer and obsolete selectable-row helper,
conversation/controller hooks, focused model tests, interaction audit, Phase 2 spec/plan, and audit
documentation. `front-end/DESIGN.md` was not changed.
Validation: Six Node tests, four design audits, full lint, Knip, and production build passed. The
build retains the existing Perspective chunk warning. Authenticated browser checks passed for
expanded/collapsed desktop, Search/History initial focus, active-row semantics, 390/767px modal
drawer focus and Escape behavior, nested popover ordering, the 768px topology boundary, focus
restoration, and zero overflow. The viewport was reset and the desktop sidebar restored expanded.
No conversation, database, account, or settings data was changed.
Important decisions: Preserve the shared Drawer composition while delegating modal behavior to
MUI; keep compact 36px desktop rows and use 44px controls below 768px; retain existing rows during
background refresh failures; do not advertise shortcuts until handlers exist.

Date: 2026-08-15
Task: Sidebar Profile and Settings separation correction
Summary: Split the sidebar footer into independent Profile and Settings controls. Profile now opens
an informational account popover with avatar, display name, email, provider, verification status,
member-since date, last-sign-in date, and Sign out. The expanded desktop/mobile gear opens Settings
directly; the collapsed desktop Profile popover supplies the explicit Settings fallback. Safe
account metadata is normalized at the auth boundary without exposing raw Firebase objects or UID.
Files changed: Auth normalization utility/tests, `AuthContext.jsx`, sidebar footer/model/tests,
sidebar controller wiring, `UserProfileMenu.jsx`, `MainInterface.jsx`, and focused design/plan
documents. `front-end/DESIGN.md` was not changed.
Validation: Five Node test entries passed; dark, theme, interaction, and input-focus audits passed;
lint and Knip passed; production build passed with the existing Perspective chunk warning.
Authenticated browser checks passed for separate expanded controls, direct Settings, collapsed
Settings fallback, account details, Sign out presence, 44px mobile controls, modal/drawer
coordination, and zero overflow. The viewport and desktop sidebar were restored to 1302×926 and
expanded. No settings, account, conversation, or database data was changed.
Important decisions: Mobile is always treated as an expanded profile surface regardless of the
persisted desktop sidebar preference; collapsed Settings access belongs in the Profile popover;
backend `verified` is authoritative over Firebase `emailVerified` when present.

Date: 2026-08-15
Task: Phase 1C transcript, Markdown, tables, and agent-state geometry
Summary: Normalized transcript typography and spacing, aligned Markdown/execution-table/code
surfaces to their semantic tokens, moved copy/code/reasoning/tool/diagram controls onto shared
responsive pill geometry, and corrected guided-confirmation stacking and focus treatment. Message
ordering, tool execution, streaming data flow, and artifact behavior were preserved.
Files changed: `MessageList.jsx`, `MarkdownRenderer.jsx`, `CodeViewer.jsx`,
`InlineExecutionTable.jsx`, `GuidedConfirmationPrompt.jsx`, `ai-response-steps/**`, shared interface
chrome, the interaction audit, and Phase 1C design/plan/audit documentation. `front-end/DESIGN.md`
was not changed.
Validation: Three focused Node tests passed; dark, theme, interaction, and input-focus audits
passed; lint and Knip passed; the production build passed with the existing Perspective chunk
warning. Authenticated computed-style checks passed at 1302×926 and 390×844 for responsive sizes,
pill radii, shadows, typography,
composer visibility, and overflow. Expanded reasoning and tool details were exercised; the browser
was restored to 1302×926.
Important decisions: Keep one shared responsive control contract (44px below 768px, compact desktop
sizes at and above 768px); use `#191919` for paper/table surfaces and `#1a1c20` for fenced code; treat
unavailable streaming/code/table/confirmation/pause/error examples as explicit fixture limitations,
not as evidence of visual browser compliance.

Date: 2026-08-15
Task: Phase 1B final authenticated evidence and focused surface consistency fixes
Summary: Restored the signed-in browser session, captured the final 390/767/768px chat matrix,
repeated Settings at 767/768px, and reset the temporary viewport. The composer and all form inputs
now use the canonical neutral `#191919` input surface without nested focus outlines/shadows. The
Auth fields and chat composer retain a single border. The AI Context segmented control now consumes
the shared transparent-wrapper pattern, and the Connect Database Connection mode row no longer adds
an unnecessary nested tint. Shared multi-row preference styling remains unchanged.
Files changed: Chat/Auth/theme/shared input styles, focused audit scripts, AI Context and Database
preference call sites, plus their design/implementation documents. `front-end/DESIGN.md` was not
changed.
Validation: Dark, theme, interaction, and input-focus audits passed; lint and Knip passed;
production build passed with the existing Perspective chunk warning. Computed browser checks
confirmed zero horizontal overflow, 44px mobile controls below 768px, 36px controls at 768px,
transparent redundant wrappers/rows, and preserved selected-state fills.
Important decisions: Use `#191919` for all canonical input surfaces; input focus must not add a
second visual outline or shadow; shared segmented-control styling owns button state while local
single-row preference surfaces may remove redundant tint without changing the shared row API.

Date: 2026-08-15
Task: Phase 1B chat shell, empty state, composer, and responsive boundary
Summary: Moved the global desktop boundary to 768px, mapped the composer to the canonical
`#191919` input surface, routed welcome typography through `uiDisplaySm`, centralized responsive
chat-control geometry and layout spacing, made mobile/tablet controls touch-safe, corrected the
sidebar and scroll-control radii, and added the composer focus ring. Chat handlers and data flow
were not changed.
Files changed: Theme tokens, semantic tokens, shared interface chrome, chat welcome/composer/column,
theme/interaction audit scripts, Phase 1B specification/plan, and frontend audit documentation.
`front-end/DESIGN.md` was not changed.
Validation: Three Node tests passed; lint, Knip, dark-only, theme, and interaction audits passed;
production build passed with the existing Perspective chunk warning. Authenticated computed-style
checks at 390/767/768px passed for typography, surface, pill geometry, control sizes, spacing, shell
topology, focus, menu dismissal, and overflow. Settings and Database rendered without horizontal
overflow at 767/768px. No message was sent, no data was reset, and no database was connected. The
session redirected to `/auth` before final screenshots and one repeated Settings pass.
Important decisions: Keep the global 768px `md` breakpoint; use runtime style-helper audits instead
of brittle JSX source-text checks; defer preference-surface 34px controls and mobile modal focus
restoration to the preference-surface accessibility phase.

Date: 2026-08-15
Task: Phase 1A canonical dark-theme foundation
Summary: Made every route resolve to one canonical dark MUI theme, removed the Appearance/light
control and light theme factory, ignored legacy stored/server theme preferences, collapsed semantic
tokens and Shiki/CodeMirror/Perspective integrations to dark, and added executable dark-only
invariants.
Files changed: Frontend boot/runtime/settings/theme and syntax files, audit scripts, focused tests,
Knip configuration, README, and frontend audit documentation. `front-end/DESIGN.md` was not
changed.
Validation: Three Node tests passed; dark-only, theme, and interaction audits passed; lint and
Knip passed; production build passed with the existing oversized Perspective chunk warning.
Browser checks passed for `/`, `/auth`, unauthenticated `/chat` redirect, the authenticated chat
shell, Settings, and the database prerequisite dialog. Settings opens on Moonlit with no
Appearance/Light control. The SQL editor requires a database connection and code-block rendering
requires a conversation, neither of which exists for the dummy account. Console review also found
two duplicate-account sign-up errors and a pre-existing Framer Motion deprecation warning unrelated
to the theme implementation.
Important decisions: The frontend ignores legacy `theme` values without changing backend schemas.
`useTheme()` retains `isDarkMode` and `effectiveTheme` compatibility fields as constant dark values.

Date: 2026-08-15
Task: Read-only design and repository audit
Summary: Read the full canonical design, mapped frontend architecture and chat composition,
classified initial compliance gaps, established validation baseline, and defined incremental
phases.
Files changed: Documentation files only. `front-end/DESIGN.md` and UI code were not changed.
Validation: Frontend lint passed; build passed with an existing oversized Perspective chunk
warning; theme and interaction audits passed their current assertions; landing content test
passed; unauthenticated browser check redirected `/chat` to `/auth` and produced no console
warnings/errors.
Important decisions: Remove light mode in Phase 1A. A future light theme is a separate project and
requires an approved canonical design extension.

## In Progress

Task: Phase 4 authentication and administration compliance.
Files: Auth, AdminDashboard, guards/loaders, directly shared form/dialog primitives, and—only with
explicit approval—the backend admin dependency/context metrics endpoints.
Remaining work: Execute the approved Phase 4 plan for deterministic auth operations, shared reset
dialog/loading states, guard contracts, admin presentation, and authoritative metrics authorization.
Blockers: The dummy account is not an administrator and correctly redirects `/admin` to `/chat`.
More importantly, the backend metrics/stream/reset endpoints currently authenticate users but do
not enforce the client dashboard's administrator boundary; expanding the UI phase to correct this
backend authorization behavior requires explicit approval.

## Important Decisions

- `front-end/DESIGN.md` remains authoritative and immutable.
- Use foundation-first sequencing: canonical dark theme before chat component corrections.
- Preserve existing architecture and user-owned staged changes.
- Do not commit automatically while the repository contains the current large staged change set.
- Use Inter as the documented Universal Sans substitute and Geist Mono for technical captions.
- Canonical input surfaces use `#191919`; focused inputs do not add nested outlines or shadows.
- Preference segmented controls use transparent wrappers with button-level selected states.
- Transcript and agent controls share responsive pill geometry: 44px below 768px and compact
  desktop sizing from 768px.
- Semantic transcript surfaces use paper `#191919` for Markdown/execution tables and code
  `#1a1c20` for fenced code.
- Sidebar selection/options are sibling native controls; active rows use a white leading indicator.
- Mobile drawer modal ownership belongs to MUI; Framer Motion provides animation only.
- Mobile drawer exit must complete before a Settings/Database overlay opens.
- Workspace-canvas callbacks consumed by the transcript must stay stable across sidebar-width
  changes; current layout width is read through a ref.
- Shared dialog action geometry belongs in a non-component style module so Fast Refresh boundaries
  remain valid.
- Artifact fullscreen owns Escape on its focusable region and restores the connected invoking
  control; document-level fullscreen key listeners are prohibited.
- Narrow artifact overlays omit the desktop resize separator so the artifact consumes the complete
  viewport width; the separator remains keyboard/pointer operable from 768px.
- SQL query tabs use sibling native selection and Close controls; only the active tab references
  the currently mounted tabpanel.
- Whole-screen schema mindmap focus/Escape/restoration belongs to MUI Dialog; graph internals remain
  unchanged.
- Perspective compliance changes stop at public React wrappers and semantic states; third-party
  worker/data/configuration/shadow-DOM behavior is out of scope without a verified defect.

## Design Deviations Approved by User

None.

Removing light mode is compliance with the current canonical design, not a deviation. The desire
to reintroduce it later does not authorize a deviation now.

## Known Issues

- Chat-specific automated and visual regression coverage is limited.
- Production build reports an oversized Perspective vendor chunk.
- Phase 1C lacks repeatable visual fixtures for fenced code, execution tables, active streaming,
  guided confirmation, paused execution, and error presentation; executable source contracts cover
  those states until fixtures are available.
- Phase 2 lacks repeatable browser fixtures for initial list failure, successful empty history, and
  failed rename/delete operations; focused model/source contracts cover these states.
- Settings “Reset to defaults” applies immediately without confirmation.
- Live SQL editor, schema mindmap, and Perspective browser coverage requires a safe connected
  database fixture that is not available for the current dummy account.
- Admin metrics, stream, and reset endpoints currently lack server-side administrator enforcement;
  client `AdminRoute` is not an authorization boundary. This is already corroborated by the
  repository security audit and is the Phase 4 approval gate.

## Technical Debt

- Large chat/sidebar presentation files increase review risk.
- Root README implementation details are partly stale relative to the current code.
- Repeatable authenticated database and conversation fixtures are not yet available for editor
  and code-block checks.

## Open Questions

- What canonical light palette and component behavior should a future `DESIGN.md` extension define?
- What authenticated local fixture should be used for repeatable browser checks?

## Next Recommended Task

After approval, execute the Phase 4 plan including the recommended fail-closed backend admin check.
If backend scope is declined, limit work to Auth/guard/admin presentation and retain the security
finding as an explicit unresolved blocker rather than implying the dashboard is protected.
