// Tiny static file server that sets the COOP/COEP headers required by
// ffmpeg.wasm (SharedArrayBuffer). Zero dependencies — Node built-ins only.
//
// Usage: `node server.js` (set PORT env to override the default 4173)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
  '.txt':  'text/plain; charset=utf-8',
};

function securityHeaders() {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

function cacheHeaders(filePath) {
  if (filePath.endsWith('.html')) {
    return { 'Cache-Control': 'no-cache' };
  }
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    // Vite emits hashed filenames here — safe to cache forever.
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  return { 'Cache-Control': 'public, max-age=3600' };
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(body);
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback — let the client router handle unknown paths.
      const indexPath = path.join(ROOT, 'index.html');
      fs.stat(indexPath, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          return send(res, 404, 'Not found', securityHeaders());
        }
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          ...securityHeaders(),
          ...cacheHeaders(indexPath),
        });
        fs.createReadStream(indexPath).pipe(res);
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      ...securityHeaders(),
      ...cacheHeaders(filePath),
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  }

  // Lightweight healthcheck for Railway / load balancers.
  if (req.url === '/healthz') {
    return send(res, 200, 'ok', securityHeaders());
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    return send(res, 400, 'Bad request', securityHeaders());
  }

  const filePath = path.normalize(path.join(ROOT, pathname));
  // Prevent path traversal outside the dist directory.
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden', securityHeaders());
  }

  serveFile(req, res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`ClipperVideo listening on http://${HOST}:${PORT}`);
});
