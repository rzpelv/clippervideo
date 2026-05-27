import type { HighlightSuggestion, Transcript, TranscriptSegment } from '../types';
import type { ProviderConfig } from './storage';

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

function normalizeBaseUrl(url: string): string {
  return (url || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
}

/** Transcribe audio via an OpenAI-compatible /audio/transcriptions endpoint
 *  (OpenAI Whisper, Groq Whisper, or any provider that mirrors the API). */
export async function transcribeAudio(
  audio: Blob,
  config: ProviderConfig,
  filename = 'audio.mp3'
): Promise<Transcript> {
  if (!config.apiKey) {
    throw new Error('Missing API key for the transcription provider.');
  }
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = config.model || 'whisper-1';

  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`Transcription failed: ${detail}`);
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

export type HighlightMode = 'highlight' | 'hook';

export interface SuggestHighlightsOptions {
  count?: number;
  /** Target seconds; ignored in 'hook' mode where the model picks naturally. */
  targetSeconds?: number;
  mode?: HighlightMode;
}

/** Ask an LLM (OpenAI-compatible Chat Completions) to pick highlight clips. */
export async function suggestHighlights(
  transcript: Transcript,
  duration: number,
  config: ProviderConfig,
  options: SuggestHighlightsOptions = {}
): Promise<HighlightSuggestion[]> {
  if (!config.apiKey) {
    throw new Error('Missing API key for the chat provider.');
  }
  if (transcript.segments.length === 0) {
    throw new Error('Transcript is empty — nothing to summarize.');
  }
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = config.model || 'gpt-4o-mini';

  const mode: HighlightMode = options.mode ?? 'highlight';
  const count = options.count ?? (mode === 'hook' ? 5 : 3);
  const target = options.targetSeconds ?? 30;
  const language = transcript.language || 'the original language of the transcript';

  const transcriptText = transcript.segments
    .map((s) => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}] ${s.text}`)
    .join('\n');

  const system =
    mode === 'hook'
      ? [
          'You are a viral short-form video editor (YouTube Shorts, TikTok, Reels).',
          'Pick non-overlapping moments from a timestamped transcript that each work as a standalone short.',
          'Each clip should be 15 to 60 seconds long, snapped to natural conversational boundaries.',
          'For each clip:',
          '- "title" must be a HOOK in the same language as the transcript: bold, specific, curiosity-inducing or action-oriented. Under 80 characters. No clickbait emoji spam.',
          '- "reason" is one short sentence explaining what makes the moment worth watching.',
          'Order clips by hook strength (best first).',
          'Return STRICT JSON: {"highlights":[{"start":number,"end":number,"title":string,"reason":string}]}',
          'Times are in seconds, must be within the video duration, and start < end.',
        ].join(' ')
      : [
          'You are a video editor that picks the most engaging moments from a transcript.',
          'Return STRICT JSON of the form: {"highlights":[{"start":number,"end":number,"title":string,"reason":string}]}.',
          'Times are in seconds, must be within the video duration, and start < end.',
          'Pick non-overlapping highlights. Keep titles under 60 characters.',
        ].join(' ');

  const user =
    mode === 'hook'
      ? [
          `Video duration: ${duration.toFixed(2)} seconds.`,
          `Transcript language: ${language}. Generate hook titles in the SAME language.`,
          `Pick the ${count} strongest standalone clips. Vary durations between 15 and 60 seconds based on what fits each moment.`,
          'Transcript with timestamps:',
          transcriptText,
        ].join('\n\n')
      : [
          `Video duration: ${duration.toFixed(2)} seconds.`,
          `Pick ${count} highlight clips, each roughly ${target} seconds long.`,
          'Transcript with timestamps:',
          transcriptText,
        ].join('\n\n');

  const body: Record<string, unknown> = {
    model,
    temperature: mode === 'hook' ? 0.7 : 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  let res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Some providers / models reject response_format=json_object. Retry without it
  // and rely on extractJson() to scrape the JSON block from the model's output.
  if (!res.ok && res.status === 400) {
    const text = await res.text().catch(() => '');
    if (/response_format|json_object/i.test(text)) {
      delete (body as Record<string, unknown>).response_format;
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } else {
      throw new Error(`Highlight suggestion failed: ${text || `HTTP ${res.status}`}`);
    }
  }

  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`Highlight suggestion failed: ${detail}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson<{ highlights?: HighlightSuggestion[] }>(content);

  if (!parsed) {
    throw new Error('Model did not return parseable JSON. Try a different model.');
  }

  const highlights = (parsed.highlights ?? [])
    .map((h) => {
      const startClamped = clamp(Number(h.start), 0, duration);
      const endClamped = clamp(Number(h.end), 0, duration);
      return {
        start: startClamped,
        end: endClamped,
        title: String(h.title ?? '').slice(0, 100),
        reason: String(h.reason ?? ''),
        transcript: transcriptForRange(transcript.segments, startClamped, endClamped),
      };
    })
    .filter((h) => h.end > h.start);

  return highlights;
}

/** Concatenate transcript segments that overlap [start, end]. */
export function transcriptForRange(
  segments: TranscriptSegment[],
  start: number,
  end: number
): string {
  return segments
    .filter((s) => s.start < end && s.end > start)
    .map((s) => s.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Try strict JSON.parse first; if that fails, scrape the first {...} block. */
function extractJson<T>(content: string): T | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    /* fall through */
  }
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(content.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

async function safeError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.error || `HTTP ${res.status}`;
  } catch {
    try {
      const t = await res.text();
      return t || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}
