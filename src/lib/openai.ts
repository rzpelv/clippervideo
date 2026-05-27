import type { HighlightSuggestion, Transcript, TranscriptSegment } from '../types';

const OPENAI_BASE = 'https://api.openai.com/v1';

interface WhisperVerboseResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

/** Transcribe audio via OpenAI Whisper, returning segment-level timestamps. */
export async function transcribeAudio(
  audio: Blob,
  apiKey: string,
  filename = 'audio.mp3'
): Promise<Transcript> {
  if (!apiKey) throw new Error('Missing OpenAI API key.');

  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`Whisper transcription failed: ${detail}`);
  }

  const data = (await res.json()) as WhisperVerboseResponse;
  const segments: TranscriptSegment[] = (data.segments ?? []).map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));

  return {
    language: data.language,
    segments,
    text: data.text ?? segments.map((s) => s.text).join(' '),
  };
}

/** Ask GPT to pick highlight clips from a timestamped transcript. */
export async function suggestHighlights(
  transcript: Transcript,
  duration: number,
  apiKey: string,
  model: string,
  options: { count?: number; targetSeconds?: number } = {}
): Promise<HighlightSuggestion[]> {
  if (!apiKey) throw new Error('Missing OpenAI API key.');
  if (transcript.segments.length === 0) {
    throw new Error('Transcript is empty — nothing to summarize.');
  }

  const count = options.count ?? 3;
  const target = options.targetSeconds ?? 30;

  const transcriptText = transcript.segments
    .map((s) => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}] ${s.text}`)
    .join('\n');

  const system = [
    'You are a video editor that picks the most engaging moments from a transcript.',
    'Return STRICT JSON of the form: {"highlights":[{"start":number,"end":number,"title":string,"reason":string}]}.',
    'Times are in seconds, must be within the video duration, and start < end.',
    'Pick non-overlapping highlights. Keep titles under 60 characters.',
  ].join(' ');

  const user = [
    `Video duration: ${duration.toFixed(2)} seconds.`,
    `Pick ${count} highlight clips, each roughly ${target} seconds long.`,
    'Transcript with timestamps:',
    transcriptText,
  ].join('\n\n');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`Highlight suggestion failed: ${detail}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '{}';
  let parsed: { highlights?: HighlightSuggestion[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Model returned non-JSON content.');
  }

  const highlights = (parsed.highlights ?? [])
    .map((h) => ({
      start: clamp(Number(h.start), 0, duration),
      end: clamp(Number(h.end), 0, duration),
      title: String(h.title ?? '').slice(0, 80),
      reason: String(h.reason ?? ''),
    }))
    .filter((h) => h.end > h.start);

  return highlights;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

async function safeError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
