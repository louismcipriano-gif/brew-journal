import { useState } from 'react';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Card, Button, SectionTitle } from '../components/ui';

const STORAGE_KEY = 'brew-journal-anthropic-key';
const SCREENSHOT_KEY = 'brew-journal-screenshot-key';

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function getScreenshotKey(): string {
  return localStorage.getItem(SCREENSHOT_KEY) ?? '';
}

function saveApiKey(key: string) {
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
}

function saveScreenshotKey(key: string) {
  if (key) localStorage.setItem(SCREENSHOT_KEY, key);
  else localStorage.removeItem(SCREENSHOT_KEY);
}

function KeyField({
  label,
  hint,
  value,
  onChange,
  onSave,
  onClear,
  saved,
  placeholder = 'sk-...',
}: {
  label: string;
  hint: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  saved: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brew-faint hover:text-brew-muted transition-colors"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-xs text-brew-faint">{hint}</p>
      <div className="flex items-center gap-3 mt-1">
        <Button onClick={onSave} disabled={!value}>
          {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Key'}
        </Button>
        {value && (
          <Button variant="danger" size="sm" type="button" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [anthropicKey, setAnthropicKey] = useState(getApiKey);
  const [anthropicSaved, setAnthropicSaved] = useState(false);

  const [screenshotKey, setScreenshotKey] = useState(getScreenshotKey);
  const [screenshotSaved, setScreenshotSaved] = useState(false);

  function handleSaveAnthropic() {
    saveApiKey(anthropicKey);
    setAnthropicSaved(true);
    setTimeout(() => setAnthropicSaved(false), 2500);
  }

  function handleSaveScreenshot() {
    saveScreenshotKey(screenshotKey);
    setScreenshotSaved(true);
    setTimeout(() => setScreenshotSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="font-display italic text-brew-text text-3xl leading-tight">Settings</h1>
        <p className="text-brew-muted text-sm mt-1">Configure integrations and preferences</p>
      </div>

      <Card className="p-6 flex flex-col gap-6">
        <SectionTitle>AI Features</SectionTitle>

        <KeyField
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          value={anthropicKey}
          onChange={(v) => { setAnthropicKey(v); setAnthropicSaved(false); }}
          onSave={handleSaveAnthropic}
          onClear={() => { setAnthropicKey(''); saveApiKey(''); }}
          saved={anthropicSaved}
          hint={
            <>
              Powers Voice Fill, Scan Bag, and coffee URL import. Get yours at{' '}
              <span className="font-medium text-brew-primary-light">console.anthropic.com</span>
              {' '}— Haiku usage is &lt;$0.01 per call.
            </>
          }
        />

        <div className="border-t border-brew-border" />

        <KeyField
          label="ScreenshotOne API Key"
          placeholder="your-access-key"
          value={screenshotKey}
          onChange={(v) => { setScreenshotKey(v); setScreenshotSaved(false); }}
          onSave={handleSaveScreenshot}
          onClear={() => { setScreenshotKey(''); saveScreenshotKey(''); }}
          saved={screenshotSaved}
          hint={
            <>
              Enables Claude Vision for URL import — screenshots the product page so Claude can
              read tasting notes, elevation, and price even when they're rendered as images.
              Free tier (100/mo) at{' '}
              <span className="font-medium text-brew-primary-light">screenshotone.com</span>.
            </>
          }
        />
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
