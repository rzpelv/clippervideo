import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/format';

interface Props {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onSeek: (time: number) => void;
}

type Drag = 'start' | 'end' | 'playhead' | null;

export function Timeline({ duration, currentTime, start, end, onChange, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);

  const pctToTime = useCallback(
    (pct: number) => Math.max(0, Math.min(duration, (pct / 100) * duration)),
    [duration]
  );

  const positionFromEvent = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, pct));
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const t = pctToTime(positionFromEvent(e.clientX));
      if (drag === 'start') {
        onChange(Math.min(t, end - 0.1), end);
      } else if (drag === 'end') {
        onChange(start, Math.max(t, start + 0.1));
      } else if (drag === 'playhead') {
        onSeek(t);
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, end, onChange, onSeek, pctToTime, positionFromEvent, start]);

  const startPct = duration ? (start / duration) * 100 : 0;
  const endPct = duration ? (end / duration) * 100 : 0;
  const playPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="timeline">
      <div className="timeline__times">
        <span>{formatTime(start, true)}</span>
        <span className="timeline__cur">{formatTime(currentTime, true)}</span>
        <span>{formatTime(end, true)}</span>
      </div>
      <div
        className="timeline__track"
        ref={trackRef}
        onPointerDown={(e) => {
          const t = pctToTime(positionFromEvent(e.clientX));
          onSeek(t);
          setDrag('playhead');
        }}
      >
        <div
          className="timeline__range"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <div
          className="timeline__playhead"
          style={{ left: `${playPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag('playhead');
          }}
        />
        <button
          type="button"
          className="timeline__handle timeline__handle--start"
          aria-label="Clip start"
          style={{ left: `${startPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag('start');
          }}
        />
        <button
          type="button"
          className="timeline__handle timeline__handle--end"
          aria-label="Clip end"
          style={{ left: `${endPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag('end');
          }}
        />
      </div>
      <div className="timeline__labels">
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
