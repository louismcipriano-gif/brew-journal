import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Sparkles, Loader2, Trophy,
  ToggleLeft, ToggleRight, GitCompare, FlaskConical, Mic, MicOff,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Card, SectionTitle, ScoreRing, Button, Slider, Chip } from '../components/ui';
import { calcBrewScore, daysOffRoast, formatDate, brewRatio, fToC } from '../utils';
import type {
  Brew, FlavorProfile, PerceivedExtraction, BrewMethod,
  PourOverDetails, EspressoDetails, PourHeightSpeed, SavedRecipe,
} from '../types';
import { getApiKey } from './Settings';
import { parseVoiceWithClaude } from '../utils/parseVoiceWithClaude';
import type { VoiceBrewFields } from '../utils/parseVoiceWithClaude';
import { addLearningToStorage, CategoryBadge, LEARNING_CATEGORIES } from './Learnings';
import type { LearningCategory } from '../types';

// ── Constants (mirrors BrewForm) ───────────────────────────────────────────────

const BREW_METHODS: BrewMethod[] = ['Pour Over', 'Espresso', 'Immersion', 'AeroPress', 'Zuppa Longa', 'Hybrid Immersion & Filter'];
const HEIGHT_SPEED: PourHeightSpeed[] = ['Low', 'Medium', 'High'];
const POUR_SPEEDS: PourHeightSpeed[] = ['Low', 'Medium', 'High', 'Combination'];
const POUR_SPEED_MLS = ['1–3', '4–6', '6–8', '8–10', '10+', 'Combination'];
const POUR_STYLES = ['Circular', 'Center', 'Hybrid'] as const;
const GRINDERS = ['Timemore Sculptor 078', 'Comandante C40', 'Niche Zero', 'A4Z'];
const GRIND_SIZES = ['Fine Espresso', 'Coarse Espresso', 'Fine / Mokka', 'Medium Fine', 'Medium', 'Medium Coarse', 'Coarse'];
const BREWING_DEVICES = [
  'V60', 'Orea 01', 'Orea Z1', 'V60 Switch', 'Mugen Switch',
  'Cafec Flower', 'Kalita Wave', 'Origami Cone', 'Origami Flat',
  'Cafec Deep 27', 'Melodrip Column', 'Kono', 'April Brewer',
  'Hario Mugen', 'Hario Cloth', 'Torch Mountain', 'Orea V3',
  'OXO Rapid Brewer', 'Flair 58', 'French Press', 'Mokka Pot', 'AeroPress',
  'Gabi Master A',
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
  'Gabi Master A': 'Flat',
};
const DEVICE_BYPASS: Record<string, 'Standard' | 'Low Bypass' | 'No Bypass' | 'filter-dependent'> = {
  'V60': 'Standard', 'Orea 01': 'filter-dependent', 'Orea Z1': 'No Bypass',
  'V60 Switch': 'Standard', 'Mugen Switch': 'Low Bypass', 'Cafec Flower': 'Standard',
  'Kalita Wave': 'Standard', 'Origami Cone': 'Standard', 'Origami Flat': 'Standard',
  'Cafec Deep 27': 'Standard', 'Melodrip Column': 'No Bypass', 'Kono': 'Low Bypass',
  'April Brewer': 'Standard', 'Hario Mugen': 'Low Bypass', 'Hario Cloth': 'Standard',
  'Torch Mountain': 'Standard', 'Orea V3': 'filter-dependent',
  'Gabi Master A': 'Standard',
};
const GRIND_SIZE_RANGES: Record<string, { max: number; size: string }[]> = {
  'Timemore Sculptor 078': [
    { max: 1.9, size: 'Coarse Espresso' }, { max: 3.5, size: 'Fine / Mokka' },
    { max: 7.5, size: 'Medium Fine' }, { max: 9.5, size: 'Medium' },
    { max: 12.5, size: 'Medium Coarse' }, { max: Infinity, size: 'Coarse' },
  ],
  'Comandante C40': [
    { max: 7, size: 'Coarse Espresso' }, { max: 16, size: 'Fine / Mokka' },
    { max: 22, size: 'Medium Fine' }, { max: 25, size: 'Medium' },
    { max: 28, size: 'Medium Coarse' }, { max: Infinity, size: 'Coarse' },
  ],
  'A4Z': [
    { max: 119,      size: 'Fine / Mokka'  },
    { max: 145,      size: 'Medium Fine'   },
    { max: 160,      size: 'Medium'        },
    { max: 180,      size: 'Medium Coarse' },
    { max: Infinity, size: 'Coarse'        },
  ],
};

function resolveGrindSize(grinder: string, setting: number): string | undefined {
  if (!setting || setting <= 0) return undefined;
  const ranges = GRIND_SIZE_RANGES[grinder];
  if (!ranges) return undefined;
  return ranges.find((r) => setting <= r.max)?.size;
}
function resolveBypass(device: string, filter: string): 'Standard' | 'Low Bypass' | 'No Bypass' | undefined {
  const val = DEVICE_BYPASS[device];
  if (!val) return undefined;
  if (val === 'filter-dependent') return filter === 'Orea Flat' ? 'Low Bypass' : 'Standard';
  return val;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SLOT_COLORS = ['#5a3820', '#2d6e4e', '#b8920a', '#9b3328'];

const COMPARE_INTENT_CHIPS = [
  'Grind size impact',
  'Temperature effect',
  'Filter comparison',
  'Water recipe test',
  'Bloom amount / timing',
  'Pour technique',
  'Agitation level',
  'Brew ratio',
  'Different coffees',
  'Same coffee, different devices',
];
const SLOT_LABELS = ['Brew A', 'Brew B', 'Brew C', 'Brew D'];
const MAX_SLOTS = 4;

const FLAVOR_DIMS = [
  { key: 'acidity',   label: 'Acidity'   },
  { key: 'sweetness', label: 'Sweetness' },
  { key: 'body',      label: 'Body'      },
  { key: 'florality', label: 'Florality' },
  { key: 'clarity',   label: 'Clarity'   },
  { key: 'juiciness', label: 'Juiciness' },
  { key: 'finish',         label: 'Finish'          },
  { key: 'flavorsPopping', label: 'Flavors Popping' },
  { key: 'texture', label: 'Texture' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'chocolateCaramel', label: 'Choc/Caramel' },
] as const;

const NEG_DIMS = ['astringency', 'sourness', 'funkiness', 'vegetal', 'harsh', 'thinness', 'muddled'] as const;

const defaultFP = (): FlavorProfile => ({
  acidity: 3, sweetness: 3, body: 3, florality: 3,
  clarity: 3, juiciness: 3, finish: 3,
  astringency: 1, sourness: 1, funkiness: 1, vegetal: 1, harsh: 1, thinness: 1, muddled: 1,
  texture: 3, fruit: 3, chocolateCaramel: 3,
  flavorNotes: '', perceivedExtraction: 'Balanced',
  moreAcidity: false, moreSweetness: false, moreClarity: false,
  moreFlorality: false, moreBody: false, moreIntensity: false, flavorsPopping: 3,
  lessBitterness: false, lessAstringency: false, lessSourness: false,
  lessMuddled: false, lessIntensity: false, suggestedChange: '',
});

const defaultPourOver = (): PourOverDetails => ({
  totalPours: 4, bloomAmount: 0, doubleBloom: false, melodrip: false,
  pourHeight: 'Medium', pourSpeed: 'Medium', pourStyle: 'Circular',
  agitation: 'Low', bloomTime: 0.5, totalBrewTime: 3, pourSpeedMlS: '',
  pourSpeedMaxMlS: undefined, pourSpeedMinMlS: undefined, varyingPourSpeed: false,
});

const defaultEspresso = (): EspressoDetails => ({
  totalYield: 36, brewTime: 28, maxPressure: 9,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface SideBySideSlot {
  // identity
  coffeeId: string;
  brewDate: string;
  brewMethod: BrewMethod;
  // setup
  brewingDevice: string;
  filter: string;
  brewerShape?: 'Cone' | 'Flat';
  bypass?: 'Standard' | 'Low Bypass' | 'No Bypass';
  grinder: string;
  grindSetting: number;
  grindSize: string;
  rpmSpeed?: number;
  // parameters
  coffeeDose: number;
  waterAmount: number;
  waterTempF: number;
  waterPPM: number;
  waterRecipe: string;
  // details
  pourOverDetails: PourOverDetails;
  espressoDetails: EspressoDetails;
  finalBrewWeight?: number;
  tds?: number;
  isDiluted: boolean;
  dilutionAmount?: number;
  // recipe
  brewRecipeName: string;
  brewRecipeDetails: string;
  isGoToRecipe: boolean;
  // flavor
  flavorProfile: FlavorProfile;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function bestIdx(vals: number[], lowerBetter = false): number {
  if (vals.every(v => v === vals[0])) return -1;
  let best = vals[0]; let idx = 0;
  for (let i = 1; i < vals.length; i++) {
    if (lowerBetter ? vals[i] < best : vals[i] > best) { best = vals[i]; idx = i; }
  }
  return idx;
}

function worstIdx(vals: number[], lowerBetter = false): number {
  if (vals.every(v => v === vals[0])) return -1;
  return bestIdx(vals, !lowerBetter);
}

function numDelta(a: number, b: number): string {
  const d = b - a;
  if (d === 0) return '';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d % 1 === 0 ? d : d.toFixed(1)}`;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-medium text-brew-muted uppercase tracking-wider">{children}</label>;
}

function SlotInput({
  label, type = 'number', value, onChange, step, placeholder, options, textarea,
}: {
  label: string; type?: string; value: any; onChange: (v: any) => void;
  step?: number; placeholder?: string; options?: string[]; textarea?: boolean;
}) {
  const base = 'w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text focus:outline-none focus:border-brew-primary';
  if (options) return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${base} appearance-none`}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (textarea) return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder}
        className={`${base} resize-none text-xs placeholder-brew-faint`} />
    </div>
  );
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input type={type} step={step} value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`${base} placeholder-brew-faint`} />
    </div>
  );
}

function SegmentPicker({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`px-2 py-0.5 rounded text-xs border transition-all ${
              value === o ? 'bg-brew-primary/20 border-brew-primary text-brew-primary-light font-medium'
                : 'border-brew-border text-brew-faint hover:border-brew-muted'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-all ${
        value ? 'bg-brew-primary/20 border-brew-primary text-brew-primary-light' : 'border-brew-border text-brew-faint hover:border-brew-muted'}`}>
      <span className={`w-2 h-2 rounded-full ${value ? 'bg-brew-primary' : 'bg-brew-border'}`} />
      {label}
    </button>
  );
}

// ── Comparison Row ─────────────────────────────────────────────────────────────

function CompareRow({
  label, values, numeric = false, lowerBetter = false, unit = '',
}: {
  label: string;
  values: (string | number | undefined)[];
  numeric?: boolean;
  lowerBetter?: boolean;
  unit?: string;
}) {
  const defined = values.filter((v) => v !== undefined && v !== '' && v !== 0);
  const allSame = defined.length > 0 && defined.every((v) => v === defined[0]);
  if (allSame && values.length === 2) return null;

  const nums = numeric ? values.map((v) => Number(v) || 0) : [];
  const best = numeric ? bestIdx(nums, lowerBetter) : -1;
  const worst = numeric ? worstIdx(nums, lowerBetter) : -1;

  return (
    <div className="grid items-center py-2 border-b border-brew-border/40 last:border-0"
      style={{ gridTemplateColumns: `140px repeat(${values.length}, 1fr) 60px` }}>
      <span className="text-xs text-brew-faint pr-2">{label}</span>
      {values.map((v, i) => {
        const isEmpty = v === undefined || v === '' || v === 0;
        const allStrSame = !numeric && values.every(x => x === v);
        const color = isEmpty ? 'text-brew-border'
          : numeric && i === best ? 'text-brew-positive font-semibold'
          : numeric && i === worst && worst !== best ? 'text-brew-muted'
          : allStrSame ? 'text-brew-muted'
          : !numeric && !allStrSame ? 'text-brew-text font-medium'
          : 'text-brew-text';
        return (
          <span key={i} className={`text-sm text-center px-1 ${color}`}>
            {isEmpty ? '—' : `${v}${unit}`}
          </span>
        );
      })}
      <span className="text-xs text-right text-brew-faint">
        {numeric && values.length === 2 && nums[0] !== nums[1]
          ? <span className={nums[1] > nums[0] !== lowerBetter ? 'text-brew-positive' : 'text-brew-muted'}>
              {numDelta(nums[0], nums[1])}{unit}
            </span>
          : values.length > 2 && numeric && !allSame
          ? <span className="text-brew-faint text-[10px]">↕{Math.abs(Math.max(...nums) - Math.min(...nums)).toFixed(nums.some(n => n % 1 !== 0) ? 1 : 0)}{unit}</span>
          : null}
      </span>
    </div>
  );
}

// ── Rank Bar ───────────────────────────────────────────────────────────────────

function RankBar({ brews }: { brews: { label: string; score: number; color: string }[] }) {
  const sorted = [...brews].sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {sorted.map((b, i) => (
        <div key={b.label} className="flex items-center gap-1.5">
          <span className="text-base">{medals[i]}</span>
          <span className="text-sm font-semibold" style={{ color: b.color }}>{b.label}</span>
          <ScoreRing score={b.score} size={32} />
        </div>
      ))}
    </div>
  );
}

// ── Slot Form ──────────────────────────────────────────────────────────────────

function applyRecipeToSlot(r: SavedRecipe): Partial<SideBySideSlot> {
  return {
    brewMethod: r.brewMethod,
    brewingDevice: r.brewingDevice,
    filter: r.filter ?? '',
    brewerShape: r.brewerShape,
    bypass: r.bypass,
    grindSize: r.grindSize ?? '',
    coffeeDose: r.coffeeDose,
    waterAmount: r.waterAmount,
    waterTempF: r.waterTempF,
    waterPPM: r.waterPPM,
    waterRecipe: r.waterRecipe,
    brewRecipeName: r.name,
    brewRecipeDetails: r.recipeDetails,
    pourOverDetails: r.pourOverDetails ?? defaultPourOver(),
    espressoDetails: r.espressoDetails ?? defaultEspresso(),
  };
}

function SlotForm({
  slot, slotIdx, slotCount, coffees, waterRecipes, savedRecipes,
  onUpdate, onUpdateFP, onUpdatePO, onUpdateEsp, onRemove, onCopyFromA,
}: {
  slot: SideBySideSlot;
  slotIdx: number;
  slotCount: number;
  coffees: any[];
  waterRecipes: any[];
  savedRecipes: SavedRecipe[];
  onUpdate: (patch: Partial<SideBySideSlot>) => void;
  onUpdateFP: (k: keyof FlavorProfile, v: any) => void;
  onUpdatePO: (k: keyof PourOverDetails, v: any) => void;
  onUpdateEsp: (k: keyof EspressoDetails, v: any) => void;
  onRemove: () => void;
  onCopyFromA: () => void;
}) {
  const isPourOver = slot.brewMethod === 'Pour Over' || slot.brewMethod === 'Immersion' || slot.brewMethod === 'Hybrid Immersion & Filter';
  const isEspresso = slot.brewMethod === 'Espresso';

  // ── Voice fill ───────────────────────────────────────────────────────────────
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceParsing, setVoiceParsing] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const voiceRecRef = useRef<any>(null);
  const voiceTranscriptRef = useRef('');

  function findRecipeByName(spoken: string): SavedRecipe | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const n = norm(spoken);
    return savedRecipes.find(r => norm(r.name) === n)
      ?? savedRecipes.find(r => norm(r.name).includes(n) || n.includes(norm(r.name)))
      ?? savedRecipes.find(r => {
        const rw = norm(r.name).split(/\s+/);
        const sw = n.split(/\s+/);
        const overlap = rw.filter(w => sw.includes(w)).length;
        return overlap / Math.max(rw.length, sw.length) >= 0.5;
      });
  }

  function applyVoiceFields(v: VoiceBrewFields) {
    // ── Brew setup ──────────────────────────────────────────────────────────
    const setupPatch: Partial<SideBySideSlot> = {};
    if (v.brewMethod) setupPatch.brewMethod = v.brewMethod as BrewMethod;
    if (v.brewingDevice) {
      const dev = v.brewingDevice;
      const resolvedFilter = v.filter ?? FILTER_PRESELECT[dev] ?? slot.filter ?? '';
      setupPatch.brewingDevice = dev;
      if (v.filter) setupPatch.filter = v.filter;
      else if (FILTER_PRESELECT[dev]) setupPatch.filter = FILTER_PRESELECT[dev];
      if (!v.brewerShape && DEVICE_SHAPE[dev]) setupPatch.brewerShape = DEVICE_SHAPE[dev];
      if (!v.bypass) setupPatch.bypass = resolveBypass(dev, resolvedFilter) ?? slot.bypass;
    } else if (v.filter) {
      setupPatch.filter = v.filter;
      if (!v.bypass) setupPatch.bypass = resolveBypass(slot.brewingDevice, v.filter) ?? slot.bypass;
    }
    if (v.brewerShape) setupPatch.brewerShape = v.brewerShape as any;
    if (v.bypass) setupPatch.bypass = v.bypass as any;
    if (v.grinder) setupPatch.grinder = v.grinder;
    if (v.grindSetting != null) setupPatch.grindSetting = v.grindSetting;
    if (v.grindSize) {
      setupPatch.grindSize = v.grindSize;
    } else if (v.grinder || v.grindSetting != null) {
      const resolved = resolveGrindSize(
        v.grinder ?? slot.grinder,
        v.grindSetting ?? slot.grindSetting,
      );
      if (resolved) setupPatch.grindSize = resolved;
    }
    if (v.coffeeDose) setupPatch.coffeeDose = v.coffeeDose;
    if (v.waterAmount) setupPatch.waterAmount = v.waterAmount;
    if (v.waterTempF) setupPatch.waterTempF = v.waterTempF;
    if (v.waterPPM != null) setupPatch.waterPPM = v.waterPPM;
    if (v.brewRecipeName) setupPatch.brewRecipeName = v.brewRecipeName;
    if (v.brewRecipeDetails) setupPatch.brewRecipeDetails = v.brewRecipeDetails;
    if (v.finalBrewWeight) setupPatch.finalBrewWeight = v.finalBrewWeight;
    if (v.tds) setupPatch.tds = v.tds;
    if (Object.keys(setupPatch).length) onUpdate(setupPatch);

    // ── Pour over ───────────────────────────────────────────────────────────
    const hasPO = v.pourStyle || v.melodrip != null || v.doubleBloom != null
      || v.varyingPourSpeed != null || v.totalPours || v.bloomAmount
      || v.bloomTime || v.totalBrewTime || v.pourHeight || v.pourSpeed
      || v.agitation || v.pourSpeedMlS;
    if (hasPO) {
      if (v.pourStyle)               onUpdatePO('pourStyle', v.pourStyle);
      if (v.pourHeight)              onUpdatePO('pourHeight', v.pourHeight);
      if (v.pourSpeed)               onUpdatePO('pourSpeed', v.pourSpeed);
      if (v.agitation)               onUpdatePO('agitation', v.agitation);
      if (v.pourSpeedMlS)            onUpdatePO('pourSpeedMlS', v.pourSpeedMlS);
      if (v.pourSpeedMinMlS)         onUpdatePO('pourSpeedMinMlS', v.pourSpeedMinMlS);
      if (v.pourSpeedMaxMlS)         onUpdatePO('pourSpeedMaxMlS', v.pourSpeedMaxMlS);
      if (v.melodrip != null)        onUpdatePO('melodrip', v.melodrip);
      if (v.doubleBloom != null)     onUpdatePO('doubleBloom', v.doubleBloom);
      if (v.varyingPourSpeed != null) onUpdatePO('varyingPourSpeed', v.varyingPourSpeed);
      if (v.totalPours)              onUpdatePO('totalPours', v.totalPours);
      if (v.bloomAmount)             onUpdatePO('bloomAmount', v.bloomAmount);
      if (v.bloomTime)               onUpdatePO('bloomTime', v.bloomTime);
      if (v.totalBrewTime)           onUpdatePO('totalBrewTime', v.totalBrewTime);
    }

    // ── Espresso ────────────────────────────────────────────────────────────
    if (v.espressoYield)      onUpdateEsp('totalYield', v.espressoYield);
    if (v.espressoBrewTime)   onUpdateEsp('brewTime', v.espressoBrewTime);
    if (v.espressoMaxPressure) onUpdateEsp('maxPressure', v.espressoMaxPressure);

    // ── Flavor ──────────────────────────────────────────────────────────────
    const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
    if (v.acidity     != null) onUpdateFP('acidity',     clamp(v.acidity));
    if (v.sweetness   != null) onUpdateFP('sweetness',   clamp(v.sweetness));
    if (v.body        != null) onUpdateFP('body',         clamp(v.body));
    if (v.florality   != null) onUpdateFP('florality',   clamp(v.florality));
    if (v.clarity     != null) onUpdateFP('clarity',     clamp(v.clarity));
    if (v.juiciness   != null) onUpdateFP('juiciness',   clamp(v.juiciness));
    if (v.finish      != null) onUpdateFP('finish',       clamp(v.finish));
    if (v.astringency != null) onUpdateFP('astringency', clamp(v.astringency));
    if (v.sourness    != null) onUpdateFP('sourness',    clamp(v.sourness));
    if (v.flavorNotes)         onUpdateFP('flavorNotes', v.flavorNotes);
    if (v.perceivedExtraction) onUpdateFP('perceivedExtraction', v.perceivedExtraction);
    if (v.suggestedChange)     onUpdateFP('suggestedChange', v.suggestedChange);
    if (v.moreAcidity    != null) onUpdateFP('moreAcidity',    v.moreAcidity);
    if (v.moreSweetness  != null) onUpdateFP('moreSweetness',  v.moreSweetness);
    if (v.moreClarity    != null) onUpdateFP('moreClarity',    v.moreClarity);
    if (v.moreFlorality  != null) onUpdateFP('moreFlorality',  v.moreFlorality);
    if (v.moreBody       != null) onUpdateFP('moreBody',       v.moreBody);
    if ((v as any).moreIntensity != null) onUpdateFP('moreIntensity', (v as any).moreIntensity);
    if (v.lessBitterness != null) onUpdateFP('lessBitterness', v.lessBitterness);
    if (v.lessAstringency!= null) onUpdateFP('lessAstringency', v.lessAstringency);
    if (v.lessSourness   != null) onUpdateFP('lessSourness',   v.lessSourness);
    if ((v as any).lessMuddled   != null) onUpdateFP('lessMuddled',   (v as any).lessMuddled);
    if ((v as any).lessIntensity != null) onUpdateFP('lessIntensity', (v as any).lessIntensity);
  }

  async function handleVoiceFill() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition not supported in this browser.\nUse Chrome on desktop or iOS Safari.');
      return;
    }
    if (voiceListening) { voiceRecRef.current?.stop?.(); return; }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    voiceTranscriptRef.current = '';

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) voiceTranscriptRef.current += t + ' ';
        else interim = t;
      }
      setVoiceInterim(voiceTranscriptRef.current + interim);
    };

    rec.onend = async () => {
      setVoiceListening(false);
      setVoiceInterim('');
      const transcript = voiceTranscriptRef.current.trim();
      if (!transcript) return;
      setVoiceParsing(true);
      try {
        const recipeNames = savedRecipes.map((r) => r.name);
        const fields = await parseVoiceWithClaude(transcript, getApiKey() ?? undefined, recipeNames);
        if (fields.brewRecipeName) {
          const matched = findRecipeByName(fields.brewRecipeName);
          if (matched) onUpdate(applyRecipeToSlot(matched));
        }
        applyVoiceFields(fields);
      } catch (err: any) {
        alert(`Voice parse failed: ${err.message || 'Check your connection and try again.'}`);
      } finally {
        setVoiceParsing(false);
      }
    };

    rec.onerror = (e: any) => {
      setVoiceListening(false);
      setVoiceInterim('');
      if (e.error === 'no-speech') return;
      if (e.error !== 'aborted') alert(`Microphone error: ${e.error}`);
    };

    voiceRecRef.current = rec;
    rec.start();
    setVoiceListening(true);
  }

  function handleDeviceChange(device: string) {
    const shape = DEVICE_SHAPE[device];
    const preFilter = FILTER_PRESELECT[device] ?? slot.filter;
    const bypass = resolveBypass(device, preFilter ?? '');
    onUpdate({ brewingDevice: device, brewerShape: shape, filter: preFilter, bypass });
  }

  function handleFilterChange(filter: string) {
    const bypass = resolveBypass(slot.brewingDevice, filter);
    onUpdate({ filter, bypass });
  }

  function handleGrinderChange(grinder: string) {
    const resolved = resolveGrindSize(grinder, slot.grindSetting);
    onUpdate({ grinder, grindSize: resolved ?? slot.grindSize });
  }

  function handleGrindSettingChange(setting: number) {
    const resolved = resolveGrindSize(slot.grinder, setting);
    onUpdate({ grindSetting: setting, grindSize: resolved ?? slot.grindSize });
  }

  return (
    <Card className="p-4 flex flex-col gap-5 min-w-[300px]">

      {/* Slot header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: SLOT_COLORS[slotIdx] }}>{SLOT_LABELS[slotIdx]}</span>
        <div className="flex gap-2 items-center">
          {/* Voice Fill button */}
          <button
            type="button"
            onClick={handleVoiceFill}
            disabled={voiceParsing}
            title={voiceListening ? 'Tap to stop recording' : 'Speak your brew setup and tasting notes'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-all ${
              voiceListening
                ? 'bg-brew-negative/15 border-brew-negative text-brew-negative animate-pulse'
                : voiceParsing
                ? 'border-brew-border text-brew-faint cursor-wait'
                : 'border-brew-border text-brew-muted hover:border-brew-primary hover:text-brew-primary'
            }`}
          >
            {voiceParsing
              ? <><Loader2 size={11} className="animate-spin" /> Parsing…</>
              : voiceListening
              ? <><MicOff size={11} /> Stop</>
              : <><Mic size={11} /> Voice Fill</>}
          </button>
          {slotIdx > 0 && (
            <button onClick={onCopyFromA}
              className="text-xs text-brew-faint hover:text-brew-muted transition-colors">
              Copy A's params
            </button>
          )}
          {slotCount > 2 && (
            <button onClick={onRemove} className="text-brew-faint hover:text-brew-negative transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Live transcript preview */}
      {(voiceListening || voiceInterim) && (
        <div className="rounded-lg bg-brew-primary/8 border border-brew-primary/20 px-3 py-2 text-xs text-brew-muted italic leading-relaxed">
          {voiceInterim || <span className="text-brew-faint">Listening…</span>}
        </div>
      )}

      {/* Load Saved Recipe */}
      {savedRecipes.length > 0 && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Load Saved Recipe</FieldLabel>
          <select
            value=""
            onChange={(e) => {
              const r = savedRecipes.find((r) => r.id === e.target.value);
              if (r) onUpdate(applyRecipeToSlot(r));
            }}
            className="w-full bg-brew-surface border border-brew-primary/40 rounded-lg px-2 py-1.5 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none"
          >
            <option value="">— Pick a recipe to auto-fill —</option>
            {savedRecipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.source ? ` · ${r.source}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Coffee + Date */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <FieldLabel>Coffee</FieldLabel>
          <select value={slot.coffeeId} onChange={(e) => onUpdate({ coffeeId: e.target.value })}
            className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none">
            <option value="">— Select coffee —</option>
            {coffees.map((c: any) => (
              <option key={c.id} value={c.id}>{c.roaster} — {c.coffeeName || c.countryOrigin}</option>
            ))}
          </select>
        </div>
        <SlotInput label="Brew Date" type="date" value={slot.brewDate} onChange={(v) => onUpdate({ brewDate: v })} />
      </div>

      {/* Brew Method */}
      <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
        <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Setup</p>
        <SegmentPicker label="Brew Method" options={BREW_METHODS} value={slot.brewMethod}
          onChange={(v) => onUpdate({ brewMethod: v as BrewMethod })} />
        <div className="grid grid-cols-2 gap-2">
          <SlotInput label="Device" options={BREWING_DEVICES} value={slot.brewingDevice}
            onChange={handleDeviceChange} />
          <SlotInput label="Filter" options={FILTERS} value={slot.filter}
            onChange={handleFilterChange} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slot.brewerShape && (
            <div className="flex flex-col gap-1">
              <FieldLabel>Shape</FieldLabel>
              <div className="px-2 py-1.5 text-xs text-brew-muted bg-brew-bg border border-brew-border rounded-lg">{slot.brewerShape}</div>
            </div>
          )}
          {slot.bypass && (
            <div className="flex flex-col gap-1">
              <FieldLabel>Bypass</FieldLabel>
              <div className="px-2 py-1.5 text-xs text-brew-muted bg-brew-bg border border-brew-border rounded-lg">{slot.bypass}</div>
            </div>
          )}
        </div>
        <SlotInput label="Grinder" options={GRINDERS} value={slot.grinder} onChange={handleGrinderChange} />
        <div className="grid grid-cols-2 gap-2">
          <SlotInput label="Grind Setting" type="number" step={0.5} value={slot.grindSetting || ''}
            onChange={(v) => handleGrindSettingChange(v)} />
          <SlotInput label="Grind Size" options={GRIND_SIZES} value={slot.grindSize}
            onChange={(v) => onUpdate({ grindSize: v })} />
          {slot.grinder.toLowerCase().includes('sculptor') && (
            <SlotInput label="RPM Speed" type="number" step={50} value={slot.rpmSpeed ?? 800}
              onChange={(v) => onUpdate({ rpmSpeed: v || undefined })} />
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
        <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Parameters</p>
        <div className="grid grid-cols-2 gap-2">
          <SlotInput label="Dose (g)" step={0.5} value={slot.coffeeDose || ''} onChange={(v) => onUpdate({ coffeeDose: v })} />
          <SlotInput label="Water (g)" step={1} value={slot.waterAmount || ''} onChange={(v) => onUpdate({ waterAmount: v })} />
          {slot.coffeeDose > 0 && (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-[10px] text-brew-faint whitespace-nowrap">Ratio 1:</span>
              <input
                type="number" min={1} step={0.1}
                value={slot.waterAmount > 0 ? parseFloat((slot.waterAmount / slot.coffeeDose).toFixed(1)) : ''}
                onChange={(e) => {
                  const r = parseFloat(e.target.value);
                  if (!isNaN(r) && r > 0) onUpdate({ waterAmount: Math.round(slot.coffeeDose * r) });
                }}
                placeholder="e.g. 15"
                className="flex-1 bg-brew-surface border border-brew-border rounded px-2 py-1 text-xs text-brew-text focus:outline-none focus:border-brew-primary"
              />
              {slot.waterAmount > 0 && <span className="text-[10px] text-brew-faint">= {slot.waterAmount}g</span>}
            </div>
          )}
          <SlotInput label="Temp (°F)" step={1} value={slot.waterTempF || ''} onChange={(v) => onUpdate({ waterTempF: v })} />
          <SlotInput label="PPM" step={5} value={slot.waterPPM || ''} onChange={(v) => onUpdate({ waterPPM: v })} />
        </div>
        <SlotInput label="Water Recipe" options={waterRecipes.map((w: any) => w.name)} value={slot.waterRecipe}
          onChange={(v) => onUpdate({ waterRecipe: v })} />
        <div className="grid grid-cols-2 gap-2">
          <SlotInput label="Final Weight (g)" step={0.5} value={slot.finalBrewWeight ?? ''} onChange={(v) => onUpdate({ finalBrewWeight: v || undefined })} />
          <SlotInput label="TDS (%)" step={0.01} value={slot.tds ?? ''} onChange={(v) => onUpdate({ tds: v || undefined })} />
        </div>
        {/* Dilution */}
        <div className="flex flex-col gap-2 pt-2 border-t border-brew-border">
          <Toggle label="Diluted Brew" value={slot.isDiluted} onChange={(v) => onUpdate({ isDiluted: v, dilutionAmount: v ? slot.dilutionAmount : undefined })} />
          {slot.isDiluted && (
            <div className="flex flex-col gap-1.5">
              <SlotInput label="Dilution Amount (g)" step={1} value={slot.dilutionAmount ?? ''} onChange={(v) => onUpdate({ dilutionAmount: v || undefined })} />
              {slot.dilutionAmount && slot.dilutionAmount > 0 && slot.coffeeDose > 0 && slot.waterAmount > 0 && (
                <div className="flex gap-4 text-xs text-brew-faint">
                  <span>Dilution : Coffee <span className="text-brew-text font-semibold">{(slot.dilutionAmount / slot.coffeeDose).toFixed(2)}</span></span>
                  <span>Dilution : Brew Water <span className="text-brew-text font-semibold">{(slot.dilutionAmount / slot.waterAmount).toFixed(2)}</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pour Over Details */}
      {isPourOver && (
        <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
          <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Pour Over Details</p>
          <div className="grid grid-cols-2 gap-2">
            <SlotInput label="Total Pours" step={1} value={slot.pourOverDetails.totalPours || ''} onChange={(v) => onUpdatePO('totalPours', v)} />
            <SlotInput label="Bloom (g)" step={0.5} value={slot.pourOverDetails.bloomAmount || ''} onChange={(v) => onUpdatePO('bloomAmount', v)} />
            <SlotInput label="Bloom Time (min)" step={0.25} value={slot.pourOverDetails.bloomTime || ''} onChange={(v) => onUpdatePO('bloomTime', v)} />
            <SlotInput label="Total Time (min)" step={0.25} value={slot.pourOverDetails.totalBrewTime || ''} onChange={(v) => onUpdatePO('totalBrewTime', v)} />
            {(slot.brewMethod === 'Immersion' || slot.brewMethod === 'Hybrid Immersion & Filter' || slot.brewMethod === 'AeroPress') && (
              <SlotInput label="Immersion Time (min)" step={0.25} value={slot.pourOverDetails.immersionTime ?? ''} onChange={(v) => onUpdatePO('immersionTime', v || undefined)} />
            )}
          </div>
          <SegmentPicker label="Pour Height" options={HEIGHT_SPEED} value={slot.pourOverDetails.pourHeight}
            onChange={(v) => onUpdatePO('pourHeight', v as PourHeightSpeed)} />
          <SegmentPicker label="Pour Speed" options={POUR_SPEEDS} value={slot.pourOverDetails.pourSpeed}
            onChange={(v) => onUpdatePO('pourSpeed', v as PourHeightSpeed)} />
          <SlotInput label="Pour Speed ml/s" options={POUR_SPEED_MLS} value={slot.pourOverDetails.pourSpeedMlS ?? ''}
            onChange={(v) => onUpdatePO('pourSpeedMlS', v)} />
          <SegmentPicker label="Pour Style" options={[...POUR_STYLES]} value={slot.pourOverDetails.pourStyle ?? ''}
            onChange={(v) => onUpdatePO('pourStyle', v)} />
          <SegmentPicker label="Agitation" options={HEIGHT_SPEED} value={slot.pourOverDetails.agitation}
            onChange={(v) => onUpdatePO('agitation', v as PourHeightSpeed)} />
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Toggle label="Melodrip" value={slot.pourOverDetails.melodrip} onChange={(v) => onUpdatePO('melodrip', v)} />
            <Toggle label="Double Bloom" value={slot.pourOverDetails.doubleBloom} onChange={(v) => onUpdatePO('doubleBloom', v)} />
            <Toggle label="Varying Speed" value={slot.pourOverDetails.varyingPourSpeed ?? false} onChange={(v) => onUpdatePO('varyingPourSpeed', v)} />
            <Toggle label="Samo Bloom" value={!!slot.pourOverDetails.samoBloom} onChange={(v) => onUpdatePO('samoBloom', v)} />
            <Toggle label="Immersed Bloom" value={!!slot.pourOverDetails.immersedBloom} onChange={(v) => onUpdatePO('immersedBloom', v)} />
            <Toggle label="Agitate Bloom" value={!!slot.pourOverDetails.agitateBloom} onChange={(v) => onUpdatePO('agitateBloom', v)} />
            <Toggle label="Swirl" value={!!slot.pourOverDetails.swirl} onChange={(v) => onUpdatePO('swirl', v)} />
            <Toggle label="Multiple Temps" value={!!slot.pourOverDetails.multipleTemperatures} onChange={(v) => onUpdatePO('multipleTemperatures', v)} />
          </div>
          {slot.pourOverDetails.multipleTemperatures && (
            <div className="flex flex-wrap gap-1.5">
              {(['Cooler Bloom', 'Cooler Finish', 'Both'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onUpdatePO('multipleTemperaturesType', opt)}
                  className={`px-2.5 py-1 rounded text-xs border transition-all ${
                    slot.pourOverDetails.multipleTemperaturesType === opt
                      ? 'bg-brew-primary/20 border-brew-primary text-brew-primary-light font-medium'
                      : 'border-brew-border text-brew-faint hover:border-brew-muted'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Espresso Details */}
      {isEspresso && (
        <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
          <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Espresso Details</p>
          <div className="grid grid-cols-2 gap-2">
            <SlotInput label="Yield (g)" step={0.5} value={slot.espressoDetails.totalYield || ''} onChange={(v) => onUpdateEsp('totalYield', v)} />
            <SlotInput label="Brew Time (s)" step={1} value={slot.espressoDetails.brewTime || ''} onChange={(v) => onUpdateEsp('brewTime', v)} />
            <SlotInput label="Max Pressure (bar)" step={0.5} value={slot.espressoDetails.maxPressure || ''} onChange={(v) => onUpdateEsp('maxPressure', v)} />
          </div>
        </div>
      )}

      {/* Recipe */}
      <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
        <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Recipe</p>
        <SlotInput label="Recipe Name" type="text" value={slot.brewRecipeName} placeholder="e.g. Hoffmann 4-6"
          onChange={(v) => onUpdate({ brewRecipeName: v })} />
        <SlotInput label="Recipe Details / Steps" value={slot.brewRecipeDetails} textarea
          placeholder="0:00 – 50g bloom&#10;1:00 – pour to 150g..." onChange={(v) => onUpdate({ brewRecipeDetails: v })} />
        <div className="mt-1">
          <Toggle label="⭐ Mark as Go-To" value={slot.isGoToRecipe} onChange={(v) => onUpdate({ isGoToRecipe: v })} />
        </div>
      </div>

      {/* Flavor Profile */}
      <div className="flex flex-col gap-2 border-t border-brew-border pt-4">
        <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Flavor</p>
        {FLAVOR_DIMS.map(({ key, label }) => (
          <Slider key={key} label={label}
            value={(slot.flavorProfile as any)[key]}
            onChange={(v) => onUpdateFP(key as keyof FlavorProfile, v)} />
        ))}
        {NEG_DIMS.map((key) => (
          <Slider key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={(slot.flavorProfile as any)[key]}
            onChange={(v) => onUpdateFP(key as keyof FlavorProfile, v)}
            negative />
        ))}
        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Tasting Notes</FieldLabel>
          <textarea value={slot.flavorProfile.flavorNotes}
            onChange={(e) => onUpdateFP('flavorNotes', e.target.value)}
            rows={2} placeholder="jasmine, lemon, peach…"
            className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-xs text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary resize-none" />
        </div>
        <div className="flex gap-2 mt-1">
          {(['Under', 'Balanced', 'Over', 'Uneven', 'Unsure'] as PerceivedExtraction[]).map((v) => (
            <button key={v} type="button" onClick={() => onUpdateFP('perceivedExtraction', v)}
              className={`flex-1 py-1 rounded text-xs font-medium border transition-all ${
                slot.flavorProfile.perceivedExtraction === v
                  ? v === 'Balanced' ? 'bg-brew-positive/20 border-brew-positive text-brew-positive'
                  : v === 'Over' ? 'bg-brew-negative/20 border-brew-negative text-brew-negative'
                  : v === 'Uneven' ? 'bg-purple-500/15 border-purple-400 text-purple-400'
                  : v === 'Unsure' ? 'bg-brew-muted/15 border-brew-muted text-brew-muted'
                  : 'bg-brew-primary/20 border-brew-primary text-brew-primary-light'
                  : 'border-brew-border text-brew-faint'
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Reflection */}
        <div className="border-t border-brew-border/40 pt-3 flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-brew-muted uppercase tracking-wider">Reflection</p>
          <div>
            <p className="text-[10px] text-brew-positive uppercase tracking-wider font-medium mb-1.5">More of</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Acidity"   checked={slot.flavorProfile.moreAcidity}            onChange={(v) => onUpdateFP('moreAcidity', v)}   color="positive" />
              <Chip label="Sweetness" checked={slot.flavorProfile.moreSweetness}           onChange={(v) => onUpdateFP('moreSweetness', v)} color="positive" />
              <Chip label="Clarity"   checked={slot.flavorProfile.moreClarity}             onChange={(v) => onUpdateFP('moreClarity', v)}   color="positive" />
              <Chip label="Florality" checked={slot.flavorProfile.moreFlorality}           onChange={(v) => onUpdateFP('moreFlorality', v)} color="positive" />
              <Chip label="Body"      checked={slot.flavorProfile.moreBody}                onChange={(v) => onUpdateFP('moreBody', v)}      color="positive" />
              <Chip label="Intensity" checked={(slot.flavorProfile as any).moreIntensity ?? false} onChange={(v) => onUpdateFP('moreIntensity', v)} color="positive" />
              <Chip label="Flavors Popping" checked={((slot.flavorProfile as any).flavorsPopping ?? 1) >= 4} onChange={(v) => onUpdateFP('flavorsPopping', v ? 5 : 1)} color="positive" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-brew-negative uppercase tracking-wider font-medium mb-1.5">Less of</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Bitterness"     checked={slot.flavorProfile.lessBitterness}                onChange={(v) => onUpdateFP('lessBitterness', v)}  color="negative" />
              <Chip label="Astringency"    checked={slot.flavorProfile.lessAstringency}               onChange={(v) => onUpdateFP('lessAstringency', v)} color="negative" />
              <Chip label="Sourness"       checked={slot.flavorProfile.lessSourness}                  onChange={(v) => onUpdateFP('lessSourness', v)}    color="negative" />
              <Chip label="Muddled Flavors" checked={slot.flavorProfile.lessMuddled}                  onChange={(v) => onUpdateFP('lessMuddled', v)}     color="negative" />
              <Chip label="Intensity"      checked={(slot.flavorProfile as any).lessIntensity ?? false} onChange={(v) => onUpdateFP('lessIntensity', v)} color="negative" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Suggested Change</FieldLabel>
            <textarea value={slot.flavorProfile.suggestedChange}
              onChange={(e) => onUpdateFP('suggestedChange', e.target.value)}
              rows={2} placeholder="e.g. Grind finer, increase temp…"
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-xs text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary resize-none" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Compare() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, addBrew, getCoffee } = useApp();

  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [aiInsights, setAiInsights] = useState<Array<{ text: string; category: LearningCategory; comboTags: LearningCategory[] }>>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savedInsightIds, setSavedInsightIds] = useState<Set<number>>(new Set());
  const [compareIntent, setCompareIntent] = useState('');
  const [intentChips, setIntentChips] = useState<string[]>([]);

  // ── Existing mode ──────────────────────────────────────────────────────────
  const initIds = [
    searchParams.get('a'), searchParams.get('b'),
    searchParams.get('c'), searchParams.get('d'),
  ].filter(Boolean) as string[];

  const [existingIds, setExistingIds] = useState<(string | '')[]>(
    initIds.length >= 2 ? initIds : ['', '']
  );

  function addExistingSlot() {
    if (existingIds.length < MAX_SLOTS) setExistingIds([...existingIds, '']);
  }
  function removeExistingSlot(i: number) {
    setExistingIds(existingIds.filter((_, idx) => idx !== i));
  }
  function setExistingId(i: number, id: string) {
    const next = [...existingIds]; next[i] = id; setExistingIds(next);
  }

  const selectedBrews = existingIds
    .map((id) => data.brews.find((b) => b.id === id))
    .filter(Boolean) as Brew[];

  // ── New Side by Side mode ──────────────────────────────────────────────────
  const blankSlot = (): SideBySideSlot => ({
    coffeeId: '', brewDate: new Date().toISOString().split('T')[0],
    brewMethod: 'Pour Over', brewingDevice: '', filter: '',
    brewerShape: undefined, bypass: undefined,
    grinder: '', grindSetting: 0, grindSize: '', rpmSpeed: undefined,
    coffeeDose: 15, waterAmount: 250, waterTempF: 205, waterPPM: 60,
    waterRecipe: '', finalBrewWeight: undefined, tds: undefined,
    isDiluted: false, dilutionAmount: undefined,
    pourOverDetails: defaultPourOver(),
    espressoDetails: defaultEspresso(),
    brewRecipeName: '', brewRecipeDetails: '', isGoToRecipe: false,
    flavorProfile: defaultFP(),
  });

  const [slots, setSlots] = useState<SideBySideSlot[]>([blankSlot(), blankSlot()]);

  function addSlot() { if (slots.length < MAX_SLOTS) setSlots([...slots, blankSlot()]); }
  function removeSlot(i: number) { setSlots(slots.filter((_, idx) => idx !== i)); }
  function updateSlot(i: number, patch: Partial<SideBySideSlot>) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function updateFP(i: number, k: keyof FlavorProfile, v: any) {
    setSlots(slots.map((s, idx) =>
      idx === i ? { ...s, flavorProfile: { ...s.flavorProfile, [k]: v } } : s
    ));
  }
  function updatePO(i: number, k: keyof PourOverDetails, v: any) {
    setSlots(slots.map((s, idx) =>
      idx === i ? { ...s, pourOverDetails: { ...s.pourOverDetails, [k]: v } } : s
    ));
  }
  function updateEsp(i: number, k: keyof EspressoDetails, v: any) {
    setSlots(slots.map((s, idx) =>
      idx === i ? { ...s, espressoDetails: { ...s.espressoDetails, [k]: v } } : s
    ));
  }

  function copyParamsToAll(fromIdx: number) {
    const src = slots[fromIdx];
    setSlots(slots.map((s, i) => i === fromIdx ? s : {
      ...s,
      brewMethod: src.brewMethod,
      brewingDevice: src.brewingDevice,
      filter: src.filter,
      brewerShape: src.brewerShape,
      bypass: src.bypass,
      grinder: src.grinder,
      grindSetting: src.grindSetting,
      grindSize: src.grindSize,
      coffeeDose: src.coffeeDose,
      waterAmount: src.waterAmount,
      waterTempF: src.waterTempF,
      waterPPM: src.waterPPM,
      waterRecipe: src.waterRecipe,
      pourOverDetails: { ...src.pourOverDetails },
      espressoDetails: { ...src.espressoDetails },
      brewRecipeName: src.brewRecipeName,
      brewRecipeDetails: src.brewRecipeDetails,
      isDiluted: src.isDiluted,
      dilutionAmount: src.dilutionAmount,
    }));
  }

  function handleSaveAll() {
    if (slots.some((s) => !s.coffeeId)) { alert('Please select a coffee for each brew.'); return; }
    const coffee0 = getCoffee(slots[0].coffeeId);
    slots.forEach((s) => {
      const coffee = getCoffee(s.coffeeId);
      const score = calcBrewScore(s.flavorProfile);
      const isPourOver = s.brewMethod === 'Pour Over' || s.brewMethod === 'Immersion' || s.brewMethod === 'Hybrid Immersion & Filter';
      const isEspresso = s.brewMethod === 'Espresso';
      addBrew({
        coffeeId: s.coffeeId,
        brewDate: s.brewDate,
        brewMethod: s.brewMethod,
        brewingDevice: s.brewingDevice,
        filter: s.filter,
        brewerShape: s.brewerShape,
        bypass: s.bypass,
        grinder: s.grinder,
        grindSetting: s.grindSetting,
        grindSize: s.grindSize,
        coffeeDose: s.coffeeDose,
        waterAmount: s.waterAmount,
        waterTempF: s.waterTempF,
        waterPPM: s.waterPPM,
        waterRecipe: s.waterRecipe,
        apaxDropsUsed: false, apaxDrops: {},
        brewRecipeName: s.brewRecipeName,
        brewRecipeDetails: s.brewRecipeDetails,
        isGoToRecipe: s.isGoToRecipe,
        isQuickLog: false,
        finalBrewWeight: s.finalBrewWeight,
        tds: s.tds,
        isDiluted: s.isDiluted,
        dilutionAmount: s.isDiluted ? s.dilutionAmount : undefined,
        dilutionToCoffeeRatio: (s.isDiluted && s.dilutionAmount && s.coffeeDose > 0)
          ? Math.round((s.dilutionAmount / s.coffeeDose) * 1000) / 1000 : undefined,
        dilutionToBrewWaterRatio: (s.isDiluted && s.dilutionAmount && s.waterAmount > 0)
          ? Math.round((s.dilutionAmount / s.waterAmount) * 1000) / 1000 : undefined,
        pourOverDetails: isPourOver ? s.pourOverDetails : undefined,
        espressoDetails: isEspresso ? s.espressoDetails : undefined,
        flavorProfile: s.flavorProfile,
        brewScore: score,
        brewRatio: s.coffeeDose > 0 ? Math.round((s.waterAmount / s.coffeeDose) * 100) / 100 : undefined,
        bloomRatio: (isPourOver && s.pourOverDetails.bloomAmount > 0 && s.coffeeDose > 0)
          ? Math.round((s.pourOverDetails.bloomAmount / s.coffeeDose) * 100) / 100 : undefined,
        coffeeProcessingMethod: coffee?.processingMethod,
        coffeeVarietal: coffee?.varietal,
        coffeeOrigin: coffee?.countryOrigin,
        coffeeRegion: coffee?.region,
        coffeeRoastLevel: coffee?.roastLevel,
        daysOffRoast: coffee?.roastDate ? daysOffRoast(coffee.roastDate, s.brewDate) : undefined,
      });
    });
    // Navigate to compare existing with the newly saved brews
    alert(`${slots.length} brews saved to your journal.`);
    setSlots([blankSlot(), blankSlot()]);
    // ignore coffee0 intentionally — reset is the safe path
    void coffee0;
  }

  // ── Brew data for comparison view ──────────────────────────────────────────
  type CompBrew = {
    label: string; color: string; score: number;
    coffee?: ReturnType<typeof getCoffee>;
    fp: FlavorProfile;
    date: string;
    device: string; filter: string; bypass: string; shape: string;
    grinder: string; grindSetting: number; grindSize: string;
    dose: number; water: number; ratio: string; tempF: number; tempC: number; ppm: number;
    pours?: number; bloom?: number; bloomTime?: number; brewTime?: number;
    pourHeight?: string; pourSpeed?: string; pourSpeedMlS?: string;
    agitation?: string; melodrip?: boolean; doubleBloom?: boolean; varyingPourSpeed?: boolean;
    samoBloom?: boolean; immersedBloom?: boolean; multipleTemperatures?: boolean; multipleTemperaturesType?: string;
    immersionTime?: number; agitateBloom?: boolean; swirl?: boolean; rpmSpeed?: number;
    daysOff?: number;
  };

  function brewToCompBrew(b: Brew, i: number): CompBrew {
    const coffee = getCoffee(b.coffeeId);
    const score = b.brewScore ?? calcBrewScore(b.flavorProfile);
    return {
      label: SLOT_LABELS[i], color: SLOT_COLORS[i], score, coffee,
      fp: b.flavorProfile,
      date: formatDate(b.brewDate),
      device: b.brewingDevice || '—',
      filter: b.filter || '—',
      bypass: b.bypass || '—',
      shape: b.brewerShape || '—',
      grinder: b.grinder || '—',
      grindSetting: b.grindSetting,
      grindSize: b.grindSize || '—',
      dose: b.coffeeDose,
      water: b.waterAmount,
      ratio: brewRatio(b.waterAmount, b.coffeeDose),
      tempF: b.waterTempF,
      tempC: fToC(b.waterTempF),
      ppm: b.waterPPM,
      pours: b.pourOverDetails?.totalPours,
      bloom: b.pourOverDetails?.bloomAmount,
      bloomTime: b.pourOverDetails?.bloomTime,
      brewTime: b.pourOverDetails?.totalBrewTime,
      pourHeight: b.pourOverDetails?.pourHeight,
      pourSpeed: b.pourOverDetails?.pourSpeed,
      pourSpeedMlS: b.pourOverDetails?.pourSpeedMlS,
      agitation: b.pourOverDetails?.agitation,
      melodrip: b.pourOverDetails?.melodrip,
      doubleBloom: b.pourOverDetails?.doubleBloom,
      varyingPourSpeed: b.pourOverDetails?.varyingPourSpeed,
      samoBloom: b.pourOverDetails?.samoBloom,
      immersedBloom: b.pourOverDetails?.immersedBloom,
      multipleTemperatures: b.pourOverDetails?.multipleTemperatures,
      multipleTemperaturesType: b.pourOverDetails?.multipleTemperaturesType,
      immersionTime: b.pourOverDetails?.immersionTime,
      agitateBloom: b.pourOverDetails?.agitateBloom,
      swirl: b.pourOverDetails?.swirl,
      rpmSpeed: b.rpmSpeed,
      daysOff: coffee?.roastDate ? daysOffRoast(coffee.roastDate, b.brewDate) : undefined,
    };
  }

  const compBrews: CompBrew[] = mode === 'existing'
    ? selectedBrews.map((b, i) => brewToCompBrew(b, i))
    : slots.map((s, i) => ({
        label: SLOT_LABELS[i], color: SLOT_COLORS[i],
        score: calcBrewScore(s.flavorProfile),
        coffee: getCoffee(s.coffeeId),
        fp: s.flavorProfile,
        date: formatDate(s.brewDate),
        device: s.brewingDevice || '—', filter: s.filter || '—',
        bypass: s.bypass || '—', shape: s.brewerShape || '—',
        grinder: s.grinder || '—', grindSetting: s.grindSetting,
        grindSize: s.grindSize || '—',
        dose: s.coffeeDose, water: s.waterAmount,
        ratio: brewRatio(s.waterAmount, s.coffeeDose),
        tempF: s.waterTempF, tempC: fToC(s.waterTempF), ppm: s.waterPPM,
        pours: s.pourOverDetails.totalPours,
        bloom: s.pourOverDetails.bloomAmount,
        bloomTime: s.pourOverDetails.bloomTime,
        brewTime: s.pourOverDetails.totalBrewTime,
        pourHeight: s.pourOverDetails.pourHeight,
        pourSpeed: s.pourOverDetails.pourSpeed,
        pourSpeedMlS: s.pourOverDetails.pourSpeedMlS,
        agitation: s.pourOverDetails.agitation,
        melodrip: s.pourOverDetails.melodrip,
        doubleBloom: s.pourOverDetails.doubleBloom,
        varyingPourSpeed: s.pourOverDetails.varyingPourSpeed,
        samoBloom: s.pourOverDetails.samoBloom,
        immersedBloom: s.pourOverDetails.immersedBloom,
        multipleTemperatures: s.pourOverDetails.multipleTemperatures,
        multipleTemperaturesType: s.pourOverDetails.multipleTemperaturesType,
        immersionTime: s.pourOverDetails.immersionTime,
        agitateBloom: s.pourOverDetails.agitateBloom,
        swirl: s.pourOverDetails.swirl,
        rpmSpeed: s.rpmSpeed,
      }));

  const hasData = compBrews.length >= 2 && (
    mode === 'new' || selectedBrews.length >= 2
  );

  // ── AI Insights ────────────────────────────────────────────────────────────
  async function generateInsights() {
    if (!hasData) return;
    const key = getApiKey();
    if (!key) { alert('Add your Anthropic API key in Settings to generate insights.'); return; }
    setLoadingInsights(true);
    setSavedInsightIds(new Set());
    try {
      const summary = compBrews.map((b) => `
${b.label} (${b.date}) — Score: ${b.score.toFixed(1)}
Coffee: ${b.coffee?.roaster ?? '?'} ${b.coffee?.coffeeName ?? '?'} | ${b.coffee?.processingMethod ?? '?'} | ${b.coffee?.roastLevel ?? '?'}
Device: ${b.device} | Grind: ${b.grindSetting} (${b.grindSize}) | ${b.dose}g : ${b.water}g | ${b.tempF}°F
Bloom: ${b.bloom ?? '—'}g | Bloom time: ${b.bloomTime ?? '—'} min | Total brew time: ${b.brewTime ?? '—'} min
Pour height: ${b.pourHeight ?? '—'} | Pour speed: ${b.pourSpeed ?? '—'} | Agitation: ${b.agitation ?? '—'}
Flavor: Acidity ${b.fp.acidity} | Sweetness ${b.fp.sweetness} | Body ${b.fp.body} | Clarity ${b.fp.clarity} | Florality ${b.fp.florality} | Juiciness ${b.fp.juiciness} | Finish ${b.fp.finish} | Astringency ${b.fp.astringency} | Sourness ${b.fp.sourness} | Funkiness ${(b.fp as any).funkiness ?? 1} | Vegetal ${(b.fp as any).vegetal ?? 1} | Harsh ${(b.fp as any).harsh ?? 1} | Thin-ness ${(b.fp as any).thinness ?? 1}
Notes: ${b.fp.flavorNotes || '—'} | Extraction: ${b.fp.perceivedExtraction}
`).join('\n---\n');

      const categoryList = LEARNING_CATEGORIES.join(', ');
      const allChips = intentChips.join(', ');
      const intentLine = [allChips, compareIntent.trim()].filter(Boolean).join(' — ');
      const intentSection = intentLine
        ? `\nBREWER'S FOCUS: "${intentLine}" — prioritize insights related to this variable/question.\n`
        : '';

      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `You are a specialty coffee expert analyzing a side-by-side brew comparison. Give 3-4 specific, actionable insights about what drove the differences in score and flavor. Reference brew labels (Brew A, Brew B, etc.) and specific numbers. Be concise and direct.
${intentSection}
For each insight, assign a primary category from: ${categoryList}
If the insight covers multiple interacting variables, add 1-2 comboTags from the same list (empty array if single-variable).

Comparison data:
${summary}

Return ONLY a JSON array, no markdown, no explanation:
[{"text": "...", "category": "Grind", "comboTags": ["Extraction"]}, ...]`,
          }],
        }),
      });
      const d = await resp.json();
      const raw = d.content?.[0]?.text ?? '[]';
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      // Normalise: ensure comboTags is always an array
      setAiInsights(parsed.map((x: any) => ({
        text: x.text ?? x,
        category: x.category ?? 'Other',
        comboTags: Array.isArray(x.comboTags) ? x.comboTags : [],
      })));
    } catch (e: any) {
      alert('Could not generate insights: ' + e.message);
    } finally {
      setLoadingInsights(false);
    }
  }

  function saveInsight(i: number) {
    const insight = aiInsights[i];
    if (!insight) return;
    const brewLabels = compBrews.map(b => b.label);
    const context = `Compare · ${brewLabels.join(' vs ')}`;
    addLearningToStorage({
      text: insight.text,
      category: insight.category,
      comboTags: insight.comboTags,
      starred: false,
      notes: '',
      sourceBrewLabels: brewLabels,
      sourceContext: context,
    });
    setSavedInsightIds(s => new Set([...s, i]));
  }

  // ── Radar data ─────────────────────────────────────────────────────────────
  const radarData = FLAVOR_DIMS.map(({ key, label }) => {
    const entry: Record<string, any> = { attr: label };
    compBrews.forEach((b) => { entry[b.label] = (b.fp as any)[key]; });
    return entry;
  });

  function allSame(vals: (string | number | undefined)[]) {
    const d = vals.filter(v => v !== undefined && v !== '' && v !== 0 && v !== '—');
    return d.length > 0 && d.every(v => v === d[0]);
  }

  function rowVisible(vals: (string | number | undefined)[]) {
    return !showDiffsOnly || !allSame(vals);
  }

  const brewOptions = data.brews.map((b) => {
    const c = getCoffee(b.coffeeId);
    const score = calcBrewScore(b.flavorProfile);
    return {
      value: b.id,
      label: `${formatDate(b.brewDate)} — ${c?.roaster ?? '?'} ${c?.coffeeName ?? ''} (${score.toFixed(1)})`,
    };
  });

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-brew-muted hover:text-brew-text transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="font-display italic text-brew-text text-2xl leading-tight">Compare Brews</h1>
        </div>
        <div className="flex rounded-lg border border-brew-border overflow-hidden text-sm">
          {([['new', FlaskConical, 'New Side by Side'], ['existing', GitCompare, 'Compare Existing']] as const).map(([m, Icon, lbl]) => (
            <button key={m} onClick={() => setMode(m as any)}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${mode === m ? 'bg-brew-primary/15 text-brew-primary-light font-medium' : 'text-brew-muted hover:text-brew-text'}`}>
              <Icon size={13} />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── WHAT ARE YOU TESTING? ───────────────────────────────────── */}
      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brew-primary-light" />
          <p className="text-sm font-semibold text-brew-text">What are you testing?</p>
          <span className="text-xs text-brew-faint">(optional — focuses the AI analysis)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMPARE_INTENT_CHIPS.map(chip => {
            const active = intentChips.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setIntentChips(cs =>
                  active ? cs.filter(c => c !== chip) : [...cs, chip]
                )}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                  active
                    ? 'bg-brew-primary/20 border-brew-primary/60 text-brew-primary-light font-medium'
                    : 'border-brew-border text-brew-faint hover:border-brew-muted hover:text-brew-muted'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={compareIntent}
          onChange={e => setCompareIntent(e.target.value)}
          placeholder="Or describe your focus... e.g. 'does higher agitation improve clarity on this natural?'"
          className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary"
        />
      </Card>

      {/* ── EXISTING MODE ───────────────────────────────────────────── */}
      {mode === 'existing' && (
        <Card className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Select Brews</SectionTitle>
            {existingIds.length < MAX_SLOTS && (
              <button onClick={addExistingSlot}
                className="flex items-center gap-1 text-xs text-brew-primary hover:text-brew-primary-light transition-colors">
                <Plus size={12} /> Add Brew
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {existingIds.map((id, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[i] }} />
                <select value={id} onChange={(e) => setExistingId(i, e.target.value)}
                  className="flex-1 bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none">
                  <option value="">— {SLOT_LABELS[i]}: pick a brew —</option>
                  {brewOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {existingIds.length > 2 && (
                  <button onClick={() => removeExistingSlot(i)} className="text-brew-faint hover:text-brew-negative transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── NEW SIDE BY SIDE MODE ────────────────────────────────────── */}
      {mode === 'new' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-brew-muted">Log each brew in full — parameters can be shared, flavors are individual.</p>
            {slots.length < MAX_SLOTS && (
              <button onClick={addSlot}
                className="flex items-center gap-1 text-xs text-brew-primary hover:text-brew-primary-light transition-colors">
                <Plus size={12} /> Add Cup
              </button>
            )}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(300px, 1fr))` }}>
              {slots.map((slot, i) => (
                <SlotForm
                  key={i}
                  slot={slot}
                  slotIdx={i}
                  slotCount={slots.length}
                  coffees={data.coffees}
                  waterRecipes={data.waterRecipes}
                  savedRecipes={data.recipes}
                  onUpdate={(patch) => updateSlot(i, patch)}
                  onUpdateFP={(k, v) => updateFP(i, k, v)}
                  onUpdatePO={(k, v) => updatePO(i, k, v)}
                  onUpdateEsp={(k, v) => updateEsp(i, k, v)}
                  onRemove={() => removeSlot(i)}
                  onCopyFromA={() => copyParamsToAll(0)}
                />
              ))}
            </div>
          </div>

          <Button onClick={handleSaveAll} size="lg">
            Save All {slots.length} Brews to Journal
          </Button>
        </div>
      )}

      {/* ── COMPARISON VIEW ──────────────────────────────────────────── */}
      {hasData && (
        <>
          {/* Rank bar */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-brew-gold" />
                <span className="text-sm font-semibold text-brew-text">Ranking</span>
              </div>
              <RankBar brews={compBrews.map((b) => ({ label: b.label, score: b.score, color: b.color }))} />
            </div>
          </Card>

          {/* AI Insights */}
          <Card className="p-5 flex flex-col gap-4 border-brew-primary/20 bg-brew-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brew-primary-light" />
                <SectionTitle>AI Insights</SectionTitle>
                {(intentChips.length > 0 || compareIntent.trim()) && (
                  <span className="text-[10px] text-brew-primary bg-brew-primary/10 border border-brew-primary/20 rounded-full px-2 py-0.5 font-medium">
                    Focused
                  </span>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={generateInsights} disabled={loadingInsights}>
                {loadingInsights ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : aiInsights.length > 0 ? 'Regenerate' : 'Generate Insights'}
              </Button>
            </div>
            {aiInsights.length > 0 ? (
              <div className="flex flex-col gap-3">
                {aiInsights.map((insight, i) => {
                  const saved = savedInsightIds.has(i);
                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-brew-surface border border-brew-border/60">
                      {/* Category badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge cat={insight.category} />
                        {insight.comboTags.map(t => (
                          <CategoryBadge key={t} cat={t} />
                        ))}
                        {insight.comboTags.length > 0 && (
                          <span className="text-[9px] text-brew-faint uppercase tracking-wider">combo</span>
                        )}
                      </div>
                      {/* Insight text */}
                      <p className="text-sm text-brew-text leading-relaxed">{insight.text}</p>
                      {/* Save button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => saveInsight(i)}
                          disabled={saved}
                          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border transition-all ${
                            saved
                              ? 'text-brew-positive border-brew-positive/40 bg-brew-positive/10 cursor-default'
                              : 'text-brew-muted border-brew-border hover:text-brew-primary hover:border-brew-primary/40 hover:bg-brew-primary/5'
                          }`}
                        >
                          {saved ? '✓ Saved to Learnings' : '+ Save to Learnings'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-brew-faint">
                Hit Generate Insights to have Claude analyze what drove the differences between these brews — each insight gets a category tag and can be saved to your Learnings library.
              </p>
            )}
          </Card>

          {/* Diffs toggle + column headers */}
          <div className="flex items-center justify-between">
            <button onClick={() => setShowDiffsOnly(!showDiffsOnly)}
              className="flex items-center gap-2 text-sm text-brew-muted hover:text-brew-text transition-colors">
              {showDiffsOnly ? <ToggleRight size={18} className="text-brew-primary" /> : <ToggleLeft size={18} />}
              Show differences only
            </button>
            <div className="flex items-center gap-4">
              {compBrews.map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                  <span className="text-xs font-medium text-brew-muted">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column header row */}
          <div className="px-4">
            <div className="grid items-center" style={{ gridTemplateColumns: `140px repeat(${compBrews.length}, 1fr) 60px` }}>
              <span />
              {compBrews.map((b) => (
                <span key={b.label} className="text-xs font-bold text-center" style={{ color: b.color }}>
                  {b.label}<br />
                  <span className="font-normal text-brew-faint">{b.date}</span>
                </span>
              ))}
              <span className="text-xs text-brew-faint text-right">Δ</span>
            </div>
          </div>

          {/* Coffee info */}
          {rowVisible(compBrews.map(b => b.coffee?.coffeeName ?? b.coffee?.countryOrigin ?? '')) && (
            <Card className="p-5 flex flex-col gap-0">
              <SectionTitle>Coffee</SectionTitle>
              <CompareRow label="Coffee" values={compBrews.map(b => b.coffee?.coffeeName || b.coffee?.countryOrigin || '—')} />
              <CompareRow label="Roaster" values={compBrews.map(b => b.coffee?.roaster || '—')} />
              <CompareRow label="Processing" values={compBrews.map(b => b.coffee?.processingMethod || '—')} />
              <CompareRow label="Roast Level" values={compBrews.map(b => b.coffee?.roastLevel || '—')} />
              <CompareRow label="Varietal" values={compBrews.map(b => b.coffee?.varietal || '—')} />
              <CompareRow label="Days Off Roast" values={compBrews.map(b => b.daysOff ?? '—')} numeric unit="d" />
            </Card>
          )}

          {/* Grind & Setup */}
          <Card className="p-5 flex flex-col gap-0">
            <SectionTitle>Grind & Setup</SectionTitle>
            {rowVisible(compBrews.map(b => b.device)) && <CompareRow label="Device" values={compBrews.map(b => b.device)} />}
            {rowVisible(compBrews.map(b => b.filter)) && <CompareRow label="Filter" values={compBrews.map(b => b.filter)} />}
            {rowVisible(compBrews.map(b => b.bypass)) && <CompareRow label="Bypass" values={compBrews.map(b => b.bypass)} />}
            {rowVisible(compBrews.map(b => b.shape)) && <CompareRow label="Shape" values={compBrews.map(b => b.shape)} />}
            {rowVisible(compBrews.map(b => b.grinder)) && <CompareRow label="Grinder" values={compBrews.map(b => b.grinder)} />}
            {rowVisible(compBrews.map(b => b.grindSetting)) && <CompareRow label="Grind Setting" values={compBrews.map(b => b.grindSetting)} numeric />}
            {rowVisible(compBrews.map(b => b.grindSize)) && <CompareRow label="Grind Size" values={compBrews.map(b => b.grindSize)} />}
            {rowVisible(compBrews.map(b => b.rpmSpeed)) && <CompareRow label="RPM Speed" values={compBrews.map(b => b.rpmSpeed ?? '—')} numeric unit=" rpm" />}
          </Card>

          {/* Recipe Parameters */}
          <Card className="p-5 flex flex-col gap-0">
            <SectionTitle>Recipe Parameters</SectionTitle>
            {rowVisible(compBrews.map(b => b.dose)) && <CompareRow label="Coffee Dose" values={compBrews.map(b => b.dose)} numeric unit="g" />}
            {rowVisible(compBrews.map(b => b.water)) && <CompareRow label="Water" values={compBrews.map(b => b.water)} numeric unit="g" />}
            {rowVisible(compBrews.map(b => b.ratio)) && <CompareRow label="Brew Ratio" values={compBrews.map(b => b.ratio)} />}
            {rowVisible(compBrews.map(b => b.tempF)) && <CompareRow label="Water Temp" values={compBrews.map(b => `${b.tempF}°F / ${b.tempC}°C`)} />}
            {rowVisible(compBrews.map(b => b.ppm)) && <CompareRow label="Water PPM" values={compBrews.map(b => b.ppm)} numeric unit=" ppm" />}
          </Card>

          {/* Pour Over Details */}
          {compBrews.some(b => b.pours !== undefined) && (
            <Card className="p-5 flex flex-col gap-0">
              <SectionTitle>Pour Over Details</SectionTitle>
              {rowVisible(compBrews.map(b => b.pours)) && <CompareRow label="Total Pours" values={compBrews.map(b => b.pours ?? '—')} numeric />}
              {rowVisible(compBrews.map(b => b.bloom)) && <CompareRow label="Bloom" values={compBrews.map(b => b.bloom ?? '—')} numeric unit="g" />}
              {rowVisible(compBrews.map(b => b.bloomTime)) && <CompareRow label="Bloom Time" values={compBrews.map(b => b.bloomTime ?? '—')} numeric unit=" min" />}
              {rowVisible(compBrews.map(b => b.brewTime)) && <CompareRow label="Total Brew Time" values={compBrews.map(b => b.brewTime ?? '—')} numeric unit=" min" />}
              {rowVisible(compBrews.map(b => b.pourHeight)) && <CompareRow label="Pour Height" values={compBrews.map(b => b.pourHeight ?? '—')} />}
              {rowVisible(compBrews.map(b => b.pourSpeed)) && <CompareRow label="Pour Speed" values={compBrews.map(b => b.pourSpeed ?? '—')} />}
              {rowVisible(compBrews.map(b => b.pourSpeedMlS)) && <CompareRow label="Pour Speed ml/s" values={compBrews.map(b => b.pourSpeedMlS ?? '—')} />}
              {rowVisible(compBrews.map(b => b.agitation)) && <CompareRow label="Agitation" values={compBrews.map(b => b.agitation ?? '—')} />}
              {rowVisible(compBrews.map(b => b.melodrip === undefined ? undefined : b.melodrip ? 'Yes' : 'No')) && <CompareRow label="Melodrip" values={compBrews.map(b => b.melodrip === undefined ? '—' : b.melodrip ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.doubleBloom === undefined ? undefined : b.doubleBloom ? 'Yes' : 'No')) && <CompareRow label="Double Bloom" values={compBrews.map(b => b.doubleBloom === undefined ? '—' : b.doubleBloom ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.varyingPourSpeed === undefined ? undefined : b.varyingPourSpeed ? 'Yes' : 'No')) && <CompareRow label="Varying Speed" values={compBrews.map(b => b.varyingPourSpeed === undefined ? '—' : b.varyingPourSpeed ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.samoBloom === undefined ? undefined : b.samoBloom ? 'Yes' : 'No')) && <CompareRow label="Samo Bloom" values={compBrews.map(b => b.samoBloom === undefined ? '—' : b.samoBloom ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.immersedBloom === undefined ? undefined : b.immersedBloom ? 'Yes' : 'No')) && <CompareRow label="Immersed Bloom" values={compBrews.map(b => b.immersedBloom === undefined ? '—' : b.immersedBloom ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.agitateBloom === undefined ? undefined : b.agitateBloom ? 'Yes' : 'No')) && <CompareRow label="Agitate Bloom" values={compBrews.map(b => b.agitateBloom === undefined ? '—' : b.agitateBloom ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.swirl === undefined ? undefined : b.swirl ? 'Yes' : 'No')) && <CompareRow label="Swirl" values={compBrews.map(b => b.swirl === undefined ? '—' : b.swirl ? 'Yes' : 'No')} />}
              {rowVisible(compBrews.map(b => b.immersionTime)) && <CompareRow label="Immersion Time" values={compBrews.map(b => b.immersionTime ?? '—')} numeric unit=" min" />}
              {rowVisible(compBrews.map(b => b.multipleTemperatures === undefined ? undefined : b.multipleTemperatures ? (b.multipleTemperaturesType ?? 'Yes') : 'No')) && <CompareRow label="Multiple Temps" values={compBrews.map(b => b.multipleTemperatures === undefined ? '—' : b.multipleTemperatures ? (b.multipleTemperaturesType ?? 'Yes') : 'No')} />}
            </Card>
          )}

          {/* Flavor Profile */}
          <Card className="p-5 flex flex-col gap-4">
            <SectionTitle>Flavor Profile</SectionTitle>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compBrews.length}, 1fr)` }}>
              {compBrews.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <ScoreRing score={b.score} size={48} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: b.color }}>{b.label}</p>
                    <p className="text-xs text-brew-faint">{b.fp.perceivedExtraction}</p>
                    {b.fp.flavorNotes && (
                      <p className="text-xs text-brew-faint italic mt-0.5 leading-snug line-clamp-2">{b.fp.flavorNotes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {compBrews.length >= 3 ? (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5ddd0" />
                  <PolarAngleAxis dataKey="attr" tick={{ fontSize: 11, fill: '#8a7a6a' }} />
                  <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
                  {compBrews.map((b) => (
                    <Radar key={b.label} name={b.label} dataKey={b.label}
                      stroke={b.color} fill={b.color} fillOpacity={0.12} strokeWidth={2} />
                  ))}
                  <Tooltip formatter={(v: any) => v.toFixed(1)} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col gap-2">
                {FLAVOR_DIMS.map(({ key, label }) => {
                  const vals = compBrews.map(b => (b.fp as any)[key] as number);
                  const bi = bestIdx(vals);
                  if (showDiffsOnly && vals.every(v => v === vals[0])) return null;
                  return (
                    <div key={key} className="flex flex-col gap-1.5 py-1.5 border-b border-brew-border/40 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brew-faint">{label}</span>
                        {vals[0] !== vals[1] && (
                          <span className="text-xs text-brew-positive font-medium">
                            {SLOT_LABELS[bi]} +{Math.abs(vals[0] - vals[1])}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {vals.map((v, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5ddd0' }}>
                              <div className="h-full rounded-full" style={{ width: `${((v - 1) / 4) * 100}%`, background: i === bi ? '#2d6e4e' : '#b0a090' }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums w-4 text-right"
                              style={{ color: i === bi ? '#2d6e4e' : '#b0a090' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {NEG_DIMS.map((key) => {
                  const vals = compBrews.map(b => (b.fp as any)[key] as number);
                  const bi = bestIdx(vals, true);
                  if (showDiffsOnly && vals.every(v => v === vals[0])) return null;
                  return (
                    <div key={key} className="flex flex-col gap-1.5 py-1.5 border-b border-brew-border/40 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brew-faint">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        {vals[0] !== vals[1] && (
                          <span className="text-xs text-brew-positive font-medium">
                            {SLOT_LABELS[bi]} lower by {Math.abs(vals[0] - vals[1])}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {vals.map((v, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5ddd0' }}>
                              <div className="h-full rounded-full" style={{ width: `${((v - 1) / 4) * 100}%`, background: i === bi ? '#2d6e4e' : '#9b3328' }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums w-4 text-right"
                              style={{ color: i === bi ? '#2d6e4e' : '#9b3328' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Reflection & Next Brew */}
          {compBrews.some(b =>
            b.fp.moreAcidity || b.fp.moreSweetness || b.fp.moreClarity || b.fp.moreFlorality || b.fp.moreBody || (b.fp as any).moreIntensity || ((b.fp as any).flavorsPopping ?? 1) >= 4 ||
            b.fp.lessBitterness || b.fp.lessAstringency || b.fp.lessSourness || b.fp.lessMuddled || (b.fp as any).lessIntensity ||
            b.fp.suggestedChange
          ) && (
            <Card className="p-5 flex flex-col gap-4">
              <SectionTitle>Reflection & Next Brew</SectionTitle>
              <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${compBrews.length}, 1fr)` }}>
                {compBrews.map((b) => {
                  const moreOf = [
                    b.fp.moreAcidity && 'Acidity',
                    b.fp.moreSweetness && 'Sweetness',
                    b.fp.moreClarity && 'Clarity',
                    b.fp.moreFlorality && 'Florality',
                    b.fp.moreBody && 'Body',
                    (b.fp as any).moreIntensity && 'Intensity',
                    ((b.fp as any).flavorsPopping ?? 1) >= 4 && 'Flavors Popping',
                  ].filter(Boolean) as string[];
                  const lessOf = [
                    b.fp.lessBitterness && 'Bitterness',
                    b.fp.lessAstringency && 'Astringency',
                    b.fp.lessSourness && 'Sourness',
                    b.fp.lessMuddled && 'Muddled Flavors',
                    (b.fp as any).lessIntensity && 'Intensity',
                  ].filter(Boolean) as string[];
                  return (
                    <div key={b.label} className="flex flex-col gap-3">
                      <p className="text-xs font-bold" style={{ color: b.color }}>{b.label}</p>
                      {moreOf.length > 0 && (
                        <div>
                          <p className="text-[10px] text-brew-positive uppercase tracking-wider font-medium mb-1.5">More of</p>
                          <div className="flex flex-wrap gap-1">
                            {moreOf.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-brew-positive/20 text-brew-positive text-xs rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {lessOf.length > 0 && (
                        <div>
                          <p className="text-[10px] text-brew-negative uppercase tracking-wider font-medium mb-1.5">Less of</p>
                          <div className="flex flex-wrap gap-1">
                            {lessOf.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-brew-negative/20 text-brew-negative text-xs rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {b.fp.suggestedChange && (
                        <p className="text-xs text-brew-muted">
                          <span className="text-brew-faint">Suggested: </span>{b.fp.suggestedChange}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Empty states */}
      {mode === 'existing' && !hasData && data.brews.length === 0 && (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <p className="text-brew-text font-medium">No brews logged yet</p>
          <p className="text-brew-muted text-sm">Log your first brew to start comparing.</p>
          <Button onClick={() => navigate('/brews/new')}><Plus size={14} /> Log a Brew</Button>
        </Card>
      )}

      {mode === 'existing' && !hasData && data.brews.length > 0 && (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <p className="text-brew-text font-medium">Select at least 2 brews above to compare</p>
          <p className="text-brew-muted text-sm">Or switch to New Side by Side to log fresh brews simultaneously.</p>
        </Card>
      )}

      <div className="pb-8" />
    </div>
  );
}
