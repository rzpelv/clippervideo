import { useEffect, useState } from 'react';
import { PROVIDER_PRESETS, presetById } from '../lib/providers';
import type { ProviderConfig } from '../lib/storage';

interface Props {
  open: boolean;
  initialTranscribe: ProviderConfig;
  initialChat: ProviderConfig;
  onSave: (transcribe: ProviderConfig, chat: ProviderConfig) => void;
  onClose: () => void;
}

type Slot = 'transcribe' | 'chat';

export function SettingsModal({
  open,
  initialTranscribe,
  initialChat,
  onSave,
  onClose,
}: Props) {
  const [transcribe, setTranscribe] = useState<ProviderConfig>(initialTranscribe);
  const [chat, setChat] = useState<ProviderConfig>(initialChat);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [linkedKey, setLinkedKey] = useState(
    initialTranscribe.providerId === initialChat.providerId &&
      initialTranscribe.apiKey === initialChat.apiKey &&
      initialTranscribe.apiKey !== ''
  );

  useEffect(() => {
    if (open) {
      setTranscribe(initialTranscribe);
      setChat(initialChat);
      setLinkedKey(
        initialTranscribe.providerId === initialChat.providerId &&
          initialTranscribe.apiKey === initialChat.apiKey &&
          initialTranscribe.apiKey !== ''
      );
    }
  }, [open, initialTranscribe, initialChat]);

  if (!open) return null;

  /** Update one slot. When linked, mirror provider+apiKey across both slots. */
  function update(slot: Slot, patch: Partial<ProviderConfig>) {
    if (slot === 'transcribe') {
      setTranscribe((prev) => ({ ...prev, ...patch }));
      if (linkedKey && (patch.apiKey !== undefined || patch.providerId !== undefined)) {
        setChat((prev) => ({
          ...prev,
          ...(patch.apiKey !== undefined ? { apiKey: patch.apiKey } : {}),
          ...(patch.providerId !== undefined ? mirrorPreset(patch.providerId, 'chat') : {}),
        }));
      }
    } else {
      setChat((prev) => ({ ...prev, ...patch }));
      if (linkedKey && (patch.apiKey !== undefined || patch.providerId !== undefined)) {
        setTranscribe((prev) => ({
          ...prev,
          ...(patch.apiKey !== undefined ? { apiKey: patch.apiKey } : {}),
          ...(patch.providerId !== undefined ? mirrorPreset(patch.providerId, 'transcribe') : {}),
        }));
      }
    }
  }

  /** When the preset changes, refresh baseUrl + model with that preset's defaults. */
  function changePreset(slot: Slot, providerId: string) {
    const preset = presetById(providerId);
    const defaultModel =
      slot === 'transcribe' ? preset.transcribeModel : preset.chatModel;
    update(slot, {
      providerId,
      baseUrl: preset.baseUrl,
      model: defaultModel,
    });
  }

  function applyQuickStart(providerId: string) {
    const preset = presetById(providerId);
    setTranscribe((prev) => ({
      ...prev,
      providerId: preset.id,
      baseUrl: preset.baseUrl,
      model: preset.transcribeModel || prev.model,
    }));
    setChat((prev) => ({
      ...prev,
      providerId: preset.id,
      baseUrl: preset.baseUrl,
      model: preset.chatModel || prev.model,
    }));
  }

  const transcribePreset = presetById(transcribe.providerId);
  const chatPreset = presetById(chat.providerId);

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__panel modal__panel--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h3>AI providers</h3>
          <p className="muted">
            Use any OpenAI-compatible provider. Keys live only in this browser
            (localStorage) and are sent directly to the chosen base URL.
          </p>
        </header>

        <div className="quickstart">
          <span className="muted">Quick setup:</span>
          {PROVIDER_PRESETS.filter((p) => p.id !== 'custom' && p.supportsTranscription).map(
            (p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => applyQuickStart(p.id)}
                title={`Use ${p.name} for both transcription and chat`}
              >
                {p.name.split(' · ')[0]}
              </button>
            )
          )}
        </div>

        <label className="check check--block">
          <input
            type="checkbox"
            checked={linkedKey}
            onChange={(e) => setLinkedKey(e.target.checked)}
          />
          Use the same provider &amp; API key for transcription and chat
        </label>

        <ProviderSection
          title="Transcription (Whisper)"
          slot="transcribe"
          config={transcribe}
          preset={transcribePreset}
          showAdvanced={showAdvanced}
          onChangePreset={(id) => changePreset('transcribe', id)}
          onChange={(patch) => update('transcribe', patch)}
        />

        <ProviderSection
          title="Chat / Hook generation"
          slot="chat"
          config={chat}
          preset={chatPreset}
          showAdvanced={showAdvanced}
          onChangePreset={(id) => changePreset('chat', id)}
          onChange={(patch) => update('chat', patch)}
        />

        <label className="check">
          <input
            type="checkbox"
            checked={showAdvanced}
            onChange={(e) => setShowAdvanced(e.target.checked)}
          />
          Show advanced (custom base URL)
        </label>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave(
                {
                  ...transcribe,
                  apiKey: transcribe.apiKey.trim(),
                  baseUrl: transcribe.baseUrl.trim(),
                  model: transcribe.model.trim(),
                },
                {
                  ...chat,
                  apiKey: chat.apiKey.trim(),
                  baseUrl: chat.baseUrl.trim(),
                  model: chat.model.trim(),
                }
              );
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Re-derive baseUrl + model from a preset for a given slot. */
function mirrorPreset(providerId: string, slot: Slot): Partial<ProviderConfig> {
  const preset = presetById(providerId);
  return {
    providerId,
    baseUrl: preset.baseUrl,
    model: slot === 'transcribe' ? preset.transcribeModel : preset.chatModel,
  };
}

interface SectionProps {
  title: string;
  slot: Slot;
  config: ProviderConfig;
  preset: ReturnType<typeof presetById>;
  showAdvanced: boolean;
  onChangePreset: (id: string) => void;
  onChange: (patch: Partial<ProviderConfig>) => void;
}

function ProviderSection({
  title,
  slot,
  config,
  preset,
  showAdvanced,
  onChangePreset,
  onChange,
}: SectionProps) {
  const unsupported = slot === 'transcribe' && !preset.supportsTranscription;

  return (
    <section className="provider-section">
      <h4 className="provider-section__title">{title}</h4>

      <label className="field field--block">
        <span>Provider</span>
        <select
          value={config.providerId}
          onChange={(e) => onChangePreset(e.target.value)}
        >
          {PROVIDER_PRESETS.map((p) => (
            <option
              key={p.id}
              value={p.id}
              disabled={slot === 'transcribe' && !p.supportsTranscription && p.id !== 'custom'}
            >
              {p.name}
              {slot === 'transcribe' && !p.supportsTranscription && p.id !== 'custom'
                ? ' — no Whisper'
                : ''}
            </option>
          ))}
        </select>
      </label>

      {unsupported && (
        <p className="error provider-section__warn">
          {preset.name} does not offer audio transcription. Pick a different provider
          for this slot, or use Custom and point at a Whisper-compatible endpoint.
        </p>
      )}

      <label className="field field--block">
        <span>
          API key{' '}
          {preset.docsUrl && (
            <a href={preset.docsUrl} target="_blank" rel="noreferrer" className="muted">
              (get one ↗)
            </a>
          )}
        </span>
        <input
          type="password"
          placeholder={preset.apiKeyHint || 'sk-...'}
          value={config.apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="field field--block">
        <span>Model</span>
        <input
          type="text"
          placeholder={
            slot === 'transcribe' ? preset.transcribeModel || 'whisper-1' : preset.chatModel
          }
          value={config.model}
          onChange={(e) => onChange({ model: e.target.value })}
          spellCheck={false}
        />
      </label>

      {showAdvanced && (
        <label className="field field--block">
          <span>Base URL</span>
          <input
            type="text"
            placeholder={preset.baseUrl || 'https://your-endpoint/v1'}
            value={config.baseUrl}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            spellCheck={false}
          />
        </label>
      )}
    </section>
  );
}
