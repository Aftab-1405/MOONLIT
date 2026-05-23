# Artifact Renderer Guidelines

`SqlWorkspace` is an IDE-like artifact renderer. It fills the loader height, keeps its schema sidebar, query editor, and status bar inside one flex/grid workspace, and opens query output through `onOpenArtifact`.

Future artifact renderers should follow the shared contract used by `ArtifactLoader`:

```jsx
{
  title,
  chrome: 'standalone' | 'contained',
  onClose,
  onOpenArtifact,
  onControlsChange,
  sourceQuery,
  sourceType,
  workspaceContainerRef,
}
```

Renderer rules:

- Register the renderer in `ArtifactLoader` and pass only active, consumed props.
- Export a memoized component.
- Use `ArtifactShell` for header, controls, body, footer, empty state, error state, and workspace-scoped fullscreen.
- Fill the parent with `height: 100%`, `minHeight: 0`, `minWidth: 0`, `display: flex`, `flexDirection: column`, and `overflow: hidden`.
- Put scrolling inside the artifact body, not the outer root.
- Support `chrome="standalone"` for direct canvas rendering and `chrome="contained"` for embedded use.
- Use `onOpenArtifact` for navigation between SQL editor, results, visualizations, and future artifacts.
- Avoid `position: fixed`, `100vw`, `100vh`, and body-level portals for artifact fullscreen.
- Clean up timers, observers, event listeners, and object URLs.
- Use responsive measurements for Monaco, charts, diagrams, tables, and canvases.
