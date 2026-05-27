import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toFfmpegTime } from './format';

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

// ffmpeg-core is downloaded by scripts/setup-ffmpeg.mjs (run via prebuild /
// predev hooks) into public/ffmpeg/, so Vite serves it from the same origin
// at /ffmpeg/. Loading same-origin avoids the Cross-Origin-Embedder-Policy
// block that breaks fetches to unpkg / jsdelivr (which don't set
// Cross-Origin-Resource-Policy).
const BASE_URL = '/ffmpeg';

/** Lazy-load ffmpeg.wasm once. The core is fetched as blob URLs to satisfy COEP. */
export async function getFFmpeg(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on('log', ({ message }) => onLog(message));

    await ff.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegSingleton = ff;
    return ff;
  })();

  return loadPromise;
}

export interface ClipOptions {
  file: File;
  start: number;
  end: number;
  /** If true, re-encode (slower but accurate cuts). If false, stream copy (fast, may snap to keyframes). */
  reencode?: boolean;
  onProgress?: (progress: number) => void;
}

export interface ClipResult {
  blob: Blob;
  url: string;
  filename: string;
}

/** Trim a video to [start, end] and return a downloadable Blob. */
export async function clipVideo(opts: ClipOptions): Promise<ClipResult> {
  const { file, start, end, reencode = true, onProgress } = opts;
  if (end <= start) throw new Error('End time must be greater than start time.');

  const ff = await getFFmpeg();

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ff.on('progress', progressHandler);

  try {
    const ext = guessExtension(file.name);
    const inputName = `input.${ext}`;
    const outputName = `output.mp4`;

    await ff.writeFile(inputName, await fetchFile(file));

    const args = reencode
      ? [
          '-ss', toFfmpegTime(start),
          '-i', inputName,
          '-t', toFfmpegTime(end - start),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputName,
        ]
      : [
          '-ss', toFfmpegTime(start),
          '-i', inputName,
          '-t', toFfmpegTime(end - start),
          '-c', 'copy',
          '-movflags', '+faststart',
          outputName,
        ];

    await ff.exec(args);

    const data = await ff.readFile(outputName);
    const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    // Copy into a fresh ArrayBuffer to satisfy strict BlobPart typing.
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    const blob = new Blob([ab], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    // Cleanup
    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const filename = `${baseName}-clip-${formatStamp(start)}-${formatStamp(end)}.mp4`;
    return { blob, url, filename };
  } finally {
    ff.off('progress', progressHandler);
  }
}

/** Extract audio as 16kHz mono MP3 (ideal for Whisper, keeps payload small). */
export async function extractAudioForTranscription(file: File): Promise<Blob> {
  const ff = await getFFmpeg();
  const ext = guessExtension(file.name);
  const inputName = `input.${ext}`;
  const outputName = `audio.mp3`;

  await ff.writeFile(inputName, await fetchFile(file));
  await ff.exec([
    '-i', inputName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '64k',
    outputName,
  ]);
  const data = await ff.readFile(outputName);
  const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  const blob = new Blob([ab], { type: 'audio/mpeg' });

  try { await ff.deleteFile(inputName); } catch { /* ignore */ }
  try { await ff.deleteFile(outputName); } catch { /* ignore */ }
  return blob;
}

function guessExtension(name: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name);
  return (m?.[1] ?? 'mp4').toLowerCase();
}

function formatStamp(seconds: number): string {
  return Math.floor(seconds).toString().padStart(4, '0');
}
