import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ffmpeg.wasm requires SharedArrayBuffer, which needs cross-origin isolation
// headers. Vite's dev + preview servers serve them; the Node static server
// in server.js does the same in production.
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // The FFmpeg packages ship UMD/worker code that doesn't survive Vite's
    // dep optimizer. ffmpeg-core itself isn't imported from JS — it's served
    // as a static asset from public/ffmpeg/ (see scripts/setup-ffmpeg.mjs).
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});
