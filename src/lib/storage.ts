const KEY = 'clippervideo:openai-api-key';
const MODEL_KEY = 'clippervideo:openai-chat-model';

export const storage = {
  getApiKey(): string {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  },
  setApiKey(value: string) {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
  getChatModel(): string {
    try {
      return localStorage.getItem(MODEL_KEY) ?? 'gpt-4o-mini';
    } catch {
      return 'gpt-4o-mini';
    }
  },
  setChatModel(value: string) {
    try {
      localStorage.setItem(MODEL_KEY, value || 'gpt-4o-mini');
    } catch {
      /* ignore */
    }
  },
};
