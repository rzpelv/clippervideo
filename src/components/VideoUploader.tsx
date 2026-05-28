import { useCallback, useRef, useState } from 'react';
import type { VideoSource } from '../types';
import { probeVideo } from '../lib/videoProbe';

interface Props {
  onLoaded: (source: VideoSource) => void;
}

export function VideoUploader({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(file.name)) {
        setError('Please choose a video file (mp4, mov, webm, mkv, ...).');
        return;
      }
      try {
        const src = await probeVideo(file);
        onLoaded(src);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [onLoaded]
  );

  return (
    <div
      className={`uploader ${dragOver ? 'uploader--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="uploader__icon">▶</div>
      <h2>Drop a video here</h2>
      <p>or click to browse — clipping happens locally in your browser</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
