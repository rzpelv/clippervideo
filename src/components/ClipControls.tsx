import type { ClipStatus } from '../types';
import { formatBytes, formatTime } from '../lib/format';

interface Props {
  start: number;
  end: number;
  duration: number;
  status: ClipStatus;
  reencode: boolean;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
  onReencodeChange: (v: boolean) => void;
  onMarkStart: () => void;
  onMarkEnd: () => void;
  onClip: () => void;
  onReset: () => void;
}

export function ClipControls({
  start,
  end,
  duration,
  status,
  reencode,
  onStartChange,
  onEndChange,
  onReencodeChange,
  onMarkStart,
  onMarkEnd,
  onClip,
  onReset,
}: Props) {
  const length = Math.max(0, end - start);
  const busy = status.kind === 'loading-ffmpeg' || status.kind === 'clipping';

  return (
    <div className="controls card">
      <div className="controls__row">
        <label className="field">
          <span>Start</span>
          <input
            type="number"
            min={0}
            max={duration}
            step={0.1}
            value={Number(start.toFixed(2))}
            onChange={(e) => onStartChange(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn btn--ghost" onClick={onMarkStart}>
          Mark in
        </button>

        <label className="field">
          <span>End</span>
          <input
            type="number"
            min={0}
            max={duration}
            step={0.1}
            value={Number(end.toFixed(2))}
            onChange={(e) => onEndChange(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn btn--ghost" onClick={onMarkEnd}>
          Mark out
        </button>

        <div className="controls__length">
          Length: <strong>{formatTime(length, true)}</strong>
        </div>
      </div>

      <div className="controls__row">
        <label className="check">
          <input
            type="checkbox"
            checked={reencode}
            onChange={(e) => onReencodeChange(e.target.checked)}
          />
          Re-encode for accurate cut (slower)
        </label>

        <div className="controls__actions">
          <button type="button" className="btn btn--ghost" onClick={onReset} disabled={busy}>
            Reset
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClip}
            disabled={busy || length < 0.1}
          >
            {status.kind === 'loading-ffmpeg'
              ? 'Loading FFmpeg…'
              : status.kind === 'clipping'
              ? `Clipping ${Math.round(status.progress * 100)}%`
              : 'Clip & download'}
          </button>
        </div>
      </div>

      {status.kind === 'clipping' && (
        <div className="progress">
          <div className="progress__bar" style={{ width: `${status.progress * 100}%` }} />
        </div>
      )}

      {status.kind === 'done' && (
        <div className="result">
          <a href={status.url} download={status.filename} className="btn btn--primary">
            Download {status.filename} ({formatBytes(status.size)})
          </a>
        </div>
      )}

      {status.kind === 'error' && <p className="error">{status.message}</p>}
    </div>
  );
}
