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
        <h3>AI clips</h3>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onSuggest}
          disabled={!canRun || status.kind === 'running'}
          title={canRun ? '' : 'Transcribe the video first'}
        >
          {status.kind === 'running' && status.label.includes('ighlight')
            ? 'Thinking…'
            : highlights.length
            ? 'Re-suggest'
            : 'Suggest highlights'}
        </button>
      </div>

      {status.kind === 'error' && <p className="error">{status.message}</p>}

      {highlights.length > 0 ? (
        <ul className="highlights__list">
          {highlights.map((h, i) => (
            <li key={`${h.start}-${i}`} className="highlights__item">
              <div className="highlights__meta">
                <strong className="highlights__title">{h.title}</strong>
                <span className="highlights__time">
                  {formatTime(h.start)} → {formatTime(h.end)} · {(h.end - h.start).toFixed(1)}s
                </span>
              </div>

              {h.transcript && (
                <blockquote className="highlights__transcript">
                  {h.transcript}
                </blockquote>
              )}

              {h.reason && <p className="highlights__reason muted">{h.reason}</p>}

              <button
                type="button"
                className="btn btn--ghost highlights__use"
                onClick={() => onApply(h)}
              >
                Use this clip ↑
              </button>
            </li>
          ))}
        </ul>
      ) : (
        status.kind !== 'running' && (
          <p className="muted">
            Click <strong>Auto-clip with AI</strong> above, or use the manual buttons
            after transcribing.
          </p>
        )
      )}
    </div>
  );
}
