import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer, type VideoPlayerHandle } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { ClipControls } from './components/ClipControls';
import { TranscriptPanel } from './components/TranscriptPanel';
import { HighlightsPanel } from './components/HighlightsPanel';
import { AutoClipPanel } from './components/AutoClipPanel';
import { SettingsModal } from './components/SettingsModal';
import {
  clipVideo,
  extractAudioForTranscription,
  getFFmpeg,
} from './lib/ffmpeg';
import { suggestHighlights, transcribeAudio } from './lib/openai';
import { storage } from './lib/storage';
import type {
  AiTaskStatus,
  ClipStatus,
  HighlightSuggestion,
  Transcript,
  VideoSource,
} from './types';

export default function App() {
  const [video, setVideo] = useState<VideoSource | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [reencode, setReencode] = useState(true);
  const [clipStatus, setClipStatus] = useState<ClipStatus>({ kind: 'idle' });

  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [aiStatus, setAiStatus] = useState<AiTaskStatus>({ kind: 'idle' });
  const [highlights, setHighlights] = useState<HighlightSuggestion[]>([]);

  const [apiKey, setApiKeyState] = useState<string>(() => storage.getApiKey());
  const [chatModel, setChatModelState] = useState<string>(() => storage.getChatModel());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const playerRef = useRef<VideoPlayerHandle>(null);

  const hasApiKey = Boolean(apiKey);

  // Reset state when a new video is loaded.
  const handleVideoLoaded = useCallback((src: VideoSource) => {
    setVideo((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return src;
    });
    setStart(0);
    setEnd(src.duration);
    setCurrentTime(0);
    setTranscript(null);
    setHighlights([]);
    setClipStatus({ kind: 'idle' });
    setAiStatus({ kind: 'idle' });
  }, []);

  // Cleanup object URLs on unmount.
  useEffect(() => {
    return () => {
      if (video) URL.revokeObjectURL(video.url);
      if (clipStatus.kind === 'done') URL.revokeObjectURL(clipStatus.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeek = useCallback((t: number) => {
    playerRef.current?.seek(t);
    setCurrentTime(t);
  }, []);

  const handleClip = useCallback(async () => {
    if (!video) return;
    setClipStatus({ kind: 'loading-ffmpeg' });
    try {
      await getFFmpeg();
      setClipStatus({ kind: 'clipping', progress: 0 });
      const result = await clipVideo({
        file: video.file,
        start,
        end,
        reencode,
        onProgress: (p) => setClipStatus({ kind: 'clipping', progress: p }),
      });
      setClipStatus({
        kind: 'done',
        url: result.url,
        filename: result.filename,
        size: result.blob.size,
      });
    } catch (err) {
      setClipStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [video, start, end, reencode]);

  const handleTranscribe = useCallback(async () => {
    if (!video || !apiKey) return;
    setAiStatus({ kind: 'running', label: 'Transcribing audio…' });
    try {
      const audio = await extractAudioForTranscription(video.file);
      const t = await transcribeAudio(audio, apiKey, `${video.name}.mp3`);
      setTranscript(t);
      setAiStatus({ kind: 'idle' });
    } catch (err) {
      setAiStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [video, apiKey]);

  const handleSuggest = useCallback(async () => {
    if (!video || !transcript || !apiKey) return;
    setAiStatus({ kind: 'running', label: 'Highlighting…' });
    try {
      const result = await suggestHighlights(
        transcript,
        video.duration,
        apiKey,
        chatModel,
        { count: 3, targetSeconds: 30 }
      );
      setHighlights(result);
      setAiStatus({ kind: 'idle' });
    } catch (err) {
      setAiStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [video, transcript, apiKey, chatModel]);

  /** End-to-end auto-clip: transcribe (if needed) → AI hooks → display. */
  const handleAutoClip = useCallback(async () => {
    if (!video || !apiKey) return;
    try {
      let t = transcript;
      if (!t) {
        setAiStatus({ kind: 'running', label: 'Transcribing audio…' });
        const audio = await extractAudioForTranscription(video.file);
        t = await transcribeAudio(audio, apiKey, `${video.name}.mp3`);
        setTranscript(t);
      }
      setAiStatus({ kind: 'running', label: 'Finding the best moments…' });
      const result = await suggestHighlights(t, video.duration, apiKey, chatModel, {
        count: 5,
        mode: 'hook',
      });
      setHighlights(result);
      setAiStatus({ kind: 'idle' });
    } catch (err) {
      setAiStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [video, transcript, apiKey, chatModel]);

  const applyHighlight = useCallback((h: HighlightSuggestion) => {
    setStart(h.start);
    setEnd(h.end);
    playerRef.current?.seek(h.start);
  }, []);

  const handleSaveSettings = useCallback((key: string, model: string) => {
    storage.setApiKey(key);
    storage.setChatModel(model);
    setApiKeyState(key);
    setChatModelState(model);
  }, []);

  const duration = video?.duration ?? 0;

  const headerActions = useMemo(
    () => (
      <div className="header__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setSettingsOpen(true)}
        >
          {hasApiKey ? 'Settings' : 'Set API key'}
        </button>
        {video && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (video) URL.revokeObjectURL(video.url);
              setVideo(null);
              setTranscript(null);
              setHighlights([]);
              setClipStatus({ kind: 'idle' });
            }}
          >
            New video
          </button>
        )}
      </div>
    ),
    [hasApiKey, video]
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo">▶</span>
          <div>
            <h1>ClipperVideo</h1>
            <p className="muted">AI-assisted in-browser video clipping</p>
          </div>
        </div>
        {headerActions}
      </header>

      <main className="main">
        {!video ? (
          <VideoUploader onLoaded={handleVideoLoaded} />
        ) : (
          <div className="layout">
            <section className="layout__main">
              <VideoPlayer
                ref={playerRef}
                src={video.url}
                onTimeUpdate={setCurrentTime}
                onLoaded={(d) => {
                  // If duration was inaccurate at upload time, sync end to true duration.
                  if (Math.abs(d - duration) > 0.5 && end >= duration) setEnd(d);
                }}
              />
              <Timeline
                duration={duration}
                currentTime={currentTime}
                start={start}
                end={end}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                }}
                onSeek={handleSeek}
              />
              <ClipControls
                start={start}
                end={end}
                duration={duration}
                status={clipStatus}
                reencode={reencode}
                onStartChange={(v) => setStart(Math.max(0, Math.min(v, end - 0.1)))}
                onEndChange={(v) => setEnd(Math.min(duration, Math.max(v, start + 0.1)))}
                onReencodeChange={setReencode}
                onMarkStart={() => setStart(Math.min(currentTime, end - 0.1))}
                onMarkEnd={() => setEnd(Math.max(currentTime, start + 0.1))}
                onClip={handleClip}
                onReset={() => {
                  setStart(0);
                  setEnd(duration);
                  setClipStatus({ kind: 'idle' });
                }}
              />
            </section>

            <aside className="layout__side">
              <AutoClipPanel
                hasApiKey={hasApiKey}
                hasVideo={Boolean(video)}
                status={aiStatus}
                resultCount={highlights.length}
                onAutoClip={handleAutoClip}
              />
              <TranscriptPanel
                transcript={transcript}
                status={aiStatus}
                hasApiKey={hasApiKey}
                currentTime={currentTime}
                onTranscribe={handleTranscribe}
                onJump={handleSeek}
              />
              <HighlightsPanel
                highlights={highlights}
                status={aiStatus}
                canRun={Boolean(transcript && hasApiKey)}
                onSuggest={handleSuggest}
                onApply={applyHighlight}
              />
            </aside>
          </div>
        )}
      </main>

      <footer className="footer muted">
        Built with React, ffmpeg.wasm, and OpenAI · your video and key never leave your device
        except for direct calls to api.openai.com.
      </footer>

      <SettingsModal
        open={settingsOpen}
        initialKey={apiKey}
        initialModel={chatModel}
        onSave={handleSaveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
