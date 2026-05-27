export interface VideoSource {
  file: File;
  url: string;
  duration: number;
  name: string;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  language?: string;
  segments: TranscriptSegment[];
  text: string;
}

export interface HighlightSuggestion {
  start: number;
  end: number;
  /** Hook-style or descriptive title for the clip. */
  title: string;
  /** One-sentence justification from the model. */
  reason: string;
  /** Concatenated transcript text covering this clip's time range. */
  transcript?: string;
}

export type ClipStatus =
  | { kind: 'idle' }
  | { kind: 'loading-ffmpeg' }
  | { kind: 'clipping'; progress: number }
  | { kind: 'done'; url: string; filename: string; size: number }
  | { kind: 'error'; message: string };

export type AiTaskStatus =
  | { kind: 'idle' }
  | { kind: 'running'; label: string }
  | { kind: 'error'; message: string };
