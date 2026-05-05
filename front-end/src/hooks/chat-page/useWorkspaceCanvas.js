/**
 * useWorkspaceCanvas Hook
 *
 * Manages the global workspace canvas that can host different artifact
 * components without rendering them inline in the chat stream.
 *
 * @module hooks/useWorkspaceCanvas
 */

import { useState, useCallback, useEffect } from 'react';

const MIN_CANVAS_WIDTH_FLOOR = 320;
const MIN_CANVAS_WIDTH_RATIO = 0.5;
const MAX_CANVAS_WIDTH_RATIO = 0.88;
const DEFAULT_CANVAS_WIDTH = 520;

function getWorkspaceWidth(sidebarWidth) {
  if (typeof window === 'undefined') return 1200;
  return Math.max(0, window.innerWidth - sidebarWidth);
}

function getCanvasWidthBounds(sidebarWidth) {
  const workspace = getWorkspaceWidth(sidebarWidth);
  const minFromRatio = Math.floor(workspace * MIN_CANVAS_WIDTH_RATIO);
  const minWidth = Math.min(
    Math.max(0, workspace - 8),
    Math.max(MIN_CANVAS_WIDTH_FLOOR, minFromRatio),
  );
  let maxWidth = Math.floor(workspace * MAX_CANVAS_WIDTH_RATIO);
  maxWidth = Math.max(minWidth + 1, Math.min(maxWidth, workspace - 4));
  if (maxWidth <= minWidth) {
    maxWidth = Math.min(workspace - 4, minWidth + 120);
  }
  return { minWidth, maxWidth };
}

function clampCanvasWidth(width, sidebarWidth) {
  const { minWidth, maxWidth } = getCanvasWidthBounds(sidebarWidth);
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}

export function useWorkspaceCanvas({ sidebarWidth = 260 } = {}) {
  const [workspaceCanvasOpen, setWorkspaceCanvasOpen] = useState(false);
  const [workspaceCanvasArtifact, setWorkspaceCanvasArtifact] = useState(null);
  const [workspaceCanvasWidth, setWorkspaceCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);

  const handleOpenCanvasArtifact = useCallback((artifact) => {
    if (!artifact?.type) return;
    setWorkspaceCanvasArtifact(artifact);
    setWorkspaceCanvasOpen(true);
    setWorkspaceCanvasWidth((prev) => {
      const { minWidth, maxWidth } = getCanvasWidthBounds(sidebarWidth);
      const preferred = Math.max(DEFAULT_CANVAS_WIDTH, prev);
      return Math.min(maxWidth, Math.max(minWidth, preferred));
    });
  }, [sidebarWidth]);

  const handleOpenSqlEditor = useCallback((query = '', results = null) => {
    handleOpenCanvasArtifact({
      type: 'sql-editor',
      title: 'SQL editor',
      props: {
        initialQuery: query,
        initialResults: results,
      },
    });
  }, [handleOpenCanvasArtifact]);

  const handleCloseWorkspaceCanvas = useCallback(() => {
    setWorkspaceCanvasOpen(false);
  }, []);

  const handleCanvasResize = useCallback((deltaX) => {
    setWorkspaceCanvasWidth((prev) => clampCanvasWidth(prev - deltaX, sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!workspaceCanvasOpen) return undefined;
    const sync = () => {
      setWorkspaceCanvasWidth((prev) => clampCanvasWidth(prev, sidebarWidth));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [workspaceCanvasOpen, sidebarWidth]);

  return {
    workspaceCanvasOpen,
    workspaceCanvasArtifact,
    workspaceCanvasWidth,
    handleOpenCanvasArtifact,
    handleOpenSqlEditor,
    handleCloseWorkspaceCanvas,
    handleCanvasResize,
  };
}
