// AppShell — the application's primary canvas.
//
// Single source of truth for the three-column structural layout:
//
//   Column 1 — Sidebar (left)             navigation, conversations, profile
//   Column 2 — Chat workspace (center)    messages + composer
//   Column 3 — Artifact loader (right)    SQL editor, visualizations, diagrams
//
// On desktop, the three columns live side-by-side. The sidebar's column width
// animates between collapsed/expanded; the artifact column animates between
// open/closed. Both width animations are owned here, in one place.
//
// On narrow viewports, the sidebar becomes a drawer (handled inside the Sidebar
// feature via the Drawer primitive) and the artifact panel becomes a
// full-screen slide-up overlay (handled here, via Slide). The chat column is
// always the in-flow center.
//
// Theme surfaces for the three columns are painted once, here. Feature
// components rendered into each column should remain transparent wherever
// practical and inherit their appearance from the column surface instead of
// repainting backgrounds.

import { Box, Slide, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';
import {
  getAppPanelSurfaceSx,
  getAppSunkenSurfaceSx,
  getArtifactPanelChromeSx,
  getShellWorkspaceSx,
  getSidebarChromeSx,
} from '@/features/styles/interfaceChrome';
import { UI_LAYOUT, UI_Z_INDEX } from '@/styles/shared';

const SIDEBAR_EXPANDED = UI_LAYOUT.sidebarExpandedWidth; // 260
const SIDEBAR_COLLAPSED = UI_LAYOUT.sidebarCollapsedWidth; // 52

const SPRING_TRANSITION = { type: 'spring', stiffness: 320, damping: 32 };
const NO_TRANSITION = { duration: 0 };

/**
 * Desktop layout — three flex columns side by side. The sidebar's column and
 * the artifact panel's column both animate width via framer-motion. The center
 * column flexes to fill the remainder.
 */
const DesktopShell = memo(function DesktopShell({
  sidebarSlot,
  chatSlot,
  workspaceSlot,
  sidebarOpen,
  canvasOpen,
  canvasWidth,
  isResizingCanvas,
}) {
  const theme = useTheme();
  const sidebarWidth = sidebarOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

  const sidebarColumnSx = useMemo(
    () => ({
      width: sidebarWidth,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      ...getAppPanelSurfaceSx(theme),
      ...getSidebarChromeSx(theme),
    }),
    [theme, sidebarWidth],
  );

  const chatColumnSx = useMemo(
    () => ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative',
      zIndex: UI_Z_INDEX.mainContentBase,
      ...getShellWorkspaceSx(theme),
    }),
    [theme],
  );

  const workspaceColumnSx = useMemo(
    () => ({
      width: canvasWidth,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      ...getArtifactPanelChromeSx(theme),
    }),
    [theme, canvasWidth],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Column 1 — Sidebar */}
      <motion.div
        animate={{ width: sidebarWidth }}
        transition={SPRING_TRANSITION}
        style={{
          flexShrink: 0,
          height: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <Box data-column="sidebar" aria-label="Sidebar column" sx={sidebarColumnSx}>
          {sidebarSlot}
        </Box>
      </motion.div>

      {/* Column 2 — Chat workspace */}
      <Box component="main" id="main-content" aria-label="Chat workspace" sx={chatColumnSx}>
        {chatSlot}
      </Box>

      {/* Column 3 — Artifact loader */}
      <Box
        component="section"
        data-ui-target="workspace_canvas"
        aria-label="Workspace canvas"
        sx={{
          display: 'flex',
          flexShrink: 0,
          minHeight: 0,
          alignSelf: 'stretch',
          height: '100%',
          position: 'relative',
        }}
      >
        <motion.div
          animate={{ width: canvasOpen ? canvasWidth : 0 }}
          transition={isResizingCanvas ? NO_TRANSITION : SPRING_TRANSITION}
          style={{
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <Box data-column="workspace" aria-label="Artifact panel column" sx={workspaceColumnSx}>
            {workspaceSlot}
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
});

/**
 * Narrow (mobile) layout — single chat column fills the viewport. The sidebar
 * is rendered as a Drawer by the Sidebar feature itself (it owns its mobile
 * drawer state). The artifact panel becomes a fixed full-screen slide-up
 * overlay, owned here.
 */
const NarrowShell = memo(function NarrowShell({
  sidebarSlot,
  chatSlot,
  workspaceSlot,
  canvasOpen,
}) {
  const theme = useTheme();

  const chatColumnSx = useMemo(
    () => ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative',
      zIndex: UI_Z_INDEX.mainContentBase,
      ...getShellWorkspaceSx(theme),
    }),
    [theme],
  );

  const overlaySx = useMemo(
    () => ({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: UI_Z_INDEX.artifactFullscreen,
      display: 'flex',
      flexDirection: 'column',
      ...getAppSunkenSurfaceSx(theme),
    }),
    [theme],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Sidebar slot renders its own Drawer on narrow viewports. */}
      {sidebarSlot}

      {/* Chat column — fills the viewport. */}
      <Box component="main" id="main-content" aria-label="Chat workspace" sx={chatColumnSx}>
        {chatSlot}
      </Box>

      {/* Artifact panel — full-screen slide-up overlay. */}
      <Slide direction="up" in={canvasOpen} mountOnEnter unmountOnExit>
        <Box sx={overlaySx}>{workspaceSlot}</Box>
      </Slide>
    </Box>
  );
});

/**
 * AppShell — the application shell. Renders the three-column structural layout
 * and paints the base surfaces for each column. Owns the column-width
 * animations. All feature content is supplied via slots so feature modules
 * remain layout-agnostic.
 *
 * @param {object} props
 * @param {React.ReactNode} props.sidebarSlot     — Sidebar feature content
 * @param {React.ReactNode} props.chatSlot        — Chat feature content
 * @param {React.ReactNode} props.workspaceSlot   — Artifact loader feature content
 * @param {boolean} props.isNarrowLayout          — when true, render the narrow layout
 * @param {boolean} props.sidebarOpen             — desktop sidebar expanded/collapsed
 * @param {boolean} props.canvasOpen              — desktop artifact panel open/closed
 * @param {number} props.canvasWidth              — desktop artifact panel width in px
 * @param {boolean} props.isResizingCanvas        — disables width animation while user drags
 */
function AppShell({
  sidebarSlot,
  chatSlot,
  workspaceSlot,
  isNarrowLayout,
  sidebarOpen,
  canvasOpen,
  canvasWidth,
  isResizingCanvas,
}) {
  if (isNarrowLayout) {
    return (
      <NarrowShell
        sidebarSlot={sidebarSlot}
        chatSlot={chatSlot}
        workspaceSlot={workspaceSlot}
        canvasOpen={canvasOpen}
      />
    );
  }

  return (
    <DesktopShell
      sidebarSlot={sidebarSlot}
      chatSlot={chatSlot}
      workspaceSlot={workspaceSlot}
      sidebarOpen={sidebarOpen}
      canvasOpen={canvasOpen}
      canvasWidth={canvasWidth}
      isResizingCanvas={isResizingCanvas}
    />
  );
}

export default memo(AppShell);
