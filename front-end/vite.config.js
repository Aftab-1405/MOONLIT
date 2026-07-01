import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    include: [
      // React-Flow (existing)
      "@xyflow/react",
      // CodeMirror 6 — all packages must share one pre-bundled instance.
      // Without explicit inclusion, @uiw/react-codemirror (CJS) inlines its
      // ESM deps while direct imports resolve them separately, breaking the
      // module identity checks inside CodeMirror's facet system.
      "@uiw/react-codemirror",
      "@codemirror/view",
      "@codemirror/state",
      "@codemirror/language",
      "@codemirror/lang-sql",
      "@codemirror/commands",
      "@lezer/highlight",
    ],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("@uiw/react-codemirror") ||
            id.includes("@codemirror") ||
            id.includes("@lezer")
          ) {
            return "vendor-codemirror";
          }
          if (id.includes("@xyflow") || id.includes("dagre")) {
            return "vendor-react-flow";
          }
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("react-syntax-highlighter") ||
            id.includes("refractor") ||
            id.includes("prismjs") ||
            id.includes("unified") ||
            id.includes("micromark") ||
            id.includes("mdast-util") ||
            id.includes("hast-util") ||
            id.includes("unist-util")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("@mui") || id.includes("@emotion")) {
            return "vendor-mui";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true, // Expose on all network interfaces (0.0.0.0)
    proxy: {
      // SSE streaming endpoints require the full object form so that:
      //   1. changeOrigin rewrites the Host header correctly.
      //   2. The proxy does NOT negotiate gzip compression with the backend
      //      (string shorthand leaves Accept-Encoding untouched, which lets
      //      http-proxy buffer a compressed SSE stream before forwarding it).
      // Auth endpoints (no prefix - auth_controller has no url_prefix)
      "/firebase-config": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/set_session": { target: "http://localhost:5000", changeOrigin: true },
      "/check_session": { target: "http://localhost:5000", changeOrigin: true },
      "/logout": { target: "http://localhost:5000", changeOrigin: true },
      // All api routes use /api prefix
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
