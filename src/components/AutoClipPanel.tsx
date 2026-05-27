import type { AiTaskStatus } from '../types';

interface Props {
  hasApiKey: boolean;
  hasVideo: boolean;
  status: AiTaskStatus;
  resultCount: number;
  onAutoClip: () => void;
}

export function AutoClipPanel({
  hasApiKey,
  hasVideo,
  status,
  resultCount,
  onAutoClip,
}: Props) {
  const running = status.kind === 'running';
  const label = running
    ? status.label || 'Running…'
    : resultCount > 0
    ? 'Auto-clip again'
    : 'Auto-clip with AI';

  return (
    <div className="card autoclip">
      <div className="autoclip__copy">
        <h3>
          <span className="autoclip__sparkle" aria-hidden="true">✨</span> AI Auto-Clip
        </h3>
        <p className="muted">
          One click: transcribe the video, find the best moments, write hook-style
          titles, and grab the transcript for each clip.
        </p>
      </div>

      <button
        type="button"
        className="btn btn--primary autoclip__btn"
        onClick={onAutoClip}
        disabled={!hasApiKey || !hasVideo || running}
        title={
          !hasApiKey
            ? 'Configure transcription and chat providers in AI Providers'
            : !hasVideo
            ? 'Load a video first'
            : ''
        }
      >
        {label}
      </button>

      {running && status.label && <p className="autoclip__step muted">{status.label}</p>}

      {!hasApiKey && (
        <p className="muted autoclip__hint">
          Open <strong>AI Providers</strong> to add your API keys for transcription
          and chat.
        </p>
      )}
    </div>
  );
}
