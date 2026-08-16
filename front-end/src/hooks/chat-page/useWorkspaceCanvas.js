/**
 * useWorkspaceCanvas Hook
 *
 * Manages the global workspace canvas that can host different artifact
 * components without rendering them inline in the chat stream.
 *
 * @module hooks/useWorkspaceCanvas
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_CANVAS_WIDTH_FLOOR = 320;
const MIN_CANVAS_WIDTH_RATIO = 0.3;
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
  const [hasBeenResized, setHasBeenResized] = useState(false);
  const [workspaceCanvasWidth, setWorkspaceCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const sidebarWidthRef = useRef(sidebarWidth);
  const {
    minWidth: workspaceCanvasMinWidth,
    maxWidth: workspaceCanvasMaxWidth,
  } = getCanvasWidthBounds(sidebarWidth);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleOpenCanvasArtifact = useCallback((artifact) => {
    if (!artifact?.type) return;
    setWorkspaceCanvasArtifact(artifact);
    setWorkspaceCanvasOpen(true);
    setHasBeenResized(false);
    setWorkspaceCanvasWidth(() => {
      const currentSidebarWidth = sidebarWidthRef.current;
      const workspace = getWorkspaceWidth(currentSidebarWidth);
      const half = Math.floor(workspace * 0.5);
      const { minWidth, maxWidth } = getCanvasWidthBounds(currentSidebarWidth);
      return Math.min(maxWidth, Math.max(minWidth, half));
    });
  }, []);

  const handleOpenSqlEditor = useCallback(
    (query = '', results = null) => {
      handleOpenCanvasArtifact({
        type: 'sql-editor',
        title: 'SQL editor',
        props: {
          initialQuery: query,
          initialResults: results,
        },
      });
    },
    [handleOpenCanvasArtifact],
  );

  const handleCloseWorkspaceCanvas = useCallback(() => {
    setWorkspaceCanvasOpen(false);
  }, []);

  const handleCanvasResize = useCallback((deltaX) => {
    setHasBeenResized(true);
    setWorkspaceCanvasWidth((prev) =>
      clampCanvasWidth(prev - deltaX, sidebarWidthRef.current),
    );
  }, []);

  useEffect(() => {
    if (!workspaceCanvasOpen) return undefined;
    let resizeFrame = null;

    const sync = () => {
      setWorkspaceCanvasWidth((prev) => {
        if (!hasBeenResized) {
          const workspace = getWorkspaceWidth(sidebarWidth);
          const half = Math.floor(workspace * 0.5);
          const { minWidth, maxWidth } = getCanvasWidthBounds(sidebarWidth);
          return Math.min(maxWidth, Math.max(minWidth, half));
        }
        return clampCanvasWidth(prev, sidebarWidth);
      });
    };
    const scheduleSync = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        sync();
      });
    };

    sync();
    window.addEventListener('resize', scheduleSync);
    return () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [workspaceCanvasOpen, sidebarWidth, hasBeenResized]);

  return {
    workspaceCanvasOpen,
    workspaceCanvasArtifact,
    workspaceCanvasWidth,
    workspaceCanvasMinWidth,
    workspaceCanvasMaxWidth,
    handleOpenCanvasArtifact,
    handleOpenSqlEditor,
    handleCloseWorkspaceCanvas,
    handleCanvasResize,
  };
}
