import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Edit2, BookMarked, Zap, Copy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Button, Card, Badge, Input, Select, Toggle, EmptyState, SectionTitle, MicButton,
} from '../components/ui';
import { brewRatio, bloomRatio, espressoRatio, fToC, formatDate } from '../utils';
import type {
  SavedRecipe, BrewMethod, PourOverDetails, EspressoDetails,
  PourHeightSpeed, RecipeAccentuates, GrinderEntry,
} from '../types';

const BREW_METHODS: BrewMethod[] = ['Pour Over', 'Espresso', 'Immersion', 'AeroPress', 'Zuppa Longa'];
const HEIGHT_SPEED: PourHeightSpeed[] = ['Low', 'Medium', 'High'];
const POUR_SPEEDS: PourHeightSpeed[] = ['Low', 'Medium', 'High', 'Combination'];
const POUR_SPEED_MLS = ['1–3', '4–6', '6–8', '8–10', '10+', 'Combination'];
const POUR_STYLES = ['Circular', 'Center', 'Hybrid'] as const;
const ACCENTUATES: RecipeAccentuates[] = ['Sweetness', 'Acidity', 'Clarity', 'Juiciness', 'Texture', 'Body', 'Balance'];
const GRINDERS = ['Timemore Sculptor 078', 'Comandante C40', 'Niche Zero'];
const GRIND_SIZES = ['Fine Espresso', 'Coarse Espresso', 'Fine / Mokka', 'Medium Fine', 'Medium', 'Medium Coarse', 'Coarse'];
const BREWING_DEVICES = [
  'V60', 'Orea 01', 'Orea Z1', 'V60 Switch', 'Mugen Switch',
  'Cafec Flower', 'Kalita Wave', 'Origami Cone', 'Origami Flat',
  'Cafec Deep 27', 'Melodrip Column', 'Kono', 'April Brewer',
  'Hario Mugen', 'Hario Cloth', 'Torch Mountain', 'Orea V3',
  'OXO Rapid Brewer', 'Flair 58', 'French Press', 'Mokka Pot',
];
const FILTERS = [
  'Cafec T-90', 'T-92', 'Abaca', 'Deep 27', 'Sibarist Z1',
  'Orea Flat', 'Origami Wave', 'Kalita Wave', 'April Wave', 'Kono', 'Melodrip Column',
];
const FILTER_PRESELECT: Record<string, string> = {
  'Orea Z1': 'Sibarist Z1',
  'Melodrip Column': 'Melodrip Column',
  'Cafec Deep 27': 'Deep 27',
};
const DEVICE_SHAPE: Record<string, 'Cone' | 'Flat'> = {
  'V60': 'Cone', 'Orea 01': 'Flat', 'Orea Z1': 'Flat',
  'V60 Switch': 'Cone', 'Mugen Switch': 'Cone', 'Cafec Flower': 'Cone',
  'Kalita Wave': 'Flat', 'Origami Cone': 'Cone', 'Origami Flat': 'Flat',
  'Cafec Deep 27': 'Cone', 'Melodrip Column': 'Cone', 'Kono': 'Cone',
  'April Brewer': 'Flat', 'Hario Mugen': 'Cone', 'Hario Cloth': 'Cone',
  'Torch Mountain': 'Flat', 'Orea V3': 'Flat',
};
const DEVICE_BYPASS: Record<string, 'Standard' | 'Low Bypass' | 'No Bypass' | 'filter-dependent'> = {
  'V60': 'Standard', 'Orea 01': 'filter-dependent', 'Orea Z1': 'No Bypass',
  'V60 Switch': 'Standard', 'Mugen Switch': 'Low Bypass', 'Cafec Flower': 'Standard',
  'Kalita Wave': 'Standard', 'Origami Cone': 'Standard', 'Origami Flat': 'Standard',
  'Cafec Deep 27': 'Standard', 'Melodrip Column': 'No Bypass', 'Kono': 'Low Bypass',
  'April Brewer': 'Standard', 'Hario Mugen': 'Low Bypass', 'Hario Cloth': 'Standard',
  'Torch Mountain': 'Standard', 'Orea V3': 'filter-dependent',
};
function resolveBypass(device: string, filter: string): 'Standard' | 'Low Bypass' | 'No Bypass' | undefined {
  const val = DEVICE_BYPASS[device];
  if (!val) return undefined;
  if (val === 'filter-dependent') return filter === 'Orea Flat' ? 'Low Bypass' : 'Standard';
  return val;
}

const ACCENTUATE_COLORS: Record<RecipeAccentuates, string> = {
  Sweetness: '#b87d28',
  Acidity:   '#2d6e4e',
  Clarity:   '#4a7fa5',
  Juiciness: '#b8920a',
  Texture:   '#6b5040',
  Body:      '#5a3820',
  Balance:   '#7a5c8a',
};

const blankRecipe: Omit<SavedRecipe, 'id' | 'createdAt'> = {
  name: '',
  source: '',
  brewMethod: 'Pour Over',
  brewingDevice: '',
  filter: '',
  brewerShape: undefined,
  bypass: undefined,
  coffeeDose: 15,
  waterAmount: 240,
  waterTempF: 205,
  waterPPM: 0,
  waterRecipe: '',
  recipeDetails: '',
  accentuates: [],
  grindSize: '',
  grinderEntries: [],
  pourOverDetails: {
    totalPours: 4,
    bloomAmount: 30,
    doubleBloom: false,
    melodrip: false,
    pourHeight: 'Medium',
    pourSpeed: 'Medium',
    agitation: 'Medium',
    bloomTime: 0.5,
    totalBrewTime: 3,
  },
  espressoDetails: undefined,
};

// ── Recipe Form ───────────────────────────────────────────────────────────────

export function RecipeForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const { addRecipe, updateRecipe, getRecipe } = useApp();

  const existing = isEdit ? getRecipe(id!) : undefined;
  const [form, setForm] = useState<Omit<SavedRecipe, 'id' | 'createdAt'>>(
    existing
      ? {
          name: existing.name,
          source: existing.source,
          brewMethod: existing.brewMethod,
          brewingDevice: existing.brewingDevice,
          filter: existing.filter ?? '',
          brewerShape: existing.brewerShape,
          bypass: existing.bypass,
          coffeeDose: existing.coffeeDose,
          waterAmount: existing.waterAmount,
          waterTempF: existing.waterTempF,
          waterPPM: existing.waterPPM,
          waterRecipe: existing.waterRecipe,
          recipeDetails: existing.recipeDetails,
          accentuates: existing.accentuates ?? [],
          grindSize: existing.grindSize ?? '',
          grinderEntries: existing.grinderEntries ?? [],
          pourOverDetails: existing.pourOverDetails,
          espressoDetails: existing.espressoDetails,
        }
      : blankRecipe,
  );

  useEffect(() => {
    if (form.brewMethod === 'Pour Over') {
      setForm((f) => ({
        ...f,
        pourOverDetails: f.pourOverDetails ?? blankRecipe.pourOverDetails,
        espressoDetails: undefined,
      }));
    } else if (form.brewMethod === 'Espresso') {
      setForm((f) => ({
        ...f,
        espressoDetails: f.espressoDetails ?? { totalYield: 36, brewTime: 28, maxPressure: 9 },
        pourOverDetails: undefined,
      }));
    } else {
      setForm((f) => ({ ...f, pourOverDetails: undefined, espressoDetails: undefined }));
    }
  }, [form.brewMethod]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setPO<K extends keyof PourOverDetails>(k: K, v: PourOverDetails[K]) {
    setForm((f) => ({
      ...f,
      pourOverDetails: { ...(f.pourOverDetails ?? blankRecipe.pourOverDetails!), [k]: v },
    }));
  }

  function setESP<K extends keyof EspressoDetails>(k: K, v: EspressoDetails[K]) {
    setForm((f) => ({
      ...f,
      espressoDetails: { ...(f.espressoDetails ?? { totalYield: 36, brewTime: 28, maxPressure: 9 }), [k]: v },
    }));
  }

  function handleDeviceChange(device: string) {
    setForm((f) => {
      const newFilter = FILTER_PRESELECT[device] ?? f.filter ?? '';
      return {
        ...f,
        brewingDevice: device,
        ...(FILTER_PRESELECT[device] ? { filter: FILTER_PRESELECT[device] } : {}),
        ...(DEVICE_SHAPE[device] ? { brewerShape: DEVICE_SHAPE[device] } : {}),
        bypass: resolveBypass(device, newFilter) ?? f.bypass,
      };
    });
  }

  function handleFilterChange(filter: string) {
    setForm((f) => ({
      ...f,
      filter,
      bypass: resolveBypass(f.brewingDevice, filter) ?? f.bypass,
    }));
  }

  function addGrinderEntry() {
    setForm((f) => ({
      ...f,
      grinderEntries: [...(f.grinderEntries ?? []), { grinder: GRINDERS[0], settingRange: '' }],
    }));
  }

  function updateGrinderEntry(i: number, patch: Partial<GrinderEntry>) {
    setForm((f) => {
      const entries = [...(f.grinderEntries ?? [])];
      entries[i] = { ...entries[i], ...patch };
      return { ...f, grinderEntries: entries };
    });
  }

  function removeGrinderEntry(i: number) {
    setForm((f) => ({
      ...f,
      grinderEntries: (f.grinderEntries ?? []).filter((_, idx) => idx !== i),
    }));
  }

  function toggleAccentuate(a: RecipeAccentuates) {
    setForm((f) => {
      const current = f.accentuates ?? [];
      return {
        ...f,
        accentuates: current.includes(a) ? current.filter((x) => x !== a) : [...current, a],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    if (isEdit) {
      updateRecipe(id!, form);
      navigate(`/recipes/${id}`);
    } else {
      const r = addRecipe(form);
      navigate(`/recipes/${r.id}`);
    }
  }

  const accentuates = form.accentuates ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <h1 className="font-display italic text-brew-text text-2xl leading-tight">
          {isEdit ? 'Edit Recipe' : 'Add Recipe'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-6">

        {/* Identity */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Recipe Identity</SectionTitle>
          <Input
            label="Recipe Name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Scott Rao All-About, Hoffmann 4-6, My V60 Dialled In"
            required
          />
          <Input
            label="Source / Author"
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            placeholder="e.g. Scott Rao, James Hoffmann, Onyx Coffee Lab, My own"
          />
        </Card>

        {/* What this recipe accentuates */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Accentuates</SectionTitle>
          <p className="text-xs text-brew-faint -mt-2">
            Which flavor characteristics does this recipe bring out?
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCENTUATES.map((a) => {
              const active = accentuates.includes(a);
              const color = ACCENTUATE_COLORS[a];
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAccentuate(a)}
                  style={active ? { background: `${color}22`, borderColor: color, color } : {}}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                    active ? '' : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                  }`}
                >
                  {active ? '✓ ' : ''}{a}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Brew Setup */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Brew Setup</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Brew Method"
              value={form.brewMethod}
              onChange={(e) => set('brewMethod', e.target.value as BrewMethod)}
              options={BREW_METHODS.map((m) => ({ value: m, label: m }))}
            />
            <Select
              label="Brewing Device"
              value={form.brewingDevice}
              onChange={(e) => handleDeviceChange(e.target.value)}
              placeholder="— Select device —"
              options={BREWING_DEVICES.map((d) => ({ value: d, label: d }))}
            />
            <Select
              label="Filter"
              value={form.filter ?? ''}
              onChange={(e) => handleFilterChange(e.target.value)}
              placeholder="— Select filter —"
              options={FILTERS.map((f) => ({ value: f, label: f }))}
            />
          </div>

          {/* Brewer Shape + Bypass tags */}
          <div className="flex flex-col gap-3 pt-1 border-t border-brew-border">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Brewer Shape</label>
              <div className="flex gap-2">
                {(['Cone', 'Flat'] as const).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => set('brewerShape', form.brewerShape === shape ? undefined : shape)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      form.brewerShape === shape
                        ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                        : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Bypass</label>
              <div className="flex gap-2 flex-wrap">
                {(['Standard', 'Low Bypass', 'No Bypass'] as const).map((bp) => (
                  <button
                    key={bp}
                    type="button"
                    onClick={() => set('bypass', form.bypass === bp ? undefined : bp)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      form.bypass === bp
                        ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                        : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                    }`}
                  >
                    {bp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Grind Setup */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Grind Setup</SectionTitle>

          <Select
            label="Grind Size"
            value={form.grindSize ?? ''}
            onChange={(e) => set('grindSize', e.target.value)}
            placeholder="— Select grind size —"
            options={GRIND_SIZES.map((s) => ({ value: s, label: s }))}
          />

          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Grinder Settings</label>
            {(form.grinderEntries ?? []).length === 0 && (
              <p className="text-xs text-brew-faint">No grinders added yet. Add one below.</p>
            )}
            {(form.grinderEntries ?? []).map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <select
                    value={entry.grinder}
                    onChange={(e) => updateGrinderEntry(i, { grinder: e.target.value })}
                    className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary transition-colors appearance-none"
                  >
                    {GRINDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <input
                    type="text"
                    value={entry.settingRange}
                    onChange={(e) => updateGrinderEntry(i, { settingRange: e.target.value })}
                    placeholder="e.g. 18–23"
                    className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeGrinderEntry(i)}
                  className="p-2 text-brew-faint hover:text-brew-negative transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addGrinderEntry}
              className="flex items-center gap-1.5 text-xs text-brew-primary hover:text-brew-primary-light transition-colors self-start"
            >
              <Plus size={13} /> Add Grinder
            </button>
          </div>
        </Card>

        {/* Parameters */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Recipe Parameters</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Coffee Dose"
              type="number"
              min={0}
              step={0.1}
              value={form.coffeeDose || ''}
              onChange={(e) => set('coffeeDose', parseFloat(e.target.value) || 0)}
              suffix="g"
            />
            <Input
              label="Water Amount"
              type="number"
              min={0}
              step={1}
              value={form.waterAmount || ''}
              onChange={(e) => set('waterAmount', parseFloat(e.target.value) || 0)}
              suffix="g"
            />
          </div>
          {form.coffeeDose > 0 && form.waterAmount > 0 && (
            <p className="text-sm text-brew-muted">
              Brew Ratio: <span className="text-brew-primary font-semibold">{brewRatio(form.waterAmount, form.coffeeDose)}</span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Input
                label="Water Temperature"
                type="number"
                min={150}
                max={212}
                value={form.waterTempF || ''}
                onChange={(e) => set('waterTempF', parseFloat(e.target.value) || 0)}
                suffix="°F"
              />
              {form.waterTempF > 0 && (
                <span className="text-xs text-brew-faint">{fToC(form.waterTempF)}°C</span>
              )}
            </div>
            <Input
              label="Water PPM"
              type="number"
              min={0}
              value={form.waterPPM || ''}
              onChange={(e) => set('waterPPM', parseInt(e.target.value) || 0)}
              suffix="ppm"
              placeholder="e.g. 75"
            />
            <Input
              label="Water Recipe"
              value={form.waterRecipe}
              onChange={(e) => set('waterRecipe', e.target.value)}
              placeholder="e.g. Third Wave Water, Barista Hustle #4"
            />
          </div>

          {/* Recipe details with voice */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Recipe Details</label>
              <MicButton
                onResult={(t) =>
                  set('recipeDetails', form.recipeDetails ? `${form.recipeDetails}\n${t}` : t)
                }
              />
            </div>
            <textarea
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
              value={form.recipeDetails}
              onChange={(e) => set('recipeDetails', e.target.value)}
              rows={6}
              placeholder="Step-by-step instructions, timing, technique notes..."
            />
          </div>
        </Card>

        {/* Pour Over Details */}
        {form.brewMethod === 'Pour Over' && form.pourOverDetails && (
          <Card className="p-6 flex flex-col gap-4">
            <SectionTitle>Pour Over Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Total Pours"
                type="number"
                min={1}
                value={form.pourOverDetails.totalPours || ''}
                onChange={(e) => setPO('totalPours', parseInt(e.target.value) || 0)}
              />
              <div className="flex flex-col gap-1">
                <Input
                  label="Bloom Amount"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.pourOverDetails.bloomAmount || ''}
                  onChange={(e) => setPO('bloomAmount', parseFloat(e.target.value) || 0)}
                  suffix="g"
                />
                {form.pourOverDetails.bloomAmount > 0 && form.coffeeDose > 0 && (
                  <span className="text-xs text-brew-faint">
                    Ratio: {bloomRatio(form.pourOverDetails.bloomAmount, form.coffeeDose)}
                  </span>
                )}
              </div>
              <Input
                label="Bloom Time"
                type="number"
                min={0}
                step={0.25}
                value={form.pourOverDetails.bloomTime || ''}
                onChange={(e) => setPO('bloomTime', parseFloat(e.target.value) || 0)}
                suffix="min"
              />
              <Input
                label="Total Brew Time"
                type="number"
                min={0}
                step={0.25}
                value={form.pourOverDetails.totalBrewTime || ''}
                onChange={(e) => setPO('totalBrewTime', parseFloat(e.target.value) || 0)}
                suffix="min"
              />
              <Select
                label="Pour Height"
                value={form.pourOverDetails.pourHeight}
                onChange={(e) => setPO('pourHeight', e.target.value as PourHeightSpeed)}
                options={HEIGHT_SPEED.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Pour Speed"
                value={form.pourOverDetails.pourSpeed}
                onChange={(e) => setPO('pourSpeed', e.target.value as PourHeightSpeed)}
                options={POUR_SPEEDS.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Pour Style"
                value={form.pourOverDetails.pourStyle ?? ''}
                onChange={(e) => setPO('pourStyle', (e.target.value as 'Circular' | 'Center' | 'Hybrid') || undefined)}
                placeholder="— Select style —"
                options={POUR_STYLES.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Agitation"
                value={form.pourOverDetails.agitation}
                onChange={(e) => setPO('agitation', e.target.value as PourHeightSpeed)}
                options={HEIGHT_SPEED.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Pour Speed ml/s"
                value={form.pourOverDetails.pourSpeedMlS ?? ''}
                onChange={(e) => setPO('pourSpeedMlS', e.target.value || undefined)}
                placeholder="— Select range —"
                options={POUR_SPEED_MLS.map((s) => ({ value: s, label: s }))}
              />
            </div>

            {/* Combination min/max fields */}
            {form.pourOverDetails.pourSpeedMlS === 'Combination' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-brew-surface rounded-lg border border-brew-border">
                <Input
                  label="Min Pour Speed"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.pourOverDetails.pourSpeedMinMlS ?? ''}
                  onChange={(e) => setPO('pourSpeedMinMlS', parseFloat(e.target.value) || undefined)}
                  suffix="ml/s"
                  placeholder="e.g. 2"
                />
                <Input
                  label="Max Pour Speed"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.pourOverDetails.pourSpeedMaxMlS ?? ''}
                  onChange={(e) => setPO('pourSpeedMaxMlS', parseFloat(e.target.value) || undefined)}
                  suffix="ml/s"
                  placeholder="e.g. 8"
                />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-1">
              <Toggle
                label="Varying Pour Speed"
                checked={!!form.pourOverDetails.varyingPourSpeed}
                onChange={(v) => setPO('varyingPourSpeed', v)}
              />
              <Toggle
                label="Double Bloom"
                checked={form.pourOverDetails.doubleBloom}
                onChange={(v) => setPO('doubleBloom', v)}
                description="Second bloom before main pours"
              />
              <Toggle
                label="Melodrip"
                checked={form.pourOverDetails.melodrip}
                onChange={(v) => setPO('melodrip', v)}
                description="Used Melodrip flow restrictor"
              />
            </div>
          </Card>
        )}

        {/* Espresso Details */}
        {form.brewMethod === 'Espresso' && form.espressoDetails && (
          <Card className="p-6 flex flex-col gap-4">
            <SectionTitle>Espresso Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Input
                  label="Total Yield"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.espressoDetails.totalYield || ''}
                  onChange={(e) => setESP('totalYield', parseFloat(e.target.value) || 0)}
                  suffix="g"
                />
                {form.espressoDetails.totalYield > 0 && form.coffeeDose > 0 && (
                  <span className="text-xs text-brew-faint">
                    Ratio: {espressoRatio(form.espressoDetails.totalYield, form.coffeeDose)}
                  </span>
                )}
              </div>
              <Input
                label="Brew Time"
                type="number"
                min={0}
                step={1}
                value={form.espressoDetails.brewTime || ''}
                onChange={(e) => setESP('brewTime', parseInt(e.target.value) || 0)}
                suffix="sec"
              />
              <Input
                label="Max Pressure"
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={form.espressoDetails.maxPressure || ''}
                onChange={(e) => setESP('maxPressure', parseFloat(e.target.value) || 0)}
                suffix="bar"
              />
            </div>
          </Card>
        )}

        <div className="flex gap-3 pb-8">
          <Button type="submit" size="lg">
            {isEdit ? 'Save Changes' : 'Save Recipe'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Recipe Detail ─────────────────────────────────────────────────────────────

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecipe, deleteRecipe, addRecipe, data } = useApp();

  const recipe = getRecipe(id!);
  if (!recipe) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/recipes')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <p className="text-brew-muted mt-4">Recipe not found.</p>
      </div>
    );
  }

  const timesUsed = data.brews.filter((b) => b.brewRecipeName === recipe.name).length;

  function handleDelete() {
    if (confirm(`Delete "${recipe!.name}"? This cannot be undone.`)) {
      deleteRecipe(id!);
      navigate('/recipes');
    }
  }

  function handleDuplicate() {
    const { id: _id, createdAt: _ca, ...rest } = recipe!;
    const copy = addRecipe({ ...rest, name: `Copy of ${rest.name}` });
    navigate(`/recipes/${copy.id}/edit`);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/recipes')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleDuplicate}>
            <Copy size={14} /> Duplicate
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/recipes/${id}/edit`)}>
            <Edit2 size={14} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="amber">{recipe.brewMethod}</Badge>
          {recipe.brewingDevice && <Badge>{recipe.brewingDevice}</Badge>}
          {timesUsed > 0 && (
            <Badge variant="positive">{timesUsed} brew{timesUsed !== 1 ? 's' : ''} logged</Badge>
          )}
        </div>
        <h1 className="font-display italic text-brew-text text-4xl leading-tight">{recipe.name}</h1>
        {recipe.source && (
          <p className="text-brew-muted text-sm mt-1">by {recipe.source}</p>
        )}
        <p className="text-brew-faint text-xs mt-1">Saved {formatDate(recipe.createdAt)}</p>

        {/* Accentuates */}
        {recipe.accentuates && recipe.accentuates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.accentuates.map((a) => {
              const color = ACCENTUATE_COLORS[a] ?? '#6b5040';
              return (
                <span
                  key={a}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${color}22`, color }}
                >
                  {a}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply CTA */}
      <div className="flex">
        <Button onClick={() => navigate(`/brews/new?recipeId=${id}`)} size="lg">
          <Zap size={14} /> Apply to New Brew
        </Button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle>Parameters</SectionTitle>
          <dl className="flex flex-col gap-2">
            {[
              { label: 'Brewing Device', value: recipe.brewingDevice || '—' },
              { label: 'Filter', value: recipe.filter || '—' },
              { label: 'Brewer Shape', value: recipe.brewerShape || '—' },
              { label: 'Bypass', value: recipe.bypass || '—' },
              { label: 'Grind Size', value: recipe.grindSize || '—' },
              { label: 'Coffee Dose', value: `${recipe.coffeeDose}g` },
              { label: 'Water', value: `${recipe.waterAmount}g` },
              { label: 'Brew Ratio', value: brewRatio(recipe.waterAmount, recipe.coffeeDose) },
              { label: 'Water Temp', value: recipe.waterTempF ? `${recipe.waterTempF}°F / ${fToC(recipe.waterTempF)}°C` : '—' },
              { label: 'Water PPM', value: recipe.waterPPM ? `${recipe.waterPPM} ppm` : '—' },
              { label: 'Water Recipe', value: recipe.waterRecipe || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                <span className="text-brew-faint">{label}</span>
                <span className="text-brew-text font-medium">{value}</span>
              </div>
            ))}
          </dl>
        </Card>

        {recipe.grinderEntries && recipe.grinderEntries.length > 0 && (
          <Card className="p-5">
            <SectionTitle>Grinder Settings</SectionTitle>
            <dl className="flex flex-col gap-2">
              {recipe.grinderEntries.map((entry, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-brew-faint">{entry.grinder}</span>
                  <span className="text-brew-text font-medium">{entry.settingRange || '—'}</span>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {recipe.pourOverDetails && (
          <Card className="p-5">
            <SectionTitle>Pour Over Details</SectionTitle>
            <dl className="flex flex-col gap-2">
              {[
                { label: 'Total Pours', value: recipe.pourOverDetails.totalPours },
                { label: 'Bloom', value: `${recipe.pourOverDetails.bloomAmount}g (${bloomRatio(recipe.pourOverDetails.bloomAmount, recipe.coffeeDose)})` },
                { label: 'Bloom Time', value: `${recipe.pourOverDetails.bloomTime} min` },
                { label: 'Total Time', value: `${recipe.pourOverDetails.totalBrewTime} min` },
                { label: 'Pour Height', value: recipe.pourOverDetails.pourHeight },
                { label: 'Pour Speed', value: recipe.pourOverDetails.pourSpeed },
                { label: 'Pour Style', value: recipe.pourOverDetails.pourStyle || '—' },
                { label: 'Pour Speed ml/s', value: recipe.pourOverDetails.pourSpeedMlS
                    ? recipe.pourOverDetails.pourSpeedMlS === 'Combination' && (recipe.pourOverDetails.pourSpeedMinMlS || recipe.pourOverDetails.pourSpeedMaxMlS)
                      ? `${recipe.pourOverDetails.pourSpeedMinMlS ?? '?'}–${recipe.pourOverDetails.pourSpeedMaxMlS ?? '?'} ml/s`
                      : recipe.pourOverDetails.pourSpeedMlS
                    : '—' },
                { label: 'Varying Pour Speed', value: recipe.pourOverDetails.varyingPourSpeed ? 'Yes' : 'No' },
                { label: 'Agitation', value: recipe.pourOverDetails.agitation },
                { label: 'Double Bloom', value: recipe.pourOverDetails.doubleBloom ? 'Yes' : 'No' },
                { label: 'Melodrip', value: recipe.pourOverDetails.melodrip ? 'Yes' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-brew-faint">{label}</span>
                  <span className="text-brew-text font-medium">{value}</span>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {recipe.espressoDetails && (
          <Card className="p-5">
            <SectionTitle>Espresso Details</SectionTitle>
            <dl className="flex flex-col gap-2">
              {[
                { label: 'Total Yield', value: `${recipe.espressoDetails.totalYield}g` },
                { label: 'Ratio', value: espressoRatio(recipe.espressoDetails.totalYield, recipe.coffeeDose) },
                { label: 'Brew Time', value: `${recipe.espressoDetails.brewTime}s` },
                { label: 'Max Pressure', value: `${recipe.espressoDetails.maxPressure} bar` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-brew-faint">{label}</span>
                  <span className="text-brew-text font-medium">{value}</span>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>

      {recipe.recipeDetails && (
        <Card className="p-5">
          <SectionTitle>Recipe Steps & Notes</SectionTitle>
          <p className="text-brew-text text-sm whitespace-pre-wrap leading-relaxed">{recipe.recipeDetails}</p>
        </Card>
      )}
    </div>
  );
}

// ── Recipe List ───────────────────────────────────────────────────────────────

export default function Recipes() {
  const navigate = useNavigate();
  const { data } = useApp();
  const [filterMethod, setFilterMethod] = useState('');

  const filtered = data.recipes.filter(
    (r) => !filterMethod || r.brewMethod === filterMethod,
  );

  const methods = [...new Set(data.recipes.map((r) => r.brewMethod))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Saved Recipes</h1>
          <p className="text-brew-muted text-sm mt-1">
            {data.recipes.length} recipe{data.recipes.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button onClick={() => navigate('/recipes/new')}>
          <Plus size={14} /> Add Recipe
        </Button>
      </div>

      {methods.length > 1 && (
        <div className="flex gap-3">
          <Select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            options={methods.map((m) => ({ value: m, label: m }))}
            placeholder="All Methods"
            className="max-w-44"
          />
          {filterMethod && (
            <button type="button" onClick={() => setFilterMethod('')} className="text-xs text-brew-faint hover:text-brew-muted transition-colors">
              Clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && data.recipes.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={40} />}
          title="No saved recipes yet"
          description="Add recipes from coffee professionals, or save one directly from a brew you've logged."
          action={<Button onClick={() => navigate('/recipes/new')}><Plus size={14} /> Add Your First Recipe</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BookMarked size={32} />} title="No recipes match this filter" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const timesUsed = data.brews.filter((b) => b.brewRecipeName === r.name).length;
            const accentuates = r.accentuates ?? [];
            return (
              <Card key={r.id} className="p-5 flex flex-col gap-3" onClick={() => navigate(`/recipes/${r.id}`)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="amber">{r.brewMethod}</Badge>
                    {r.brewingDevice && <Badge>{r.brewingDevice}</Badge>}
                  </div>
                  {timesUsed > 0 && (
                    <span className="text-xs text-brew-positive font-medium flex-shrink-0">{timesUsed}× used</span>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-brew-text">{r.name}</div>
                  {r.source && <div className="text-brew-faint text-xs mt-0.5">by {r.source}</div>}
                </div>

                {accentuates.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {accentuates.map((a) => {
                      const color = ACCENTUATE_COLORS[a] ?? '#6b5040';
                      return (
                        <span key={a} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}1a`, color }}>
                          {a}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-brew-border">
                  <div>
                    <div className="text-xs text-brew-faint">Dose</div>
                    <div className="text-sm font-medium text-brew-text">{r.coffeeDose}g</div>
                  </div>
                  <div>
                    <div className="text-xs text-brew-faint">Ratio</div>
                    <div className="text-sm font-medium text-brew-text">{brewRatio(r.waterAmount, r.coffeeDose)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-brew-faint">Temp</div>
                    <div className="text-sm font-medium text-brew-text">{r.waterTempF ? `${r.waterTempF}°F` : '—'}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`/brews/new?recipeId=${r.id}`); }}
                  className="w-full text-center text-xs font-semibold uppercase tracking-wider text-brew-primary border border-brew-primary/30 rounded-lg py-2 hover:bg-brew-primary/5 transition-colors"
                >
                  Apply to Brew
                </button>
              </Card>
            );
          })}

          <Card
            className="p-5 flex flex-col items-center justify-center gap-2 border-dashed min-h-[180px]"
            onClick={() => navigate('/recipes/new')}
          >
            <Plus size={24} className="text-brew-faint" />
            <span className="text-sm text-brew-faint">Add Recipe</span>
          </Card>
        </div>
      )}
    </div>
  );
}
