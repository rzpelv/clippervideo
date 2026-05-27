import { presetById, DEFAULT_PROVIDER_ID } from './providers';

/** A complete AI provider configuration: which preset, the API key, the
 *  base URL (auto-filled from the preset but overridable), and the model. */
export interface ProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const KEYS = {
  TRANSCRIBE: 'clippervideo:transcribe-config',
  CHAT: 'clippervideo:chat-config',
  // legacy single-provider keys (pre multi-provider support)
  OLD_KEY: 'clippervideo:openai-api-key',
  OLD_MODEL: 'clippervideo:openai-chat-model',
};

function defaultTranscribe(): ProviderConfig {
  const p = presetById(DEFAULT_PROVIDER_ID);
  return {
    providerId: p.id,
    apiKey: '',
    baseUrl: p.baseUrl,
    model: p.transcribeModel || 'whisper-1',
  };
}

function defaultChat(): ProviderConfig {
  const p = presetById(DEFAULT_PROVIDER_ID);
  return {
    providerId: p.id,
    apiKey: '',
    baseUrl: p.baseUrl,
    model: p.chatModel || 'gpt-4o-mini',
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

/** One-time migration from the old single-key storage to the new dual-config shape. */
function migrateLegacy(): void {
  try {
    const oldKey = localStorage.getItem(KEYS.OLD_KEY);
    if (!oldKey) return;
    const oldModel = localStorage.getItem(KEYS.OLD_MODEL) || 'gpt-4o-mini';
    const t = { ...defaultTranscribe(), apiKey: oldKey };
    const c = { ...defaultChat(), apiKey: oldKey, model: oldModel };
    if (!localStorage.getItem(KEYS.TRANSCRIBE)) {
      localStorage.setItem(KEYS.TRANSCRIBE, JSON.stringify(t));
    }
    if (!localStorage.getItem(KEYS.CHAT)) {
      localStorage.setItem(KEYS.CHAT, JSON.stringify(c));
    }
    localStorage.removeItem(KEYS.OLD_KEY);
    localStorage.removeItem(KEYS.OLD_MODEL);
  } catch {
    /* ignore */
  }
}

export const storage = {
  getTranscribeConfig(): ProviderConfig {
    migrateLegacy();
    return readJson(KEYS.TRANSCRIBE, defaultTranscribe());
  },
  getChatConfig(): ProviderConfig {
    migrateLegacy();
    return readJson(KEYS.CHAT, defaultChat());
  },
  setTranscribeConfig(c: ProviderConfig) {
    try {
      localStorage.setItem(KEYS.TRANSCRIBE, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  },
  setChatConfig(c: ProviderConfig) {
    try {
      localStorage.setItem(KEYS.CHAT, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  },
};
