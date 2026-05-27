import { useCallback, useRef, useState } from 'react';
import type { VideoSource } from '../types';

interface Props {
  onLoaded: (source: VideoSource) => void;
}

export function VideoUploader({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith('video/')) {
        setError('Please choose a video file (mp4, mov, webm, mkv, ...).');
        return;
      }
      const url = URL.createObjectURL(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = url;
      probe.onloadedmetadata = () => {
        onLoaded({ file, url, duration: probe.duration, name: file.name });
      };
      probe.onerror = () => {
        setError('Could not read video metadata. Try another file.');
        URL.revokeObjectURL(url);
      };
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
      <p>or click to browse — processed locally in your browser</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
