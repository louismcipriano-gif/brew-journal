import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Edit2, Coffee, Camera, Loader2, Link } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Button, Card, Badge, Input, Select, EmptyState, ScoreRing, SectionTitle, Toggle, MicButton,
} from '../components/ui';
import {
  calcBrewScore, formatDate, daysOffRoast, pricePerGram, brewRatio,
} from '../utils';
import { scanCoffeeBag } from '../utils/scanBag';
import { fetchCoffeeFromUrl } from '../utils/fetchCoffeeUrl';
import { getApiKey } from './Settings';
import type { Coffee as CoffeeType, ProcessingMethod, RoastLevel } from '../types';
// ProcessingMethod used for the PROCESSING suggestions array only

const PROCESSING: ProcessingMethod[] = ['Washed', 'Natural', 'Honey', 'Anaerobic', 'Thermal Shock', 'Wet-Hulled', 'Other'];
const ROASTS: RoastLevel[] = ['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];

const blankCoffee: Omit<CoffeeType, 'id' | 'createdAt'> = {
  roaster: '',
  coffeeName: '',
  producer: '',
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
};

// ── Coffee Form ───────────────────────────────────────────────────────────────

export function CoffeeForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const { addCoffee, updateCoffee, getCoffee } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        }
      : blankCoffee,
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

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
          const validRoasts: RoastLevel[] = ['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];
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
    // reset so same file can be selected again
    e.target.value = '';
  }

  async function handleUrlImport() {
    if (!urlInput.trim()) return;
    setScanError('');
    setFetchingUrl(true);
    try {
      const apiKey = getApiKey() || undefined;
      const result = await fetchCoffeeFromUrl(urlInput.trim(), apiKey);
      const validRoasts: RoastLevel[] = ['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark'];
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
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleScanBag}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { setScanError(''); fileInputRef.current?.click(); }}
                disabled={scanning}
              >
                {scanning ? <><Loader2 size={13} className="animate-spin" /> Scanning…</> : <><Camera size={13} /> Scan Bag</>}
              </Button>
              <span className="text-xs text-brew-faint">Photo auto-fills fields</span>
            </div>
          </div>
          {/* URL Import */}
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
            <Input label="Producer / Farm" value={form.producer ?? ''} onChange={(e) => set('producer', e.target.value)} placeholder="e.g. La Capilla, El Vergel" />
            <Input label="Country of Origin *" value={form.countryOrigin} onChange={(e) => set('countryOrigin', e.target.value)} placeholder="e.g. Ethiopia" required />
            <Input label="Region" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. Yirgacheffe" />
            <Input label="Varietal" value={form.varietal} onChange={(e) => set('varietal', e.target.value)} placeholder="e.g. Heirloom" />
            <Input label="Elevation" value={form.elevation} onChange={(e) => set('elevation', e.target.value)} placeholder="e.g. 1800–2200 masl" />
            {/* Processing Method — datalist allows free text + predefined suggestions */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Processing Method</label>
              <input
                list="processing-datalist"
                value={form.processingMethod}
                onChange={(e) => set('processingMethod', e.target.value)}
                placeholder="Select or type…"
                className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
              />
              <datalist id="processing-datalist">
                {PROCESSING.map((p) => <option key={p} value={p} />)}
              </datalist>
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

        {/* Pricing */}
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
          <p className="text-xs text-brew-faint">Your overall rating for this coffee (optional — separate from individual brew scores)</p>
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
  const { getCoffee, getBrewsForCoffee, deleteCoffee } = useApp();

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

  function handleDelete() {
    if (confirm(`Delete "${coffee!.roaster}" and all its brews? This cannot be undone.`)) {
      deleteCoffee(id!);
      navigate('/coffees');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/coffees')}>
            <ArrowLeft size={14} /> Back
          </Button>
        </div>
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
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Badge variant="amber">{coffee.processingMethod}</Badge>
            <Badge>{coffee.roastLevel}</Badge>
            {coffee.score !== null && (
              <Badge variant="gold">★ {coffee.score}/10</Badge>
            )}
          </div>
          <h1 className="font-display italic text-brew-text text-4xl leading-tight mt-2">{coffee.roaster}</h1>
          {coffee.coffeeName && (
            <p className="text-brew-primary-light font-semibold text-xl mt-0.5">{coffee.coffeeName}</p>
          )}
          <p className="text-brew-muted text-lg mt-1">
            {coffee.countryOrigin}{coffee.region ? ` · ${coffee.region}` : ''}
          </p>
          {coffee.producer && (
            <p className="text-brew-faint text-sm mt-0.5">Producer: {coffee.producer}</p>
          )}
          {coffee.varietal && (
            <p className="text-brew-faint text-sm mt-1">{coffee.varietal} {coffee.elevation ? `· ${coffee.elevation}` : ''}</p>
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

export default function Coffees() {
  const navigate = useNavigate();
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const [filterProcess, setFilterProcess] = useState('');

  const filtered = data.coffees.filter((c) => {
    const matchSearch =
      !search ||
      c.roaster.toLowerCase().includes(search.toLowerCase()) ||
      c.countryOrigin.toLowerCase().includes(search.toLowerCase()) ||
      c.region.toLowerCase().includes(search.toLowerCase());
    const matchProcess = !filterProcess || c.processingMethod === filterProcess;
    return matchSearch && matchProcess;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Coffees</h1>
          <p className="text-brew-muted text-sm mt-1">{data.coffees.length} coffee{data.coffees.length !== 1 ? 's' : ''} in your collection</p>
        </div>
        <Button onClick={() => navigate('/coffees/new')}>
          <Plus size={14} /> Add Coffee
        </Button>
      </div>

      {/* Filters */}
      {data.coffees.length > 0 && (
        <div className="flex gap-3">
          <Input
            placeholder="Search roaster, origin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={filterProcess}
            onChange={(e) => setFilterProcess(e.target.value)}
            options={PROCESSING.map((p) => ({ value: p, label: p }))}
            placeholder="All Processing"
            className="max-w-xs"
          />
        </div>
      )}

      {filtered.length === 0 && data.coffees.length === 0 ? (
        <EmptyState
          icon={<Coffee size={40} />}
          title="No coffees yet"
          description="Add the coffee you're currently brewing to get started."
          action={<Button onClick={() => navigate('/coffees/new')}><Plus size={14} /> Add Coffee</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Coffee size={32} />} title="No coffees match your filters" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const brews = data.brews.filter((b) => b.coffeeId === c.id);
            const scores = brews.map((b) => calcBrewScore(b.flavorProfile));
            const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            brews.sort((a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime());

            return (
              <Card
                key={c.id}
                className="p-5 flex flex-col gap-3"
                onClick={() => navigate(`/coffees/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="amber">{c.processingMethod}</Badge>
                    <Badge>{c.roastLevel}</Badge>
                  </div>
                  {avg !== null && <ScoreRing score={avg} size={40} />}
                </div>
                <div>
                  <div className="font-bold text-brew-text">{c.roaster}</div>
                  {c.coffeeName && (
                    <div className="text-brew-primary-light text-sm font-medium">{c.coffeeName}</div>
                  )}
                  <div className="text-brew-muted text-sm">
                    {c.countryOrigin}{c.region ? `, ${c.region}` : ''}
                  </div>
                  {c.varietal && <div className="text-brew-faint text-xs mt-0.5">{c.varietal}</div>}
                </div>
                {c.tastingNotes && (
                  <p className="text-xs text-brew-faint italic line-clamp-2">"{c.tastingNotes}"</p>
                )}
                <div className="flex items-center justify-between text-xs text-brew-faint border-t border-brew-border pt-2 mt-1">
                  <span>{brews.length} brew{brews.length !== 1 ? 's' : ''}</span>
                  <span>
                    {c.roastDate ? `Roasted ${formatDate(c.roastDate)}` : 'No roast date'}
                  </span>
                </div>
              </Card>
            );
          })}
          <Card
            className="p-5 flex flex-col items-center justify-center gap-2 border-dashed min-h-[160px]"
            onClick={() => navigate('/coffees/new')}
          >
            <Plus size={24} className="text-brew-faint" />
            <span className="text-sm text-brew-faint">Add Coffee</span>
          </Card>
        </div>
      )}
    </div>
  );
}
