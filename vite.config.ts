import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ffmpeg.wasm requires SharedArrayBuffer, which needs cross-origin isolation headers.
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Proxy /api/* to the Node server (run separately via `node server.js`)
    // so the URL-fetch endpoint works in dev too.
    proxy: {
      '/api': {
        target: 'http://localhost:4173',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle the FFmpeg packages — they ship UMD/worker code that
    // doesn't survive Vite's dep optimizer.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
  },
  // Make sure the .wasm file imported via `?url` is treated as a static asset.
  assetsInclude: ['**/*.wasm'],
});
