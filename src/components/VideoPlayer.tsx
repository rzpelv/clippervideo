import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface Props {
  src: string;
  onTimeUpdate?: (time: number) => void;
  onLoaded?: (duration: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { src, onTimeUpdate, onLoaded },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    play() {
      videoRef.current?.play().catch(() => undefined);
    },
    pause() {
      videoRef.current?.pause();
    },
    getCurrentTime() {
      return videoRef.current?.currentTime ?? 0;
    },
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => onTimeUpdate?.(v.currentTime);
    const onMeta = () => onLoaded?.(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [onTimeUpdate, onLoaded]);

  return (
    <div className="player">
      <video ref={videoRef} src={src} controls playsInline />
      <div className="player__hint">
        {playing ? 'Playing' : 'Paused'} — use the timeline below to set your clip range.
      </div>
    </div>
  );
});
