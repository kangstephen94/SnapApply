import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { renameSync, existsSync } from 'fs';

// Rename index.html → popup.html after build (Chrome extension needs popup.html)
function renamePopup() {
  return {
    name: 'rename-popup',
    closeBundle() {
      const from = resolve('build', 'index.html');
      const to = resolve('build', 'popup.html');
      if (existsSync(from)) {
        renameSync(from, to);
        console.log('✅ Renamed index.html → popup.html');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), renamePopup()],
  build: {
    outDir: 'build',
    rollupOptions: {
      input: 'index.html',
      output: {
        // Single JS bundle — no code splitting (Chrome extensions load from local files)
        manualChunks: undefined,
        entryFileNames: 'static/js/main.js',
        chunkFileNames: 'static/js/[name].js',
        assetFileNames: 'static/css/main.[ext]',
      },
    },
    // No source maps for production extension
    sourcemap: false,
  },
});
