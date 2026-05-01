import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Edit2, Coffee, Camera, ImagePlus, Loader2, Link, Star, MapPin, Calendar, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Button, Card, Badge, Input, Select, EmptyState, ScoreRing, SectionTitle, Toggle, MicButton,
} from '../components/ui';
import {
  calcBrewScore, formatDate, daysOffRoast, pricePerGram, brewRatio,
} from '../utils';
import { scanCoffeeBag } from '../utils/scanBag';
import { fetchCoffeeFromUrl } from '../utils/fetchCoffeeUrl';
import { getApiKey, getScreenshotKey } from './Settings';
import type { Coffee as CoffeeType, ProcessingMethod, RoastLevel, CoffeeStyle } from '../types';

const PROCESSING: ProcessingMethod[] = [
  'Washed', 'Honey', 'Natural', 'Washed Anaerobic',
  'Natural/Honey Anaerobic', 'Thermal Shock', 'Co-Ferment', 'Hybrid/Other',
];
const ROASTS: RoastLevel[] = ['Ultra Light', 'Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];
const COFFEE_STYLES: CoffeeStyle[] = ['Terroir-Focused', 'Fruity', 'Funky', 'Experimental'];

type BrewingStatus = 'brewing' | 'resting' | 'freezing' | 'finished';

function getStatus(c: CoffeeType): BrewingStatus {
  if (c.isFinished) return 'finished';
  if (c.isFreezing) return 'freezing';
  if (c.isResting) return 'resting';
  return 'brewing';
}

/** Days spent in freezer. If still freezing (no stop date), counts up to today. */
function calcFreezeDays(freezeStart?: string, freezeStop?: string): number {
  if (!freezeStart) return 0;
  const start = new Date(freezeStart).getTime();
  const end = freezeStop ? new Date(freezeStop).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

/** Days off roast excluding time spent in freezer. */
function effectiveDaysOffRoast(
  roastDate: string,
  asOf: string,
  freezeStart?: string,
  freezeStop?: string,
): number {
  const total = daysOffRoast(roastDate, asOf);
  return Math.max(0, total - calcFreezeDays(freezeStart, freezeStop));
}

const blankCoffee: Omit<CoffeeType, 'id' | 'createdAt'> = {
  roaster: '',
  coffeeName: '',
  producer: '',
  farm: '',
  countryOrigin: '',
  region: '',
  roastLevel: 'Light',
  processingMethod: 'Washed',
  roastDate: '',
  elevation: '',
  varietal: '',
  tastingNotes: '',
  price: 0,
  gramsPerBag: 0,
  score: null,
  coffeeStyle: [],
  isResting: false,
  isFinished: false,
  isFreezing: false,
  freezeStart: undefined,
  freezeStop: undefined,
  isFavorite: false,
};

// ── Coffee Form ───────────────────────────────────────────────────────────────

export function CoffeeForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const { addCoffee, updateCoffee, getCoffee } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const existing = isEdit ? getCoffee(id!) : undefined;
  const [form, setForm] = useState<Omit<CoffeeType, 'id' | 'createdAt'>>(
    existing
      ? {
          roaster: existing.roaster,
          coffeeName: existing.coffeeName ?? '',
          producer: existing.producer ?? '',
          farm: existing.farm ?? '',
          countryOrigin: existing.countryOrigin,
          region: existing.region,
          roastLevel: existing.roastLevel,
          processingMethod: existing.processingMethod,
          roastDate: existing.roastDate,
          elevation: existing.elevation,
          varietal: existing.varietal,
          tastingNotes: existing.tastingNotes,
          price: existing.price,
          gramsPerBag: existing.gramsPerBag,
          score: existing.score,
          coffeeStyle: existing.coffeeStyle ?? [],
          isResting: existing.isResting ?? false,
          isFinished: existing.isFinished ?? false,
          isFreezing: existing.isFreezing ?? false,
          freezeStart: existing.freezeStart,
          freezeStop: existing.freezeStop,
          isFavorite: existing.isFavorite ?? false,
        }
      : blankCoffee,
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setStatus(status: BrewingStatus) {
    setForm((f) => ({
      ...f,
      isResting: status === 'resting',
      isFinished: status === 'finished',
      isFreezing: status === 'freezing',
    }));
  }

  const currentStatus: BrewingStatus = form.isFinished ? 'finished' : form.isFreezing ? 'freezing' : form.isResting ? 'resting' : 'brewing';

  const daysOff = form.roastDate && currentStatus !== 'finished'
    ? effectiveDaysOffRoast(form.roastDate, new Date().toISOString(), form.freezeStart, form.freezeStop)
    : null;
  const freezeDays = calcFreezeDays(form.freezeStart, form.freezeStop);

  async function handleScanBag(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      setScanError('No API key set. Go to Settings and add your Anthropic API key.');
      return;
    }
    setScanError('');
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const [header, base64] = dataUrl.split(',');
        const mediaType = header.split(';')[0].replace('data:', '');
        try {
          const result = await scanCoffeeBag(base64, mediaType, apiKey);
          const validRoasts: RoastLevel[] = ['Ultra Light', 'Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];
          setForm((f) => ({
            ...f,
            roaster: result.roaster || f.roaster,
            coffeeName: result.coffeeName || f.coffeeName,
            producer: result.producer || f.producer,
            countryOrigin: result.countryOrigin || f.countryOrigin,
            region: result.region || f.region,
            varietal: result.varietal || f.varietal,
            elevation: result.elevation || f.elevation,
            tastingNotes: result.tastingNotes || f.tastingNotes,
            processingMethod: result.processingMethod || f.processingMethod,
            roastLevel: validRoasts.includes(result.roastLevel as RoastLevel)
              ? (result.roastLevel as RoastLevel)
              : f.roastLevel,
          }));
        } catch (err: any) {
          setScanError(err.message || 'Scan failed. Check your API key and try again.');
        } finally {
          setScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setScanning(false);
      setScanError('Could not read image file.');
    }
    e.target.value = '';
  }

  async function handleUrlImport() {
    if (!urlInput.trim()) return;
    setScanError('');
    setFetchingUrl(true);
    try {
      const apiKey = getApiKey() || undefined;
      const screenshotKey = getScreenshotKey() || undefined;
      const result = await fetchCoffeeFromUrl(urlInput.trim(), apiKey, screenshotKey);
      const validRoasts: RoastLevel[] = ['Ultra Light', 'Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];
      const parsedPrice = parseFloat(result.price);
      const parsedGrams = parseInt(result.gramsPerBag);
      setForm((f) => ({
        ...f,
        roaster:           result.roaster           || f.roaster,
        coffeeName:        result.coffeeName        || f.coffeeName,
        producer:          result.producer          || f.producer,
        farm:              result.farm              || f.farm,
        countryOrigin:     result.countryOrigin     || f.countryOrigin,
        region:            result.region            || f.region,
        varietal:          result.varietal          || f.varietal,
        elevation:         result.elevation         || f.elevation,
        tastingNotes:      result.tastingNotes      || f.tastingNotes,
        processingMethod:  result.processingMethod  || f.processingMethod,
        roastLevel: validRoasts.includes(result.roastLevel as RoastLevel)
          ? (result.roastLevel as RoastLevel)
          : f.roastLevel,
        price:       !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : f.price,
        gramsPerBag: !isNaN(parsedGrams) && parsedGrams > 0 ? parsedGrams : f.gramsPerBag,
      }));
      setUrlInput('');
    } catch (err: any) {
      setScanError(err.message || 'Could not import from URL.');
    } finally {
      setFetchingUrl(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roaster || !form.countryOrigin) return;
    if (isEdit) {
      updateCoffee(id!, form);
      navigate(`/coffees/${id}`);
    } else {
      const c = addCoffee(form);
      navigate(`/coffees/${c.id}`);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <h1 className="font-display italic text-brew-text text-2xl leading-tight">{isEdit ? 'Edit Coffee' : 'Add Coffee'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-8">
        {/* Origin */}
        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle>Origin & Identity</SectionTitle>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {/* Camera input — forces native camera on mobile */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleScanBag}
              />
              {/* Upload input — allows photo library / file picker */}
              <input
                type="file"
                accept="image/*"
                ref={uploadInputRef}
                className="hidden"
                onChange={handleScanBag}
              />
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => { setScanError(''); fileInputRef.current?.click(); }}
                  disabled={scanning}
                  title="Take a photo with your camera"
                >
                  {scanning ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => { setScanError(''); uploadInputRef.current?.click(); }}
                  disabled={scanning}
                  title="Upload a photo from your library or files"
                >
                  {scanning ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                </Button>
              </div>
              <span className="text-xs text-brew-faint">{scanning ? 'Scanning…' : 'Camera or upload a photo'}</span>
            </div>
          </div>
          <div className="flex gap-2 items-center p-3 bg-brew-surface rounded-lg border border-brew-border">
            <Link size={14} className="text-brew-faint flex-shrink-0" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setScanError(''); }}
              placeholder="Paste a coffee product URL to auto-fill…"
              className="flex-1 bg-transparent text-sm text-brew-text placeholder-brew-faint focus:outline-none min-w-0"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUrlImport}
              disabled={fetchingUrl || !urlInput.trim()}
            >
              {fetchingUrl ? <><Loader2 size={13} className="animate-spin" /> Importing…</> : 'Import'}
            </Button>
          </div>
          {scanError && (
            <div className="p-3 bg-brew-negative/10 border border-brew-negative/30 rounded-lg text-xs text-brew-negative">
              {scanError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Roaster *" value={form.roaster} onChange={(e) => set('roaster', e.target.value)} placeholder="e.g. Onyx Coffee Lab" required />
            <Input label="Coffee Name" value={form.coffeeName ?? ''} onChange={(e) => set('coffeeName', e.target.value)} placeholder="e.g. Buttercream, Guji Natural" />
            <Input label="Producer" value={form.producer ?? ''} onChange={(e) => set('producer', e.target.value)} placeholder="e.g. La Capilla, El Vergel" />
            <Input label="Farm" value={form.farm ?? ''} onChange={(e) => set('farm', e.target.value)} placeholder="e.g. Finca El Paraíso" />
            <Input label="Country of Origin *" value={form.countryOrigin} onChange={(e) => set('countryOrigin', e.target.value)} placeholder="e.g. Ethiopia" required />
            <Input label="Region" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. Yirgacheffe" />
            <Input label="Varietal" value={form.varietal} onChange={(e) => set('varietal', e.target.value)} placeholder="e.g. Heirloom" />
            <Input label="Elevation" value={form.elevation} onChange={(e) => set('elevation', e.target.value)} placeholder="e.g. 1800–2200 masl" />
            <Select
              label="Processing Method"
              value={form.processingMethod}
              onChange={(e) => set('processingMethod', e.target.value as ProcessingMethod)}
              placeholder="— Select method —"
              options={PROCESSING.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {/* Coffee Style */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Coffee Style</label>
            <div className="flex flex-wrap gap-2">
              {COFFEE_STYLES.map((style) => {
                const active = (form.coffeeStyle ?? []).includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      const current = form.coffeeStyle ?? [];
                      set('coffeeStyle', active ? current.filter((s) => s !== style) : [...current, style]);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                      active
                        ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                        : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                    }`}
                  >
                    {active ? '✓ ' : ''}{style}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Roast */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Roast Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Roast Level"
              value={form.roastLevel}
              onChange={(e) => set('roastLevel', e.target.value as RoastLevel)}
              options={ROASTS.map((r) => ({ value: r, label: r }))}
            />
            <Input
              label="Roast Date"
              type="date"
              value={form.roastDate}
              onChange={(e) => set('roastDate', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Roaster's Tasting Notes</label>
              <MicButton onResult={(t) => set('tastingNotes', form.tastingNotes ? `${form.tastingNotes}, ${t}` : t)} />
            </div>
            <textarea
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
              value={form.tastingNotes}
              onChange={(e) => set('tastingNotes', e.target.value)}
              rows={3}
              placeholder="e.g. jasmine, peach, honey, brown sugar..."
            />
          </div>
        </Card>

        {/* Brewing Status */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Brewing Status</SectionTitle>
          <div className="flex gap-2 flex-wrap">
            {([
              { value: 'brewing', label: 'Brewing Now' },
              { value: 'resting', label: 'Resting' },
              { value: 'freezing', label: 'Freezing' },
              { value: 'finished', label: 'Finished' },
            ] as { value: BrewingStatus; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  currentStatus === value
                    ? value === 'freezing'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-brew-primary text-brew-bg border-brew-primary'
                    : 'bg-brew-surface text-brew-muted border-brew-border hover:border-brew-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Freeze date fields — only shown when Freezing is selected */}
          {currentStatus === 'freezing' && (
            <div className="flex flex-col gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Freeze Start"
                  type="date"
                  value={form.freezeStart ?? ''}
                  onChange={(e) => set('freezeStart', e.target.value || undefined)}
                />
                <Input
                  label="Freeze Stop"
                  type="date"
                  value={form.freezeStop ?? ''}
                  onChange={(e) => set('freezeStop', e.target.value || undefined)}
                />
              </div>
              {form.freezeStart && (
                <div className="text-xs text-blue-700 font-medium">
                  ❄ Freeze time: <span className="font-bold">{freezeDays} day{freezeDays !== 1 ? 's' : ''}</span>
                  {!form.freezeStop && ' (still freezing)'}
                </div>
              )}
            </div>
          )}

          {/* Days off roast — shown for Brewing Now and Resting */}
          {daysOff !== null && (
            <div className={`p-3 rounded-lg border ${
              currentStatus === 'resting'
                ? daysOff < 14 ? 'bg-amber-50/50 border-amber-200' :
                  daysOff <= 28 ? 'bg-green-50/50 border-green-200' : 'bg-brew-surface border-brew-border'
                : 'bg-brew-surface border-brew-border'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-brew-faint mb-0.5">Days off roast</div>
                  <div className={`text-2xl font-bold ${
                    currentStatus === 'resting'
                      ? daysOff < 14 ? 'text-amber-500' : daysOff <= 28 ? 'text-green-600' : 'text-brew-muted'
                      : 'text-brew-text'
                  }`}>
                    {daysOff}d{freezeDays > 0 && <span className="text-blue-400 text-lg align-super">*</span>}
                  </div>
                  {currentStatus === 'resting' && (
                    <div className="text-xs text-brew-faint mt-0.5">
                      {daysOff < 14
                        ? `~${14 - daysOff} more days to the 2-week mark`
                        : daysOff <= 28
                        ? 'In the sweet spot — ready to brew!'
                        : 'Past the 4-week peak window'}
                    </div>
                  )}
                </div>
                {currentStatus === 'resting' && (
                  <div className="w-20 flex flex-col items-end gap-1">
                    <div className="w-full h-1.5 rounded-full bg-brew-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          daysOff < 14 ? 'bg-amber-400' : daysOff <= 28 ? 'bg-green-500' : 'bg-brew-muted'
                        }`}
                        style={{ width: `${Math.min(100, (daysOff / 28) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-brew-faint">2–4 wk window</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Toggle
            label="Favorite"
            checked={!!form.isFavorite}
            onChange={(v) => set('isFavorite', v)}
          />
        </Card>

        {/* Bag Details */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Bag Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              min={0}
              step={0.01}
              value={form.price || ''}
              onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
              suffix="$"
              placeholder="0.00"
            />
            <Input
              label="Bag Weight"
              type="number"
              min={0}
              step={1}
              value={form.gramsPerBag || ''}
              onChange={(e) => set('gramsPerBag', parseInt(e.target.value) || 0)}
              suffix="g"
              placeholder="250"
            />
          </div>
          {form.price > 0 && form.gramsPerBag > 0 && (
            <div className="text-sm text-brew-muted">
              Price per gram:{' '}
              <span className="text-brew-primary-light font-medium">{pricePerGram(form.price, form.gramsPerBag)}</span>
            </div>
          )}
        </Card>

        {/* Personal Score */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Personal Coffee Score</SectionTitle>
          <p className="text-xs text-brew-faint">Your overall rating for this coffee (optional)</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={form.score ?? 0}
              onChange={(e) => set('score', parseFloat(e.target.value) || null)}
              style={{
                background: `linear-gradient(to right, #5a3820 0%, #5a3820 ${(form.score ?? 0) * 10}%, #e5ddd0 ${(form.score ?? 0) * 10}%, #e5ddd0 100%)`,
                width: '100%',
              }}
            />
            <span className="text-brew-primary-light font-bold w-8 text-right text-sm">
              {form.score ?? '—'}
            </span>
          </div>
          <Toggle
            label="No score yet"
            checked={form.score === null}
            onChange={(v) => set('score', v ? null : 7)}
          />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" size="lg">
            {isEdit ? 'Save Changes' : 'Add Coffee'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Coffee Detail ─────────────────────────────────────────────────────────────

export function CoffeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCoffee, getBrewsForCoffee, deleteCoffee, updateCoffee } = useApp();

  const coffee = getCoffee(id!);
  if (!coffee) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/coffees')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <p className="text-brew-muted">Coffee not found.</p>
      </div>
    );
  }

  const brews = getBrewsForCoffee(id!).sort(
    (a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime(),
  );
  const scores = brews.map((b) => calcBrewScore(b.flavorProfile));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const status = getStatus(coffee);
  const freezeDays = calcFreezeDays(coffee.freezeStart, coffee.freezeStop);
  const daysOff = coffee.roastDate && status !== 'finished'
    ? effectiveDaysOffRoast(coffee.roastDate, new Date().toISOString(), coffee.freezeStart, coffee.freezeStop)
    : null;

  function setStatus(s: BrewingStatus) {
    updateCoffee(id!, {
      isResting: s === 'resting',
      isFinished: s === 'finished',
      isFreezing: s === 'freezing',
    });
  }

  function handleDelete() {
    if (confirm(`Delete "${coffee!.roaster}" and all its brews? This cannot be undone.`)) {
      deleteCoffee(id!);
      navigate('/coffees');
    }
  }

  const statusColors: Record<BrewingStatus, string> = {
    brewing: 'bg-green-100 text-green-700',
    resting: 'bg-amber-100 text-amber-700',
    freezing: 'bg-blue-100 text-blue-700',
    finished: 'bg-brew-surface text-brew-muted',
  };
  const statusLabel: Record<BrewingStatus, string> = {
    brewing: 'Active',
    resting: 'Resting',
    freezing: 'Freezing',
    finished: 'Finished',
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/coffees')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/coffees/${id}/edit`)}>
            <Edit2 size={14} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Main info */}
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[status]}`}>
              {statusLabel[status]}
            </span>
            {coffee.isFavorite && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Star size={10} className="fill-amber-500 text-amber-500" /> Favorite
              </span>
            )}
            <Badge variant="amber">{coffee.processingMethod}</Badge>
            <Badge>{coffee.roastLevel}</Badge>
            {coffee.score !== null && <Badge variant="gold">★ {coffee.score}/10</Badge>}
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brew-muted">{coffee.roaster}</p>
          <h1 className="font-display italic text-brew-text text-4xl leading-tight mt-1">{coffee.coffeeName || coffee.roaster}</h1>
          {coffee.coffeeName && (
            <p className="text-brew-muted text-lg mt-0.5">{coffee.roaster}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-brew-muted text-sm flex-wrap">
            {(coffee.countryOrigin || coffee.region) && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-brew-faint" />
                {coffee.countryOrigin}{coffee.region ? `, ${coffee.region}` : ''}
              </span>
            )}
            {coffee.roastDate && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-brew-faint" />
                {formatDate(coffee.roastDate)}
              </span>
            )}
          </div>
          {(coffee.producer || coffee.farm) && (
            <p className="text-brew-faint text-sm mt-1">
              {coffee.producer && <span>Producer: {coffee.producer}</span>}
              {coffee.producer && coffee.farm && <span> · </span>}
              {coffee.farm && <span>Farm: {coffee.farm}</span>}
            </p>
          )}
          {coffee.coffeeStyle && coffee.coffeeStyle.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {coffee.coffeeStyle.map((style) => (
                <span key={style} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brew-primary/10 text-brew-primary-light border border-brew-primary/20">
                  {style}
                </span>
              ))}
            </div>
          )}
          {coffee.varietal && (
            <p className="text-brew-faint text-sm mt-0.5">{coffee.varietal}{coffee.elevation ? ` · ${coffee.elevation}` : ''}</p>
          )}
          {coffee.tastingNotes && (
            <p className="text-brew-muted text-sm mt-3 italic">"{coffee.tastingNotes}"</p>
          )}
        </div>
        {avgScore !== null && (
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <ScoreRing score={avgScore} size={72} />
            <span className="text-xs text-brew-faint">avg brew score</span>
          </div>
        )}
      </div>

      {/* Days off roast panel */}
      {daysOff !== null && (
        <Card className={`p-4 ${
          status === 'resting'
            ? daysOff < 14 ? 'border-amber-200 bg-amber-50/30' :
              daysOff <= 28 ? 'border-green-200 bg-green-50/30' : ''
            : ''
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brew-muted mb-1">Days off Roast</div>
              <div className={`text-3xl font-bold ${
                status === 'resting'
                  ? daysOff < 14 ? 'text-amber-500' : daysOff <= 28 ? 'text-green-600' : 'text-brew-muted'
                  : 'text-brew-text'
              }`}>
                {daysOff}d{freezeDays > 0 && <span className="text-blue-400 text-xl align-super">*</span>}
              </div>
              {status === 'resting' && (
                <div className="text-xs text-brew-faint mt-0.5">
                  {daysOff < 14
                    ? `~${14 - daysOff} more days to the 2-week mark`
                    : daysOff <= 28
                    ? 'In the sweet spot — ready to brew!'
                    : 'Past the 4-week peak window'}
                </div>
              )}
              {freezeDays > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  ❄ {freezeDays}d in freezer not counted
                </div>
              )}
            </div>
            {status === 'resting' && (
              <div className="w-28">
                <div className="w-full h-2 rounded-full bg-brew-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      daysOff < 14 ? 'bg-amber-400' : daysOff <= 28 ? 'bg-green-500' : 'bg-brew-muted'
                    }`}
                    style={{ width: `${Math.min(100, (daysOff / 28) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-brew-faint mt-1">
                  <span>0</span><span>14d</span><span>28d</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => updateCoffee(id!, { isFavorite: !coffee.isFavorite })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            coffee.isFavorite
              ? 'bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-brew-card border-brew-border text-brew-muted hover:border-brew-primary'
          }`}
        >
          <Star size={12} className={coffee.isFavorite ? 'fill-amber-500 text-amber-500' : ''} />
          {coffee.isFavorite ? 'Favorited' : 'Add to Favorites'}
        </button>
        {(['brewing', 'resting', 'freezing', 'finished'] as BrewingStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              status === s
                ? s === 'freezing'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-brew-primary text-brew-bg border-brew-primary'
                : 'bg-brew-card border-brew-border text-brew-muted hover:border-brew-primary'
            }`}
          >
            {s === 'finished' && <CheckCircle size={12} />}
            {s === 'brewing' ? 'Brewing Now' : s === 'resting' ? 'Resting' : s === 'freezing' ? '❄ Freezing' : 'Finished'}
          </button>
        ))}
        {/* Show freeze duration inline when freezing or was frozen */}
        {(status === 'freezing' || (coffee.freezeStart && coffee.freezeStop)) && freezeDays > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700">
            ❄ {freezeDays}d frozen{!coffee.freezeStop ? ' (ongoing)' : ''}
          </span>
        )}
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Roast Date', value: coffee.roastDate ? formatDate(coffee.roastDate) : '—' },
          { label: 'Bag Size', value: coffee.gramsPerBag ? `${coffee.gramsPerBag}g` : '—' },
          { label: 'Price', value: coffee.price ? `$${coffee.price.toFixed(2)}` : '—' },
          {
            label: 'Per Gram',
            value: coffee.price && coffee.gramsPerBag ? pricePerGram(coffee.price, coffee.gramsPerBag) : '—',
          },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-brew-faint mb-1">{label}</div>
            <div className="text-sm font-semibold text-brew-text">{value}</div>
          </Card>
        ))}
      </div>

      {/* Brews */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brew-muted">
            Brews ({brews.length})
          </h2>
          <Button size="sm" onClick={() => navigate(`/brews/new?coffeeId=${id}`)}>
            <Plus size={12} /> Log Brew
          </Button>
        </div>

        {brews.length === 0 ? (
          <EmptyState
            icon={<Coffee size={32} />}
            title="No brews logged yet"
            description="Start dialing in this coffee."
            action={
              <Button size="sm" onClick={() => navigate(`/brews/new?coffeeId=${id}`)}>
                <Plus size={12} /> Log First Brew
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {brews.map((brew) => {
              const score = calcBrewScore(brew.flavorProfile);
              const days = coffee.roastDate ? daysOffRoast(coffee.roastDate, brew.brewDate) : null;
              return (
                <Card
                  key={brew.id}
                  className="p-4 flex items-center gap-4"
                  onClick={() => navigate(`/brews/${brew.id}`)}
                >
                  <ScoreRing score={score} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-brew-text">
                        {brew.brewMethod} · {brew.brewingDevice || '—'}
                      </span>
                      {brew.isGoToRecipe && <Badge variant="gold">★ Go-To</Badge>}
                      <Badge variant={
                        brew.flavorProfile.perceivedExtraction === 'Balanced' ? 'positive' :
                        brew.flavorProfile.perceivedExtraction === 'Over' ? 'negative' : 'amber'
                      }>
                        {brew.flavorProfile.perceivedExtraction}
                      </Badge>
                    </div>
                    <div className="text-xs text-brew-faint mt-0.5 flex gap-2 flex-wrap">
                      <span>{brew.grinder || '—'} @ {brew.grindSetting || '—'}</span>
                      <span>·</span>
                      <span>{brew.coffeeDose}g : {brew.waterAmount}g</span>
                      <span>·</span>
                      <span>{brewRatio(brew.waterAmount, brew.coffeeDose)}</span>
                      {days !== null && <><span>·</span><span>{days}d off roast</span></>}
                    </div>
                    {brew.brewRecipeName && (
                      <div className="text-xs text-brew-primary mt-0.5">{brew.brewRecipeName}</div>
                    )}
                  </div>
                  <div className="text-xs text-brew-faint flex-shrink-0">{formatDate(brew.brewDate)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Coffee List ───────────────────────────────────────────────────────────────

function CoffeeListCard({
  c,
  allBrews,
  onNavigate,
  onToggleFavorite,
}: {
  c: CoffeeType;
  allBrews: any[];
  onNavigate: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const brews = allBrews.filter((b) => b.coffeeId === c.id);
  const scores = brews.map((b) => calcBrewScore(b.flavorProfile));
  const freezeDays = calcFreezeDays(c.freezeStart, c.freezeStop);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const status = getStatus(c);
  const daysOff = c.roastDate && status !== 'finished'
    ? effectiveDaysOffRoast(c.roastDate, new Date().toISOString(), c.freezeStart, c.freezeStop)
    : null;

  return (
    <div
      className="bg-brew-card border border-brew-border rounded-xl overflow-hidden cursor-pointer hover:border-brew-primary/40 transition-colors"
      onClick={onNavigate}
    >
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-brew-muted leading-relaxed">{c.roaster}</p>
          {c.isFavorite && (
            <Star size={13} className="fill-amber-400 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
        </div>
        <h2 className="font-display italic text-brew-text text-2xl leading-tight">
          {c.coffeeName || c.countryOrigin}
        </h2>
        <div className="flex items-center gap-4 mt-2 text-brew-muted text-sm flex-wrap">
          {(c.countryOrigin || c.region) && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-brew-faint" />
              {c.countryOrigin}{c.region ? `, ${c.region}` : ''}
            </span>
          )}
          {c.roastDate && (
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-brew-faint" />
              {formatDate(c.roastDate)}
            </span>
          )}
        </div>

        {/* Resting progress bar */}
        {status === 'resting' && daysOff !== null && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-brew-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  daysOff < 14 ? 'bg-amber-400' : daysOff <= 28 ? 'bg-green-500' : 'bg-brew-muted'
                }`}
                style={{ width: `${Math.min(100, (daysOff / 28) * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold flex-shrink-0 ${
              daysOff < 14 ? 'text-amber-500' : daysOff <= 28 ? 'text-green-600' : 'text-brew-muted'
            }`}>
              {daysOff}d{freezeDays > 0 && <span className="text-blue-400 align-super">*</span>} off roast
            </span>
          </div>
        )}

        {/* Active: subtle days count if roast date exists */}
        {status === 'brewing' && daysOff !== null && (
          <p className="text-xs text-brew-faint mt-2">{daysOff}d{freezeDays > 0 && <span className="text-blue-400 align-super">*</span>} off roast</p>
        )}
      </div>

      <div className="border-t border-brew-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star size={13} className="text-brew-faint" />
          {avg !== null ? (
            <><span className="text-sm font-semibold text-brew-text">{avg.toFixed(1)}</span>
            <span className="text-xs text-brew-faint">avg</span></>
          ) : (
            <span className="text-sm text-brew-faint">no score</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            className="p-1 -m-1 rounded transition-colors hover:bg-brew-border/50"
            onClick={onToggleFavorite}
          >
            <Star size={14} className={c.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-brew-faint'} />
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-brew-muted">
            {brews.length} {brews.length === 1 ? 'brew' : 'brews'}
          </span>
        </div>
      </div>
    </div>
  );
}

function RosterSection({
  label,
  dot,
  coffees,
  allBrews,
  navigate,
  updateCoffee,
}: {
  label: string;
  dot: string;
  coffees: CoffeeType[];
  allBrews: any[];
  navigate: (p: string) => void;
  updateCoffee: (id: string, c: Partial<CoffeeType>) => void;
}) {
  if (coffees.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-xs font-semibold uppercase tracking-widest text-brew-muted">{label}</span>
        <span className="text-xs text-brew-faint">({coffees.length})</span>
        <div className="flex-1 h-px bg-brew-border ml-1" />
      </div>
      {/* Horizontal scroll track — negative margin pulls cards to screen edge */}
      <div className="-mx-4 px-4 overflow-x-auto flex gap-3 pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {coffees.map((c) => (
          <div key={c.id} className="snap-start flex-shrink-0 w-72">
            <CoffeeListCard
              c={c}
              allBrews={allBrews}
              onNavigate={() => navigate(`/coffees/${c.id}`)}
              onToggleFavorite={(e) => { e.stopPropagation(); updateCoffee(c.id, { isFavorite: !c.isFavorite }); }}
            />
          </div>
        ))}
        {/* Spacer so last card doesn't sit flush against edge */}
        <div className="flex-shrink-0 w-4" />
      </div>
    </div>
  );
}

export default function Coffees() {
  const navigate = useNavigate();
  const { data, updateCoffee } = useApp();
  const [search, setSearch] = useState('');

  const searched = data.coffees.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.roaster.toLowerCase().includes(q) ||
      (c.coffeeName ?? '').toLowerCase().includes(q) ||
      c.countryOrigin.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q)
    );
  });

  const brewing = searched.filter((c) => getStatus(c) === 'brewing');
  const resting = searched.filter((c) => getStatus(c) === 'resting');
  const freezing = searched.filter((c) => getStatus(c) === 'freezing');
  const finished = searched.filter((c) => getStatus(c) === 'finished');
  const hasResults = brewing.length + resting.length + freezing.length + finished.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-4xl leading-tight">Library</h1>
          <p className="text-brew-muted text-sm mt-1">Your coffee collection.</p>
        </div>
        <button
          onClick={() => navigate('/coffees/new')}
          className="w-11 h-11 rounded-full bg-brew-primary text-brew-bg flex items-center justify-center hover:bg-brew-primary-light transition-colors shadow-md flex-shrink-0"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search */}
      {data.coffees.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-brew-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roaster, name, origin..."
            className="w-full bg-brew-card border border-brew-border rounded-xl pl-9 pr-4 py-3 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
          />
        </div>
      )}

      {/* Roster */}
      {data.coffees.length === 0 ? (
        <EmptyState
          icon={<Coffee size={40} />}
          title="No coffees yet"
          description="Add the coffee you're currently brewing to get started."
          action={<Button onClick={() => navigate('/coffees/new')}><Plus size={14} /> Add Coffee</Button>}
        />
      ) : !hasResults ? (
        <EmptyState icon={<Coffee size={32} />} title="No coffees match your search" />
      ) : (
        <div className="flex flex-col gap-8">
          <RosterSection
            label="Brewing Now"
            dot="bg-green-500"
            coffees={brewing}
            allBrews={data.brews}
            navigate={navigate}
            updateCoffee={updateCoffee}
          />
          <RosterSection
            label="Resting"
            dot="bg-amber-400"
            coffees={resting}
            allBrews={data.brews}
            navigate={navigate}
            updateCoffee={updateCoffee}
          />
          <RosterSection
            label="Freezing"
            dot="bg-blue-400"
            coffees={freezing}
            allBrews={data.brews}
            navigate={navigate}
            updateCoffee={updateCoffee}
          />
          <RosterSection
            label="Finished"
            dot="bg-brew-border"
            coffees={finished}
            allBrews={data.brews}
            navigate={navigate}
            updateCoffee={updateCoffee}
          />
        </div>
      )}
    </div>
  );
}
