import type { AiTaskStatus, Transcript } from '../types';
import { formatTime } from '../lib/format';

interface Props {
  transcript: Transcript | null;
  status: AiTaskStatus;
  hasApiKey: boolean;
  currentTime: number;
  onTranscribe: () => void;
  onJump: (time: number) => void;
}

export function TranscriptPanel({
  transcript,
  status,
  hasApiKey,
  currentTime,
  onTranscribe,
  onJump,
}: Props) {
  return (
    <div className="card transcript">
      <div className="card__header">
        <h3>Transcript</h3>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onTranscribe}
          disabled={!hasApiKey || status.kind === 'running'}
          title={hasApiKey ? '' : 'Configure your transcription provider in AI Providers'}
        >
          {status.kind === 'running' && status.label.includes('Transcrib')
            ? 'Transcribing…'
            : transcript
            ? 'Re-transcribe'
            : 'Transcribe with Whisper'}
        </button>
      </div>

      {!hasApiKey && (
        <p className="muted">Configure a transcription provider in AI Providers to enable this.</p>
      )}
      {status.kind === 'error' && <p className="error">{status.message}</p>}

      {transcript ? (
        <div className="transcript__list">
          {transcript.segments.map((seg) => {
            const active = currentTime >= seg.start && currentTime < seg.end;
            return (
              <button
                key={seg.id}
                type="button"
                className={`transcript__row ${active ? 'transcript__row--active' : ''}`}
                onClick={() => onJump(seg.start)}
              >
                <span className="transcript__time">{formatTime(seg.start)}</span>
                <span className="transcript__text">{seg.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        status.kind !== 'running' && (
          <p className="muted">No transcript yet. Click the button above to generate one.</p>
        )
      )}
    </div>
  );
}
