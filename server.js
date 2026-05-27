// Static file server + small JSON API for fetching remote videos.
//
// - Serves the built dist/ with COOP/COEP headers ffmpeg.wasm needs.
// - Exposes POST /api/fetch-video which streams a remote video to the
//   browser, bypassing CORS. Falls back to yt-dlp for sites that don't
//   expose direct media URLs (YouTube, TikTok, Vimeo, X, ...).
// - Zero npm deps: only Node built-ins are used.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';
const FETCH_VIDEO_TIMEOUT_MS = Number(process.env.FETCH_VIDEO_TIMEOUT_MS) || 15 * 60 * 1000;
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_BYTES) || 2 * 1024 * 1024 * 1024; // 2 GiB

// YouTube and other sites increasingly block datacenter IPs (Railway, Fly, etc.)
// Two knobs to work around the bot check:
//   - YTDLP_COOKIES         (Netscape-format cookies file content, set as a Railway env var)
//   - YTDLP_COOKIES_FILE    (alternative: path to a pre-existing cookies file)
//   - YTDLP_EXTRACTOR_ARGS  (override extractor args; default tries multiple YouTube clients)
// Multi-client fallback: yt-dlp will try each client in order until one returns
// playable formats. `default` (web) gives the widest format catalog when cookies
// are configured; `android`/`ios`/`web_safari` are fallbacks that historically
// resist the bot-check on datacenter IPs.
const YTDLP_EXTRACTOR_ARGS =
  process.env.YTDLP_EXTRACTOR_ARGS ||
  'youtube:player_client=default,android,ios,web_safari';
const YTDLP_USER_AGENT =
  process.env.YTDLP_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// Resolve the cookies file once at startup. If YTDLP_COOKIES is provided inline,
// write it to a tmp file with restrictive permissions.
let YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_FILE || '';
if (!YTDLP_COOKIES_PATH && process.env.YTDLP_COOKIES) {
  try {
    YTDLP_COOKIES_PATH = path.join(os.tmpdir(), `clipper-cookies-${crypto.randomUUID()}.txt`);
    fs.writeFileSync(YTDLP_COOKIES_PATH, process.env.YTDLP_COOKIES, { mode: 0o600 });
    console.log(`[yt-dlp] cookies written to ${YTDLP_COOKIES_PATH}`);
  } catch (e) {
    console.error(`[yt-dlp] failed to write cookies file: ${e.message}`);
    YTDLP_COOKIES_PATH = '';
  }
} else if (YTDLP_COOKIES_PATH) {
  console.log(`[yt-dlp] using cookies from ${YTDLP_COOKIES_PATH}`);
}

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

const DIRECT_VIDEO_EXT = new Set([
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mpeg', '.mpg', '.ts', '.ogv',
]);

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
  if (filePath.endsWith('.html')) return { 'Cache-Control': 'no-cache' };
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  return { 'Cache-Control': 'public, max-age=3600' };
}

function send(res, status, body, extra = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(body);
}

function sendJson(res, status, payload, extra = {}) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...securityHeaders(),
    ...extra,
  });
  res.end(body);
}

// ---------- Static file serving ----------

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
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

// ---------- /api/fetch-video ----------

async function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname) {
  // Block obviously-internal targets to prevent SSRF.
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;
  // IPv4 private ranges & link-local
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  // metadata services
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  return false;
}

function safeFilenameFromUrl(rawUrl, fallbackExt = '.mp4') {
  try {
    const u = new URL(rawUrl);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (last && /\.[a-zA-Z0-9]{1,5}$/.test(last)) {
      return last.replace(/[^\w.\-]/g, '_').slice(0, 120);
    }
    const host = u.hostname.replace(/[^\w.-]/g, '_');
    return `${host}-video${fallbackExt}`;
  } catch {
    return `video${fallbackExt}`;
  }
}

async function streamDirectUrl(url, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_VIDEO_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ClipperVideo/0.1' },
    });
  } catch (err) {
    clearTimeout(timeout);
    return sendJson(res, 502, { error: `Upstream fetch failed: ${err.message}` });
  }

  if (!upstream.ok) {
    clearTimeout(timeout);
    return sendJson(res, 502, { error: `Upstream responded ${upstream.status}` });
  }

  const ct = upstream.headers.get('content-type') || '';
  const cl = Number(upstream.headers.get('content-length')) || 0;

  if (cl && cl > MAX_VIDEO_BYTES) {
    clearTimeout(timeout);
    return sendJson(res, 413, { error: `Video too large (${cl} bytes, max ${MAX_VIDEO_BYTES}).` });
  }

  // If the server says it's clearly not a video and we can't infer from URL, refuse.
  const looksVideo =
    ct.startsWith('video/') ||
    ct === 'application/octet-stream' ||
    DIRECT_VIDEO_EXT.has(path.extname(new URL(url).pathname).toLowerCase());
  if (!looksVideo) {
    clearTimeout(timeout);
    return sendJson(res, 415, { error: `URL does not look like a direct video (Content-Type: ${ct || 'unknown'}). Use a video page URL — yt-dlp will be tried instead.` });
  }

  const filename = safeFilenameFromUrl(url);
  res.writeHead(200, {
    'Content-Type': ct || 'video/mp4',
    ...(cl ? { 'Content-Length': String(cl) } : {}),
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Source-Strategy': 'direct',
    ...securityHeaders(),
  });

  if (!upstream.body) {
    clearTimeout(timeout);
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(upstream.body);
  let received = 0;
  nodeStream.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_VIDEO_BYTES) {
      nodeStream.destroy(new Error('Exceeded max video size'));
    }
  });
  nodeStream.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  nodeStream.on('end', () => clearTimeout(timeout));
  nodeStream.pipe(res);
}

function streamWithYtDlp(url, res) {
  const tmpDir = path.join(os.tmpdir(), `clipper-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const outTemplate = path.join(tmpDir, 'video.%(ext)s');
  // Permissive format selector: prefer mp4-friendly streams, but accept any
  // best+best or single-stream fallback. yt-dlp will then transcode/remux to
  // mp4 via --merge-output-format. This avoids "Requested format is not
  // available" failures when a given player_client only exposes DASH/HLS.
  const args = [
    url,
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-part',
    '--no-progress',
    '--no-warnings',
    '--restrict-filenames',
    '--max-filesize', `${Math.floor(MAX_VIDEO_BYTES / (1024 * 1024))}M`,
    '--user-agent', YTDLP_USER_AGENT,
    '-o', outTemplate,
  ];

  if (YTDLP_EXTRACTOR_ARGS) args.push('--extractor-args', YTDLP_EXTRACTOR_ARGS);
  if (YTDLP_COOKIES_PATH) args.push('--cookies', YTDLP_COOKIES_PATH);

  const proc = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  let killed = false;

  const timer = setTimeout(() => {
    killed = true;
    proc.kill('SIGKILL');
  }, FETCH_VIDEO_TIMEOUT_MS);

  proc.stderr.on('data', (d) => {
    stderr += d.toString();
    if (stderr.length > 8192) stderr = stderr.slice(-8192);
  });

  proc.on('error', (err) => {
    clearTimeout(timer);
    cleanupDir(tmpDir);
    if (err.code === 'ENOENT') {
      return sendJson(res, 501, {
        error: 'yt-dlp is not installed on this server. Direct video URLs (mp4/webm/mov...) still work.',
      });
    }
    sendJson(res, 500, { error: `yt-dlp error: ${err.message}` });
  });

  proc.on('close', (code) => {
    clearTimeout(timer);
    if (killed) {
      cleanupDir(tmpDir);
      return sendJson(res, 504, { error: 'yt-dlp timed out.' });
    }
    if (code !== 0) {
      cleanupDir(tmpDir);
      const tail = stderr.slice(-600) || 'no output';

      // Detect the YouTube bot-check / sign-in prompt and return a friendlier message.
      if (
        /Sign in to confirm|confirm you'?re not a bot|This video is only available for/i.test(stderr)
      ) {
        const hasCookies = Boolean(YTDLP_COOKIES_PATH);
        return sendJson(res, 403, {
          error: hasCookies
            ? 'YouTube blocked the request even with cookies. Your cookies may have expired — re-export them and update the YTDLP_COOKIES env var.'
            : 'YouTube is requiring login for this server IP. The site admin needs to set the YTDLP_COOKIES env var (Netscape-format cookies exported from a logged-in browser). See README → "Handling the YouTube bot check".',
          code: 'youtube_bot_check',
        });
      }
      if (/Video unavailable|Private video|members[- ]only/i.test(stderr)) {
        return sendJson(res, 404, {
          error: 'This video is private, members-only, age-restricted, or unavailable.',
          code: 'video_unavailable',
        });
      }
      if (/Unsupported URL|Unable to extract/i.test(stderr)) {
        return sendJson(res, 415, {
          error: 'yt-dlp does not support this URL. Try a direct video link instead.',
          code: 'unsupported_url',
        });
      }
      if (/Requested format is not available/i.test(stderr)) {
        return sendJson(res, 502, {
          error:
            'No playable format was available for this video. The server tried multiple YouTube clients but none returned a downloadable stream. Updating yt-dlp on the server (rebuild the Railway image) usually fixes this.',
          code: 'no_format_available',
        });
      }
      return sendJson(res, 502, { error: `yt-dlp failed (code ${code}): ${tail}` });
    }
    let files;
    try {
      files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('video.'));
    } catch (e) {
      cleanupDir(tmpDir);
      return sendJson(res, 500, { error: `Could not read output dir: ${e.message}` });
    }
    if (files.length === 0) {
      cleanupDir(tmpDir);
      return sendJson(res, 500, { error: 'yt-dlp produced no output file.' });
    }
    const file = files[0];
    const filePath = path.join(tmpDir, file);
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${file}"`,
      'X-Source-Strategy': 'yt-dlp',
      ...securityHeaders(),
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { if (!res.writableEnded) res.destroy(); });
    stream.on('close', () => cleanupDir(tmpDir));
    stream.pipe(res);
  });
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

async function handleFetchVideo(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendJson(res, 400, { error: `Bad request body: ${e.message}` });
  }

  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url || !isHttpUrl(url)) {
    return sendJson(res, 400, { error: 'Provide a valid http(s) URL.' });
  }
  let parsed;
  try { parsed = new URL(url); } catch { return sendJson(res, 400, { error: 'Invalid URL.' }); }
  if (isPrivateHostname(parsed.hostname)) {
    return sendJson(res, 400, { error: 'Refusing to fetch from private/internal hosts.' });
  }

  const ext = path.extname(parsed.pathname).toLowerCase();
  const useDirect = body?.strategy === 'direct' || (body?.strategy !== 'yt-dlp' && DIRECT_VIDEO_EXT.has(ext));

  if (useDirect) {
    return streamDirectUrl(url, res);
  }
  return streamWithYtDlp(url, res);
}

// ---------- HTTP server ----------

const server = http.createServer(async (req, res) => {
  // API routes
  if (req.url === '/healthz') {
    return send(res, 200, 'ok', securityHeaders());
  }
  if (req.url === '/api/fetch-video' && req.method === 'POST') {
    try {
      return await handleFetchVideo(req, res);
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD, POST' });
  }

  // Static files
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    return send(res, 400, 'Bad request', securityHeaders());
  }

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden', securityHeaders());
  }

  // Graceful message when running before `npm run build`
  if (!fs.existsSync(ROOT)) {
    return send(
      res,
      503,
      'dist/ not found — run `npm run build` first.\n(API routes are still available.)',
      securityHeaders()
    );
  }

  serveFile(req, res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`ClipperVideo listening on http://${HOST}:${PORT}`);
});
