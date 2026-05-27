import { useCallback, useRef, useState } from 'react';
import type { VideoSource } from '../types';
import { fetchVideoFromUrl, looksLikeDirectVideoUrl, probeVideo } from '../lib/fetchUrl';
import { formatBytes } from '../lib/format';

interface Props {
  onLoaded: (source: VideoSource) => void;
}

type UrlState =
  | { kind: 'idle' }
  | { kind: 'fetching'; loaded: number; total: number | null; controller: AbortController }
  | { kind: 'error'; message: string };

export function VideoUploader({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [urlState, setUrlState] = useState<UrlState>({ kind: 'idle' });

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

  const handleFetchUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('URL must use http or https.');
      }
    } catch (e) {
      setUrlState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Please enter a valid URL.',
      });
      return;
    }
    const controller = new AbortController();
    setUrlState({ kind: 'fetching', loaded: 0, total: null, controller });
    try {
      const { blob, filename } = await fetchVideoFromUrl({
        url: trimmed,
        signal: controller.signal,
        onProgress: ({ loaded, total }) =>
          setUrlState({ kind: 'fetching', loaded, total, controller }),
      });
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      const src = await probeVideo(file);
      onLoaded(src);
      setUrlState({ kind: 'idle' });
      setUrl('');
    } catch (err) {
      if (controller.signal.aborted) {
        setUrlState({ kind: 'idle' });
        return;
      }
      setUrlState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [url, onLoaded]);

  const cancelFetch = () => {
    if (urlState.kind === 'fetching') urlState.controller.abort();
  };

  return (
    <div className="upload">
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

      <div className="upload__divider"><span>or</span></div>

      <div className="urlbox card">
        <label className="urlbox__label" htmlFor="video-url">Paste a video URL</label>
        <div className="urlbox__row">
          <input
            id="video-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…  ·  or a direct .mp4 link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={urlState.kind === 'fetching'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && urlState.kind !== 'fetching') handleFetchUrl();
            }}
          />
          {urlState.kind === 'fetching' ? (
            <button type="button" className="btn btn--ghost" onClick={cancelFetch}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleFetchUrl}
              disabled={!url.trim()}
            >
              Fetch video
            </button>
          )}
        </div>

        {urlState.kind === 'fetching' && (
          <div className="urlbox__progress">
            {urlState.total ? (
              <>
                <div className="progress">
                  <div
                    className="progress__bar"
                    style={{ width: `${(urlState.loaded / urlState.total) * 100}%` }}
                  />
                </div>
                <span className="muted">
                  Downloading {formatBytes(urlState.loaded)} / {formatBytes(urlState.total)}
                </span>
              </>
            ) : (
              <span className="muted">
                {looksLikeDirectVideoUrl(url)
                  ? `Downloading ${formatBytes(urlState.loaded)}…`
                  : `Resolving via yt-dlp · ${formatBytes(urlState.loaded)} received…`}
              </span>
            )}
          </div>
        )}

        {urlState.kind === 'error' && <p className="error">{urlState.message}</p>}

        <p className="muted urlbox__hint">
          Direct video links (mp4 / webm / mov) stream straight through. Other URLs
          (YouTube, TikTok, Vimeo, X, …) are resolved server-side via{' '}
          <code>yt-dlp</code>. Make sure you have the right to download the content.
        </p>
      </div>
    </div>
  );
}
