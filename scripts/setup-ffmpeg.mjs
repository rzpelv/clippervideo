// Download ffmpeg-core into public/ffmpeg/ so Vite serves it as a same-origin
// static asset. Loading same-origin avoids the Cross-Origin-Embedder-Policy
// block that breaks fetches to unpkg / jsdelivr (which don't set
// Cross-Origin-Resource-Policy headers).
//
// Run as a `prebuild` / `predev` hook from package.json.

import { mkdir, writeFile, stat } from 'node:fs/promises';

const VERSION = '0.12.6';
const FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];
const DEST = 'public/ffmpeg';

await mkdir(DEST, { recursive: true });

for (const file of FILES) {
  const target = `${DEST}/${file}`;

  // Skip if already downloaded (rerun-safe in dev).
  try {
    const s = await stat(target);
    if (s.size > 0) {
      console.log(`[setup-ffmpeg] ${file} already present (${formatSize(s.size)}), skipping`);
      continue;
    }
  } catch {
    /* not present, fall through to download */
  }

  const url = `https://unpkg.com/@ffmpeg/core@${VERSION}/dist/umd/${file}`;
  console.log(`[setup-ffmpeg] downloading ${url}`);
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`[setup-ffmpeg] network error fetching ${url}: ${err.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`[setup-ffmpeg] failed to fetch ${url}: HTTP ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buf);
  console.log(`[setup-ffmpeg] ${file} OK (${formatSize(buf.length)})`);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
