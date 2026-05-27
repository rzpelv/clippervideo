/** Format seconds as HH:MM:SS.mmm or MM:SS.mmm */
export function formatTime(seconds: number, withMillis = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const millis = Math.floor((secs - wholeSecs) * 1000);

  const pad = (n: number, w = 2) => String(n).padStart(w, '0');

  const base =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(wholeSecs)}`
      : `${pad(minutes)}:${pad(wholeSecs)}`;

  return withMillis ? `${base}.${pad(millis, 3)}` : base;
}

/** Format seconds as ffmpeg-friendly HH:MM:SS.mmm */
export function toFfmpegTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds - hours * 3600 - minutes * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${secs.toFixed(3).padStart(6, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}
