import { useState } from 'react';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Card, Button, SectionTitle } from '../components/ui';

const STORAGE_KEY = 'brew-journal-anthropic-key';

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

function saveApiKey(key: string) {
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
}

export default function Settings() {
  const [key, setKey] = useState(getApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="font-display italic text-brew-text text-3xl leading-tight">Settings</h1>
        <p className="text-brew-muted text-sm mt-1">Configure integrations and preferences</p>
      </div>

      <Card className="p-6 flex flex-col gap-5">
        <SectionTitle>AI Features</SectionTitle>
        <p className="text-sm text-brew-muted leading-relaxed">
          Add your Anthropic API key to enable <strong className="text-brew-text">Scan Coffee Bag</strong> —
          photograph any bag and have origin, processing, tasting notes, and more auto-filled.
          Your key is stored only on this device and sent exclusively to Anthropic.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">
            Anthropic API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => { setKey(e.target.value); setSaved(false); }}
              placeholder="sk-ant-..."
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brew-faint hover:text-brew-muted transition-colors"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-brew-faint">
            Get yours at{' '}
            <span className="font-medium text-brew-primary-light">console.anthropic.com</span>
            {' '}— Haiku usage is very inexpensive (&lt;$0.01 per scan).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!key}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Key'}
          </Button>
          {key && (
            <Button variant="danger" size="sm" type="button" onClick={() => { setKey(''); saveApiKey(''); }}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6 flex flex-col gap-3">
        <SectionTitle>About</SectionTitle>
        <dl className="flex flex-col gap-2 text-sm">
          {[
            { label: 'App', value: 'Brew Journal' },
            { label: 'Storage', value: 'Local — this device only' },
            { label: 'Data key', value: 'brew-journal-v1' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-brew-faint">{label}</span>
              <span className="text-brew-text font-medium font-mono text-xs">{value}</span>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
