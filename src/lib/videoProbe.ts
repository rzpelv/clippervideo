import type { VideoSource } from '../types';

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
