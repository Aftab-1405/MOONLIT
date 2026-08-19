import { readFileSync } from 'node:fs';
import * as interfaceChrome from '../src/features/styles/interfaceChrome.js';

const {
  COMPOSER_MAX_WIDTH,
  getComposerSurfaceSx,
  getWelcomeCategorySx,
  getWelcomeHeroSx,
  getWelcomeLayoutSx,
  getWelcomeSuggestionCloseSx,
  getWelcomeSuggestionPanelSx,
  INTERFACE_RADIUS,
} = interfaceChrome;
import { getFlatStepControlSx } from '../src/features/chat/ai-response-steps/timelineShared.js';
import { HOVER_CAPABLE_QUERY } from '../src/styles/mediaQueries.js';
import { getEffectiveThemeMode } from '../src/theme/mode.js';
import { BREAKPOINTS, SHAPE, SWITCH_GEOMETRY } from '../src/theme/tokens.js';
import { darkSemanticTokens } from '../src/theme/tokens/semantic.js';

const MODES = [['dark', darkSemanticTokens]];
const BACKGROUND_ROLES = ['default', 'paper', 'sunken'];

const parseColor = (value) => {
  if (value.startsWith('#')) {
    const raw = value.slice(1);
    const expanded = raw.length === 3 ? [...raw].map((channel) => `${channel}${channel}`).join('') : raw;
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${value}`);
  return { red: channels[0], green: channels[1], blue: channels[2], alpha: channels[3] ?? 1 };
};

const composite = (foreground, background) => ({
  red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
  green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
  blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
});
const linearChannel = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ red, green, blue }) =>
  0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
const contrast = (foregroundValue, backgroundValue) => {
  const background = parseColor(backgroundValue);
  const foreground = composite(parseColor(foregroundValue), background);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const results = [];
const failures = [];
const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const requireSource = (path, pattern, message) => {
  if (!pattern.test(readSource(path))) failures.push(message);
};
const requireSourceAbsent = (path, pattern, message) => {
  if (pattern.test(readSource(path))) failures.push(message);
};

if (BREAKPOINTS.values.md !== 768) {
  failures.push(`md breakpoint must be 768px; received ${BREAKPOINTS.values.md}px.`);
}

if (darkSemanticTokens.background.input !== '#191919') {
  failures.push(
    `Input surface must be #191919; received ${darkSemanticTokens.background.input}.`,
  );
}

if (SHAPE.radius.pill !== 9999) {
  failures.push(`Pill radius must remain 9999; received ${SHAPE.radius.pill}.`);
}

requireSource(
  'src/features/sidebar-left/index.jsx',
  /<SettingsIcon\s+sx=\{\{\s*fontSize:\s*18,\s*color:\s*'text\.secondary',\s*display:\s*'block'\s*\}\}\s*\/>/s,
  'sidebar profile/settings trigger must render the semantic SettingsIcon.',
);
requireSourceAbsent(
  'src/features/sidebar-left/index.jsx',
  /ExpandMoreIcon/,
  'sidebar profile/settings trigger must not use the disclosure caret icon.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
  /buildConversationSelectSx/,
  'conversation selection must use a dedicated native-button style contract.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
  /component="button"[\s\S]*aria-current=\{isActive \? 'page' : undefined\}/,
  'conversation selection must be a native button with page-current state.',
);
requireSourceAbsent(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
  /role=\{isRenaming \? 'group' : 'button'\}/,
  'conversation rows must not emulate a button around their options control.',
);
requireSourceAbsent(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
  /<ListItemButton/,
  'popover conversation rows must not nest an options button inside ListItemButton.',
);
const sidebarStylesSource = readSource('src/features/sidebar-left/styles/sidebarStyles.js');
const conversationRowStylesSource = sidebarStylesSource.slice(
  sidebarStylesSource.indexOf('export function buildConversationRowSx'),
  sidebarStylesSource.indexOf('export function buildConversationSelectSx'),
);
if (!/backgroundColor:\s*theme\.palette\.primary\.main/.test(conversationRowStylesSource)) {
  failures.push('the active conversation must expose the canonical white indicator.');
}
if (
  !/height:\s*\{\s*xs:\s*UI_LAYOUT\.touchTarget,\s*md:\s*ROW_HEIGHT\s*\}/.test(
    conversationRowStylesSource,
  )
) {
  failures.push('conversation rows must use 44px mobile and 36px desktop geometry.');
}
const sidebarPrimitivesSource = readSource(
  'src/features/sidebar-left/components/SidebarPrimitives.jsx',
);
if ((sidebarPrimitivesSource.match(/aria-current=\{isActive \? 'page' : undefined\}/g) || []).length !== 2) {
  failures.push('main and popover conversation selections must expose page-current state.');
}
const historyPopoverItemSource = sidebarPrimitivesSource.slice(
  sidebarPrimitivesSource.indexOf('export const HistoryPopoverItem'),
  sidebarPrimitivesSource.indexOf('export const HistoryListSkeleton'),
);
if (!/component="li"/.test(historyPopoverItemSource)) {
  failures.push('popover conversation rows must be owned list items.');
}
requireSourceAbsent(
  'src/hooks/chat-page/useConversations.js',
  /if \(showLoading && conversationsLoadSeqRef\.current === requestSeq\)/,
  'the latest request must settle visible list loading even when it is a background refresh.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /inputRef=\{searchInputRef\}/,
  'sidebar search must retain an explicit input focus target.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /onEntered:\s*\(\)\s*=>\s*searchInputRef\.current\?\.focus\(\)/,
  'sidebar search must focus its field after the popover enters.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /autoFocus=\{index === 0\}/,
  'collapsed history must focus its first conversation row.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /onEntered:\s*\(\)\s*=>\s*historyFirstItemRef\.current\?\.focus\(\)/,
  'collapsed history must reclaim first-row focus after the popover enters.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /aria-label="Search results"/,
  'sidebar search results must expose a list label.',
);
requireSource(
  'src/features/sidebar-left/components/SidebarOverlays.jsx',
  /aria-label="Conversation history"/,
  'collapsed conversation history must expose a list label.',
);
requireSourceAbsent(
  'src/features/sidebar-left/index.jsx',
  /Ctrl\+K|Ctrl\+Shift\+O/,
  'sidebar navigation must not advertise unsupported keyboard shortcuts.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /import \{[^}]*Modal[^}]*\} from '@mui\/material'/,
  'mobile drawer must delegate modal ownership to MUI Modal.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /useReducedMotion\(\)/,
  'mobile drawer must respect the user’s reduced-motion preference.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /initialFocusRef/,
  'mobile drawer must accept an explicit initial focus target.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /role="dialog"/,
  'mobile drawer panel must expose dialog semantics.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /aria-modal="true"/,
  'mobile drawer panel must identify itself as modal.',
);
requireSource(
  'src/components/ui/Drawer.jsx',
  /aria-label="Sidebar"/,
  'mobile drawer panel must expose an accessible name.',
);
requireSourceAbsent(
  'src/components/ui/Drawer.jsx',
  /document\.addEventListener\(['"]keydown['"]/,
  'mobile drawer must not compete with nested overlays for Escape handling.',
);
requireSource(
  'src/features/sidebar-left/index.jsx',
  /initialFocusRef=\{mobileCloseButtonRef\}/,
  'mobile sidebar must provide its close control as the initial focus target.',
);

requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /const greeting = getWelcomeGreeting\(\{\s*date:\s*new Date\(\),\s*displayName:\s*user\?\.displayName,?\s*\}\);/,
  'welcome heading must recompute the tested time-aware greeting from the current time during render.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /if \(!visible\) return undefined;[\s\S]*setTimeout\([\s\S]*getWelcomePeriodBoundaryDelay\(now\)[\s\S]*clearTimeout\(greetingTimerId\)/,
  'welcome heading must schedule and clean up a visibility-aware refresh at the next greeting boundary.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /component="img"[\s\S]*src="\/moonlit\.svg"[\s\S]*alt=""/,
  'welcome heading must use the existing decorative Moonlit mark.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /if \(!visible\) setActiveCategoryId\(null\)/,
  'welcome category state must reset when the welcome state ends.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /previousIsConnectedRef\.current !== isConnected[\s\S]*setActiveCategoryId\(null\)/,
  'welcome category state must reset when the connection-aware catalog changes.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeScreen.jsx',
  /width:\s*'100%',\s*maxWidth:\s*COMPOSER_MAX_WIDTH,\s*mx:\s*'auto',\s*display:\s*'flex'/,
  'welcome content must not cap the form outside its gutters and shrink the 672px composer surface.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /component="span"[\s\S]*minWidth:\s*0[\s\S]*overflowWrap:\s*'anywhere'/,
  'welcome names must wrap safely even when they contain no break opportunities.',
);
requireSource(
  'src/features/chat/WelcomeScreen.jsx',
  /runWelcomeEntry\(entry,[\s\S]*canSend:\s*!disabled\s*&&\s*!isStreaming/,
  'welcome prompts must preserve disabled and streaming guards.',
);
requireSource(
  'src/features/MainInterface.jsx',
  /onOpenDatabase=\{handleSidebarOpenDbModal\}/,
  'main interface must pass the existing database modal callback into chat.',
);
requireSource(
  'src/features/chat/ChatColumn.jsx',
  /<WelcomeScreen[\s\S]*onOpenDatabase=\{onOpenDatabase\}/,
  'chat column must pass the database modal callback to the welcome screen.',
);

requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /useReducedMotion\(\)/,
  'welcome suggestions must respect reduced motion.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /aria-label="Prompt categories"/,
  'welcome categories must expose a named list.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /role="region"[\s\S]*aria-label=\{`\$\{activeCategory\.label\} suggestions`\}/,
  'welcome suggestion panel must expose a named region.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /getSuggestionNavigationIndex/,
  'welcome suggestion keyboard behavior must use the tested navigation model.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /createWelcomeInteractionGuard[\s\S]*beginWelcomeStageTransition[\s\S]*runGuardedWelcomeActivation/,
  'the rendered welcome interaction must consume the tested transition and activation guard model.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /layout=\{reduceMotion \? false : 'size'\}/,
  'welcome stages must use a persistent size-layout wrapper for symmetric height motion.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /position:\s*'absolute',[\s\S]*top:\s*'100%',[\s\S]*left:\s*0,[\s\S]*right:\s*0,[\s\S]*zIndex:\s*3/,
  'welcome suggestions must be an anchored overlay so panel expansion never repositions the composer.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /initial=\{reduceMotion \? false : \{ opacity: 0, y: 6 \}\}[\s\S]*exit=\{reduceMotion \? \{ opacity: 0 \} : \{ opacity: 0, y: -4 \}\}/,
  'welcome stage motion must stay within 6px and omit translation under reduced motion.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /inert=\{interactionLocked \? true : undefined\}/,
  'welcome stages must become inert while their keyed tree exits.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /onExitComplete=\{handleExitComplete\}/,
  'welcome interaction locking must reset from AnimatePresence exit completion.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeSuggestions.jsx',
  /\b(?:initial|animate|exit)=\{[^\n]*height:/,
  'welcome stage height must be owned by the persistent layout wrapper rather than one-sided panel motion.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /<AnimatePresence mode="wait" initial=\{false\} onExitComplete=\{handleExitComplete\}>/,
  'welcome stages must replace sequentially so only one remains accessible and interactive.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /aria-disabled=\{isSuggestionDisabled\(entry\)\}/,
  'unavailable welcome suggestions must remain focusable with an accessible disabled state.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /if \(isSuggestionDisabled\(entry\)\) return;[\s\S]*runGuardedWelcomeActivation/,
  'aria-disabled welcome suggestions must guard activation.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /isWelcomeEntryDisabled[\s\S]*isWelcomeCategoryDisabled/,
  'the rendered welcome controls must consume the tested prompt/database availability model.',
);
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /disabled=\{isWelcomeCategoryDisabled\(category, availability\)\}/,
  'a mixed database category must remain reachable when only prompt actions are disabled.',
);
const welcomeSuggestionsSource = readSource('src/features/chat/WelcomeSuggestions.jsx');
if (!/moonlit:\s*AiSparkleIcon/.test(welcomeSuggestionsSource)) {
  failures.push("Moonlit's choice must use the app sparkle icon rather than a schema icon.");
}
if (!/sx=\{\(theme\) => getWelcomeSuggestionCloseSx\(theme\)\}/.test(welcomeSuggestionsSource)) {
  failures.push('welcome suggestion close control must use the shared compact close-control contract.');
}
if ((welcomeSuggestionsSource.match(/type="button"/g) || []).length !== 3) {
  failures.push(
    'welcome category, close, and suggestion controls must be non-submit buttons inside the composer form.',
  );
}
requireSource(
  'src/features/chat/WelcomeSuggestions.jsx',
  /'&\.Mui-focusVisible':[\s\S]*backgroundColor:\s*'action\.hover'[\s\S]*boxShadow:\s*'none'/,
  'welcome suggestion focus must use an intentional background without the default MUI shadow.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeSuggestions.jsx',
  /role="(?:tab|tabpanel|option|listbox)"/,
  'welcome actions must not use selection-widget roles.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeSuggestions.jsx',
  /mode="sync"/,
  'welcome stages must not overlap accessible keyed trees.',
);
requireSourceAbsent(
  'src/features/chat/WelcomeSuggestions.jsx',
  /disabled=\{disabled \|\| \(entry\.type === 'openDatabase' && !canOpenDatabase\)\}/,
  'suggestion rows must not use native disabled state because keyboard focus must remain deterministic.',
);

requireSource(
  'src/features/chat/MessageList.jsx',
  /getResponsivePillIconButtonSx\(theme,\s*\{\s*desktopSize:\s*30\s*\}\)/s,
  'transcript actions must consume 44px-mobile/30px-desktop pill geometry.',
);
requireSource(
  'src/features/chat/MessageList.jsx',
  /theme\.typography\.uiResponseBody/,
  'user messages must consume the response-body typography role.',
);
requireSource(
  'src/features/chat/MarkdownRenderer.jsx',
  /backgroundColor:\s*theme\.palette\.background\.paper/,
  'markdown tables must use the semantic card surface.',
);
requireSourceAbsent(
  'src/features/chat/MarkdownRenderer.jsx',
  /:first-child/,
  'markdown rendering must not use SSR-unsafe :first-child selectors; use :first-of-type.',
);
requireSource(
  'src/components/CodeViewer.jsx',
  /theme\.palette\.code\.background/,
  'code blocks must use the semantic code surface.',
);
requireSource(
  'src/components/CodeViewer.jsx',
  /getResponsivePillIconButtonSx\(theme,\s*\{\s*desktopSize:\s*28\s*\}\)/s,
  'code actions must consume 44px-mobile/28px-desktop pill geometry.',
);
requireSource(
  'src/features/chat/InlineExecutionTable.jsx',
  /backgroundColor:\s*theme\.palette\.background\.paper/,
  'execution tables must use the semantic card surface.',
);
for (const path of [
  'src/features/chat/ai-response-steps/index.jsx',
  'src/features/chat/ai-response-steps/StepTimelineItems.jsx',
  'src/features/chat/ai-response-steps/ToolResultDetails.jsx',
]) {
  requireSource(
    path,
    /getFlatStepControlSx\(theme\)/,
    `${path}: interactive reasoning rows must consume the responsive flat-step default.`,
  );
}
requireSource(
  'src/features/chat/ai-response-steps/StepTimelineItems.jsx',
  /const STEP_TITLE_MIN_HEIGHT = \{ xs: 44, md: 32 \};/,
  'timeline rows must retain 44px mobile and 32px desktop minimum heights.',
);
requireSource(
  'src/features/chat/GuidedConfirmationPrompt.jsx',
  /getResponsivePillControlSx\(theme,\s*\{\s*desktopHeight:\s*32\s*\}\)/s,
  'guided confirmation actions must consume responsive pill geometry.',
);
requireSource(
  'src/features/chat/GuidedConfirmationPrompt.jsx',
  /outline:\s*`2px solid \$\{theme\.palette\.border\.focus\}`/,
  'guided confirmation focus must use the canonical 2px outline.',
);
requireSource(
  'src/features/chat/GuidedConfirmationPrompt.jsx',
  /flexDirection:\s*\{ xs: 'column', md: 'row' \}/,
  'guided confirmation must retain the mobile stack through the 768px boundary.',
);
requireSource(
  'src/features/chat/ai-response-steps/index.jsx',
  /py:\s*0\.5/,
  'reasoning summaries must use 4px vertical spacing.',
);
requireSource(
  'src/features/chat/ai-response-steps/ToolResultDetails.jsx',
  /gap:\s*\{ xs: 0\.5, md: 1 \},\s*px:\s*0\.5,/s,
  'foreign-key result rows must use canonical responsive spacing.',
);
requireSource(
  'src/features/chat/ai-response-steps/ToolResultDetails.jsx',
  /gridTemplateColumns:\s*\{ xs: '1fr', md:/,
  'foreign-key result rows must retain their mobile stack through 768px.',
);

if (darkSemanticTokens.background.paper !== '#191919') {
  failures.push('card surface must remain #191919.');
}
if (darkSemanticTokens.background.sunken !== '#1a1c20') {
  failures.push('code surface must remain #1a1c20.');
}

const displaySm = Object.freeze({
  fontSize: Object.freeze({ xs: '1.75rem', md: '2rem' }),
  fontWeight: 400,
  lineHeight: 1.125,
  letterSpacing: '-0.6px',
});
const welcomeHero = getWelcomeHeroSx({
  typography: {
    uiDisplaySm: displaySm,
    uiHeadingHero: Object.freeze({ fontSize: '99rem' }),
  },
});

for (const property of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) {
  if (welcomeHero[property] !== displaySm[property]) {
    failures.push(`Welcome hero must consume typography.uiDisplaySm.${property}.`);
  }
}

const geometryTheme = {
  shape: { radius: { pill: 9999 } },
  spacing: (value) => `${value * 8}px`,
};

if (COMPOSER_MAX_WIDTH !== 672) failures.push('composer: maximum width must be 672px.');

if (typeof interfaceChrome.getResponsivePillControlSx !== 'function') {
  failures.push('chat controls: responsive pill geometry helper is missing.');
} else {
  const pill = interfaceChrome.getResponsivePillControlSx(geometryTheme, {
    desktopHeight: 36,
  });
  if (pill.height.xs !== 44 || pill.height.md !== 36 || pill.borderRadius !== 9999) {
    failures.push('chat controls: expected 44px mobile, 36px desktop, and pill geometry.');
  }
}

if (typeof interfaceChrome.getResponsivePillIconButtonSx !== 'function') {
  failures.push('chat icon controls: responsive pill geometry helper is missing.');
} else {
  const iconButton = interfaceChrome.getResponsivePillIconButtonSx(geometryTheme, {
    desktopSize: 40,
  });
  if (
    iconButton.width.xs !== 44 ||
    iconButton.width.md !== 40 ||
    iconButton.height.xs !== 44 ||
    iconButton.height.md !== 40 ||
    iconButton.minWidth?.xs !== 44 ||
    iconButton.minWidth?.md !== 40 ||
    iconButton.minHeight?.xs !== 44 ||
    iconButton.minHeight?.md !== 40 ||
    iconButton.borderRadius !== 9999
  ) {
    failures.push('chat icon controls: responsive target geometry mismatch.');
  }
}

if (typeof interfaceChrome.getComposerLayoutSx !== 'function') {
  failures.push('composer: responsive layout helper is missing.');
} else {
  const layout = interfaceChrome.getComposerLayoutSx(geometryTheme);
  if (
    layout.form.px.xs !== 0.5 ||
    layout.form.px.md !== 1 ||
    layout.content.px.xs !== 1.5 ||
    layout.content.px.md !== 2 ||
    layout.content.py !== 1.5 ||
    layout.toolbar.gap !== 1
  ) {
    failures.push('composer: responsive spacing contract mismatch.');
  }
}

if (typeof interfaceChrome.getWelcomeLayoutSx !== 'function') {
  failures.push('welcome: responsive layout helper is missing.');
} else {
  const welcomeLayout = interfaceChrome.getWelcomeLayoutSx();
  if (
    welcomeLayout.content.gap.xs !== 2 ||
    welcomeLayout.content.gap.md !== 3
  ) {
    failures.push('welcome: responsive spacing contract mismatch.');
  }
  if ('suggestions' in welcomeLayout) {
    failures.push('welcome: unused suggestions layout contract must be removed or consumed.');
  }
}

for (const [mode, tokens] of MODES) {
  for (const backgroundRole of BACKGROUND_ROLES) {
    const background = tokens.background[backgroundRole];
    const ratios = Object.fromEntries(
      ['idle', 'hover', 'focus', 'active'].map((state) => [
        state,
        contrast(tokens.border[state], background),
      ]),
    );

    results.push({
      mode,
      surface: backgroundRole,
      idle: ratios.idle.toFixed(2),
      hover: ratios.hover.toFixed(2),
      focus: ratios.focus.toFixed(2),
      active: ratios.active.toFixed(2),
    });

    if (!(ratios.idle < ratios.hover)) failures.push(`${mode}/${backgroundRole}: idle must be weaker than hover.`);
    if (!(ratios.hover < ratios.focus)) failures.push(`${mode}/${backgroundRole}: focus must be stronger than hover.`);
    if (Math.abs(ratios.active - ratios.idle) > 0.001) failures.push(`${mode}/${backgroundRole}: active must use the quiet hairline.`);
    if (ratios.focus < 3) failures.push(`${mode}/${backgroundRole}: focus must meet 3:1 contrast.`);
  }

  const composerTheme = { palette: tokens };
  const composer = getComposerSurfaceSx(composerTheme);
  if (composer.borderRadius !== '20px') failures.push(`${mode}/composer: radius must be 20px.`);
  if (composer.backgroundColor !== tokens.background.input) {
    failures.push(`${mode}/composer: surface must preserve the existing near-black input tone.`);
  }
  if (composer.border !== `1px solid ${tokens.border.idle}` || composer.boxShadow !== 'none') {
    failures.push(`${mode}/composer: idle boundary must be a single low-contrast 1px hairline without elevation.`);
  }
  if (composer['&:focus-within'] != null) {
    failures.push(`${mode}/composer: focus must not replace the subtle idle boundary.`);
  }

  const categoryControl = getWelcomeCategorySx(composerTheme);
  if (
    categoryControl.height.md !== 32 ||
    categoryControl.minHeight.xs !== 44 ||
    categoryControl.borderRadius !== '8px' ||
    categoryControl.px !== 1.5 ||
    categoryControl.gap !== 0.75
  ) failures.push(`${mode}/welcome category: responsive geometry mismatch.`);
  if (categoryControl['& .MuiButton-startIcon']?.m !== 0) {
    failures.push(`${mode}/welcome category: MUI start-icon margin must be reset to preserve the 6px gap.`);
  }
  const categoryFocus = categoryControl['&.Mui-focusVisible'];
  if (
    categoryFocus?.backgroundColor !== tokens.action.selected ||
    categoryFocus?.boxShadow !== 'none'
  ) {
    failures.push(`${mode}/welcome category: focus must use the selected background without a MUI shadow.`);
  }

  const panel = getWelcomeSuggestionPanelSx(composerTheme);
  if (panel.borderRadius !== '16px' || panel.backgroundColor !== tokens.background.input) {
    failures.push(`${mode}/welcome panel: surface must preserve the composer near-black tone.`);
  }
  if (panel.border !== `1px solid ${tokens.border.idle}` || panel.boxShadow !== 'none') {
    failures.push(`${mode}/welcome panel: boundary must remain a quiet 1px hairline without elevation.`);
  }

  if (typeof getWelcomeSuggestionCloseSx !== 'function') {
    failures.push(`${mode}/welcome close control: compact close-control helper is missing.`);
  } else {
    const closeControl = getWelcomeSuggestionCloseSx(composerTheme);
    if (
      closeControl.width.md !== 28 ||
      closeControl.height.md !== 28 ||
      closeControl.width.xs !== 44 ||
      closeControl.height.xs !== 44
    ) {
      failures.push(`${mode}/welcome close control: desktop must be compact while touch targets remain 44px.`);
    }
    if (
      closeControl['&:hover']?.backgroundColor !== tokens.action.hover ||
      closeControl['&:hover']?.color !== tokens.text.primary
    ) {
      failures.push(`${mode}/welcome close control: hover must use a subtle neutral fill.`);
    }
  }
  if (contrast(tokens.border.separator, tokens.background.default) >= contrast(tokens.border.idle, tokens.background.default)) {
    failures.push(`${mode}/separator: structural dividers must be quieter than component hairlines.`);
  }
}

for (const [mode, tokens] of MODES) {
  const stepControl = getFlatStepControlSx({
    palette: tokens,
    shape: { radius: { pill: 9999 } },
    transitions: {
      duration: { shorter: 150 },
      create: () => 'color 150ms ease, box-shadow 150ms ease',
    },
  });
  const stepHover = stepControl[HOVER_CAPABLE_QUERY]?.['&:hover'];
  if (stepControl.backgroundColor !== 'transparent') {
    failures.push(`${mode}/reasoning step: idle background must be transparent.`);
  }
  if (stepHover?.backgroundColor !== 'transparent') {
    failures.push(`${mode}/reasoning step: hover background must be transparent.`);
  }
  if (stepControl['&:active']?.backgroundColor !== 'transparent') {
    failures.push(`${mode}/reasoning step: pressed background must be transparent.`);
  }
  if (stepControl['&:focus-visible']?.backgroundColor !== 'transparent') {
    failures.push(`${mode}/reasoning step: focus background must be transparent.`);
  }
  if (
    stepControl.minHeight?.xs !== 44 ||
    stepControl.minHeight?.md !== 32 ||
    stepControl.borderRadius !== 9999 ||
    stepControl.boxShadow !== 'none'
  ) {
    failures.push(`${mode}/reasoning step: responsive pill geometry or elevation mismatch.`);
  }
}

for (const role of ['row', 'control', 'panel', 'popover']) {
  const radius = INTERFACE_RADIUS[role];
  if (radius !== '8px') failures.push(`interface radius ${role} must be 8px.`);
}
if (INTERFACE_RADIUS.composer !== '20px') failures.push('interface radius composer must be 20px.');
if (INTERFACE_RADIUS.suggestionPanel !== '16px') failures.push('interface radius suggestionPanel must be 16px.');
for (const role of ['sm', 'md', 'lg', 'xl']) {
  if (SHAPE.radius[role] !== 8) failures.push(`shape radius ${role} must be 8.`);
}
for (const role of ['pill', 'full']) {
  if (SHAPE.radius[role] !== 9999) failures.push(`shape radius ${role} must be 9999.`);
}

if (SWITCH_GEOMETRY.height !== SWITCH_GEOMETRY.thumb + SWITCH_GEOMETRY.inset * 2) {
  failures.push('switch: thumb and vertical inset must exactly fill the track height.');
}
if (
  SWITCH_GEOMETRY.travel !==
  SWITCH_GEOMETRY.width - SWITCH_GEOMETRY.thumb - SWITCH_GEOMETRY.inset * 2
) {
  failures.push('switch: checked travel must align the thumb to the trailing inset.');
}

const routeExpectations = [
  ['/', 'light', 'dark'],
  ['/auth', 'light', 'dark'],
  ['/chat', 'light', 'dark'],
  ['/chat/conversation-id', 'light', 'dark'],
  ['/admin', 'light', 'dark'],
];
for (const [pathname, preferred, expected] of routeExpectations) {
  const actual = getEffectiveThemeMode(pathname, preferred);
  if (actual !== expected) failures.push(`${pathname}: expected ${expected}, received ${actual}.`);
}

console.table(results);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS: boundary hierarchy, route mode, canonical geometry, focus contrast, flat reasoning controls, and shared composer and welcome suggestion states.');
}
