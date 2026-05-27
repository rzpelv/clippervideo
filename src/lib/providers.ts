// OpenAI-compatible provider presets. Most modern AI providers expose an
// OpenAI-shaped API, so swapping providers is just a base-URL + model swap.

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  /** Default chat / LLM model for hook generation. */
  chatModel: string;
  /** Default Whisper-style model for audio transcription. Empty = not supported. */
  transcribeModel: string;
  /** Whether the provider has an /audio/transcriptions endpoint. */
  supportsTranscription: boolean;
  apiKeyHint?: string;
  docsUrl?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    transcribeModel: 'whisper-1',
    supportsTranscription: true,
    apiKeyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'groq',
    name: 'Groq · fast & cheap',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    transcribeModel: 'whisper-large-v3',
    supportsTranscription: true,
    apiKeyHint: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter · any model',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'anthropic/claude-3.5-sonnet',
    transcribeModel: '',
    supportsTranscription: false,
    apiKeyHint: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    chatModel: 'deepseek-chat',
    transcribeModel: '',
    supportsTranscription: false,
    apiKeyHint: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    chatModel: 'mistral-large-latest',
    transcribeModel: '',
    supportsTranscription: false,
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    chatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    transcribeModel: '',
    supportsTranscription: false,
    docsUrl: 'https://api.together.xyz/settings/api-keys',
  },
  {
    id: 'ollama',
    name: 'Ollama / local · OpenAI-compatible',
    baseUrl: 'http://localhost:11434/v1',
    chatModel: 'llama3.2',
    transcribeModel: '',
    supportsTranscription: false,
    apiKeyHint: 'ollama',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    chatModel: '',
    transcribeModel: '',
    supportsTranscription: true,
  },
];

export function presetById(id: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0];
}

export const DEFAULT_PROVIDER_ID = 'openai';
