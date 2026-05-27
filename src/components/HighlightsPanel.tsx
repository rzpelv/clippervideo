import type { AiTaskStatus, HighlightSuggestion } from '../types';
import { formatTime } from '../lib/format';

interface Props {
  highlights: HighlightSuggestion[];
  status: AiTaskStatus;
  canRun: boolean;
  onSuggest: () => void;
  onApply: (h: HighlightSuggestion) => void;
}

export function HighlightsPanel({ highlights, status, canRun, onSuggest, onApply }: Props) {
  return (
    <div className="card highlights">
      <div className="card__header">
        <h3>AI highlight suggestions</h3>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSuggest}
          disabled={!canRun || status.kind === 'running'}
          title={canRun ? '' : 'Transcribe the video first'}
        >
          {status.kind === 'running' && status.label.includes('Highlight')
            ? 'Thinking…'
            : highlights.length
            ? 'Suggest again'
            : 'Suggest highlights'}
        </button>
      </div>

      {status.kind === 'error' && <p className="error">{status.message}</p>}

      {highlights.length > 0 ? (
        <ul className="highlights__list">
          {highlights.map((h, i) => (
            <li key={i} className="highlights__item">
              <div className="highlights__meta">
                <strong>{h.title}</strong>
                <span className="muted">
                  {formatTime(h.start)} → {formatTime(h.end)} · {(h.end - h.start).toFixed(1)}s
                </span>
              </div>
              <p>{h.reason}</p>
              <button type="button" className="btn btn--ghost" onClick={() => onApply(h)}>
                Use this clip
              </button>
            </li>
          ))}
        </ul>
      ) : (
        status.kind !== 'running' && (
          <p className="muted">Generate suggestions after transcribing.</p>
        )
      )}
    </div>
  );
}
