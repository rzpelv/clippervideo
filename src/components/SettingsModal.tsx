import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  initialKey: string;
  initialModel: string;
  onSave: (key: string, model: string) => void;
  onClose: () => void;
}

export function SettingsModal({ open, initialKey, initialModel, onSave, onClose }: Props) {
  const [key, setKey] = useState(initialKey);
  const [model, setModel] = useState(initialModel);

  useEffect(() => {
    if (open) {
      setKey(initialKey);
      setModel(initialModel);
    }
  }, [open, initialKey, initialModel]);

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <h3>OpenAI settings</h3>
        <p className="muted">
          Your key is stored only in this browser (localStorage) and sent directly to api.openai.com.
        </p>

        <label className="field field--block">
          <span>API key</span>
          <input
            type="password"
            placeholder="sk-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="field field--block">
          <span>Chat model (for highlight suggestions)</span>
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave(key.trim(), model.trim() || 'gpt-4o-mini');
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
