import type { VideoSource } from '../types';

export interface FetchProgress {
  loaded: number;
  total: number | null;
}

export interface FetchVideoOptions {
  url: string;
  strategy?: 'auto' | 'direct' | 'yt-dlp';
  signal?: AbortSignal;
  onProgress?: (p: FetchProgress) => void;
}

const DIRECT_EXT_RE = /\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|ts|ogv)(?:$|\?)/i;

/** Quick client-side guess; the server makes the final decision. */
export function looksLikeDirectVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return DIRECT_EXT_RE.test(u.pathname);
  } catch {
    return false;
  }
}

/** POST to /api/fetch-video and stream the response into a Blob with progress. */
export async function fetchVideoFromUrl(
  opts: FetchVideoOptions
): Promise<{ blob: Blob; filename: string; strategy: string }> {
  const res = await fetch('/api/fetch-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: opts.url,
      strategy: opts.strategy && opts.strategy !== 'auto' ? opts.strategy : undefined,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(msg);
  }

  const totalHeader = res.headers.get('Content-Length');
  const total = totalHeader ? Number(totalHeader) : null;
  const strategy = res.headers.get('X-Source-Strategy') || 'unknown';
  const disposition = res.headers.get('Content-Disposition') || '';
  const filename = parseFilename(disposition) || 'video.mp4';
  const contentType = res.headers.get('Content-Type') || 'video/mp4';

  if (!res.body) {
    const blob = await res.blob();
    return { blob, filename, strategy };
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value as BlobPart);
      loaded += value.byteLength;
      opts.onProgress?.({ loaded, total });
    }
  }

  const blob = new Blob(chunks, { type: contentType });
  return { blob, filename, strategy };
}

function parseFilename(contentDisposition: string): string | null {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Probe the duration of a Blob/File by loading it into a hidden <video>. */
export function probeVideo(file: File): Promise<VideoSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    probe.onloadedmetadata = () => {
      resolve({ file, url, duration: probe.duration, name: file.name });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata.'));
    };
  });
}
