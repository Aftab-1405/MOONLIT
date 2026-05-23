import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['@xyflow/react'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
            return 'vendor-monaco';
          }
          if (id.includes('@xyflow') || id.includes('dagre')) {
            return 'vendor-react-flow';
          }
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'vendor-charts';
          }
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('react-syntax-highlighter') ||
            id.includes('refractor') ||
            id.includes('prismjs') ||
            id.includes('unified') ||
            id.includes('micromark') ||
            id.includes('mdast-util') ||
            id.includes('hast-util') ||
            id.includes('unist-util')
          ) {
            return 'vendor-markdown';
          }
          if (id.includes('firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'vendor-mui';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true, // Expose on all network interfaces (0.0.0.0)
    proxy: {
      // Auth endpoints (no prefix - auth_bp has no url_prefix)
      '/firebase-config': 'http://localhost:5000',
      '/set_session': 'http://localhost:5000',
      '/check_session': 'http://localhost:5000',
      '/logout': 'http://localhost:5000',
      // All api_bp routes use /api prefix
      '/api': 'http://localhost:5000',
    },
  },
});
