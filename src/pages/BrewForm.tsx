import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, Star, BookMarked, Mic, MicOff, ChevronDown, ChevronUp, Loader2, Repeat2, Layers, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Button, Card, Input, Select, Toggle, Slider, Chip, SectionTitle, ScoreRing, MicButton,
} from '../components/ui';
import {
  calcBrewScore, calcEY, fToC, daysOffRoast, bloomRatio, espressoRatio, formatDate,
} from '../utils';
import type {
  Brew, BrewMethod, PourOverDetails, EspressoDetails, FlavorProfile,
  PourHeightSpeed, PerceivedExtraction, SavedRecipe,
} from '../types';
import { parseVoiceWithClaudeStream } from '../utils/parseVoiceWithClaude';
import type { VoiceBrewFields } from '../utils/parseVoiceWithClaude';
import { streamSuggestion, buildPreBrewPrompt, BREW_EXPERT_SYSTEM, HAIKU_MODEL, SONNET_MODEL } from '../utils/aiSuggestions';
import type { SuggestionModel } from '../utils/aiSuggestions';
import { getApiKey } from './Settings';

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
// Grind setting → grind size auto-resolve per grinder
const GRIND_SIZE_RANGES: Record<string, { max: number; size: string }[]> = {
  'Timemore Sculptor 078': [
    { max: 1.9,  size: 'Coarse Espresso' },
    { max: 3.5,  size: 'Fine / Mokka'    },
    { max: 7.5,  size: 'Medium Fine'     },
    { max: 9.5,  size: 'Medium'          },
    { max: 12.5, size: 'Medium Coarse'   },
    { max: Infinity, size: 'Coarse'      },
  ],
  'Comandante C40': [
    { max: 7,    size: 'Coarse Espresso' },
    { max: 16,   size: 'Fine / Mokka'    },
    { max: 22,   size: 'Medium Fine'     },
    { max: 25,   size: 'Medium'          },
    { max: 28,   size: 'Medium Coarse'   },
    { max: Infinity, size: 'Coarse'      },
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

const defaultFlavorProfile: FlavorProfile = {
  acidity: 3,
  sweetness: 3,
  body: 3,
  florality: 3,
  clarity: 3,
  juiciness: 3,
  finish: 3,
  astringency: 1,
  sourness: 1,
  funkiness: 1,
  vegetal: 1,
  harsh: 1,
  thinness: 1,
  muddled: 1,
  texture: 3, fruit: 3, chocolateCaramel: 3,
  flavorNotes: '',
  perceivedExtraction: 'Balanced',
  moreAcidity: false,
  moreSweetness: false,
  moreClarity: false,
  moreFlorality: false,
  moreBody: false,
  moreIntensity: false,
  flavorsPopping: 3,
  lessBitterness: false,
  lessAstringency: false,
  lessSourness: false,
  lessMuddled: false,
  lessIntensity: false,
  suggestedChange: '',
};

const defaultPourOver: PourOverDetails = {
  totalPours: 4,
  bloomAmount: 0,
  doubleBloom: false,
  melodrip: false,
  pourHeight: 'Medium',
  pourSpeed: 'Medium',
  pourStyle: 'Circular',
  agitation: 'Medium',
  bloomTime: 0.5,
  totalBrewTime: 3,
};

const defaultEspresso: EspressoDetails = {
  totalYield: 0,
  brewTime: 28,
  maxPressure: 9,
};

type BrewFormData = Omit<Brew, 'id' | 'createdAt'>;

function recipeToFormFields(r: SavedRecipe): Partial<BrewFormData> {
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
    isDiluted: r.isDiluted ?? false,
    dilutionAmount: r.dilutionAmount,
    pourOverDetails: r.pourOverDetails ?? (r.brewMethod === 'Pour Over' ? defaultPourOver : undefined),
    espressoDetails: r.espressoDetails ?? (r.brewMethod === 'Espresso' ? defaultEspresso : undefined),
  };
}


const INTENT_CHIPS = [
  'Optimize acidity & clarity',
  'Dial in sweetness',
  'Balance the cup',
  'Reduce funk / fermented notes',
  'Maximize body & texture',
  'First brew — give me a starting point',
  'Test a new presentation',
  'Improve extraction yield',
];

/** Render **bold** headers and plain lines from streamed markdown text */
function renderSuggestion(text: string) {
  return text.split('\n').map((line, i) => {
    const header = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (header) {
      return (
        <p key={i} className="text-xs font-semibold uppercase tracking-wider text-brew-primary-light mt-4 mb-1 first:mt-0">
          {header[1]}
        </p>
      );
    }
    if (!line.trim()) return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm text-brew-text leading-relaxed">{line}</p>;
  });
}

export default function BrewForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;
  const { data, addBrew, updateBrew, getCoffee, getRecipe, addRecipe } = useApp();
  const waterRecipeNames = data.waterRecipes.map((w) => w.name);

  const preselectedCoffeeId = searchParams.get('coffeeId') || '';
  const preselectedRecipeId = searchParams.get('recipeId') || '';
  const fromBrewId = searchParams.get('fromBrewId') || '';
  const existingBrew = isEdit ? data.brews.find((b) => b.id === editId) : undefined;
  const cloneBrew = fromBrewId ? data.brews.find((b) => b.id === fromBrewId) : undefined;
  const initialRecipe = preselectedRecipeId ? getRecipe(preselectedRecipeId) : undefined;

  const [showAdvanced, setShowAdvanced] = useState(isEdit || !!cloneBrew);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  const [form, setForm] = useState<BrewFormData>(() => {
    // Edit mode: pre-fill from existing brew
    if (existingBrew) {
      const { id: _id, createdAt: _ca, ...rest } = existingBrew;
      return { ...rest, grindSetting: Number(rest.grindSetting) || 0 } as BrewFormData;
    }
    // Brew Again: clone params from another brew
    if (cloneBrew) {
      const { id: _id, createdAt: _ca, quickScore: _qs, isQuickLog: _ql, flavorProfile: _fp, ...params } = cloneBrew;
      return { ...params, grindSetting: Number(params.grindSetting) || 0, brewDate: new Date().toISOString().split('T')[0], flavorProfile: defaultFlavorProfile, quickScore: undefined, isQuickLog: false } as BrewFormData;
    }
    const base: BrewFormData = {
      coffeeId: preselectedCoffeeId,
      brewDate: new Date().toISOString().split('T')[0],
      brewMethod: 'Pour Over',
      grinder: 'Timemore Sculptor 078',
      grindSetting: 0,
      grindSize: '',
      brewingDevice: '',
      filter: '',
      brewerShape: undefined,
      bypass: undefined,
      coffeeDose: 15,
      waterAmount: 240,
      waterTempF: 205,
      waterPPM: 60,
      waterRecipe: '',
      isDiluted: false,
      dilutionAmount: undefined,
      apaxDropsUsed: false,
      apaxDrops: {},
      quickScore: undefined,
      isQuickLog: true,
      brewRecipeName: '',
      brewRecipeDetails: '',
      pourOverDetails: defaultPourOver,
      espressoDetails: undefined,
      finalBrewWeight: undefined,
      tds: undefined,
      extractionYield: undefined,
      flavorProfile: defaultFlavorProfile,
      isGoToRecipe: false,
    };
    if (initialRecipe) return { ...base, ...recipeToFormFields(initialRecipe) };
    return base;
  });

  const [saveAsRecipe, setSaveAsRecipe] = useState(false);
  const [recipeSaveName, setRecipeSaveName] = useState('');
  const [recipeSaveSource, setRecipeSaveSource] = useState('');
  const [eyOverride, setEyOverride] = useState(false);

  // Pre-brew intent state
  const [showIntentCard, setShowIntentCard] = useState(false);
  const [intentChips, setIntentChips] = useState<string[]>([]);
  const [intentText, setIntentText] = useState('');
  const [intentModel, setIntentModel] = useState<SuggestionModel>(HAIKU_MODEL);
  const [intentResponse, setIntentResponse] = useState('');
  const [intentStreaming, setIntentStreaming] = useState(false);

  // Voice fill state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceParsing, setVoiceParsing] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceAdditive, setVoiceAdditive] = useState(false);
  const [voiceFilledFields, setVoiceFilledFields] = useState<string[]>([]);
  const voiceRecRef = useRef<any>(null);
  const voiceTranscriptRef = useRef('');

  const isPourOverMethod = (m: BrewMethod) =>
    m === 'Pour Over' || m === 'Immersion' || m === 'Hybrid Immersion & Filter';

  useEffect(() => {
    if (isPourOverMethod(form.brewMethod)) {
      setForm((f) => ({
        ...f,
        pourOverDetails: f.pourOverDetails ?? defaultPourOver,
        espressoDetails: undefined,
      }));
    } else if (form.brewMethod === 'AeroPress') {
      setForm((f) => ({
        ...f,
        pourOverDetails: f.pourOverDetails ?? defaultPourOver,
        espressoDetails: undefined,
      }));
    } else if (form.brewMethod === 'Espresso') {
      setForm((f) => ({
        ...f,
        espressoDetails: f.espressoDetails ?? defaultEspresso,
        pourOverDetails: undefined,
      }));
    } else {
      setForm((f) => ({ ...f, pourOverDetails: undefined, espressoDetails: undefined }));
    }
  }, [form.brewMethod]);

  function set<K extends keyof BrewFormData>(k: K, v: BrewFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setPO<K extends keyof PourOverDetails>(k: K, v: PourOverDetails[K]) {
    setForm((f) => ({ ...f, pourOverDetails: { ...(f.pourOverDetails ?? defaultPourOver), [k]: v } }));
  }

  function setESP<K extends keyof EspressoDetails>(k: K, v: EspressoDetails[K]) {
    setForm((f) => ({ ...f, espressoDetails: { ...(f.espressoDetails ?? defaultEspresso), [k]: v } }));
  }

  function setFP<K extends keyof FlavorProfile>(k: K, v: FlavorProfile[K]) {
    setForm((f) => ({ ...f, flavorProfile: { ...f.flavorProfile, [k]: v } }));
  }

  function applyRecipe(recipe: SavedRecipe) {
    setForm((f) => ({ ...f, ...recipeToFormFields(recipe) }));
  }

  function findRecipeByName(spoken: string): SavedRecipe | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const s = norm(spoken);
    // Exact match
    let hit = data.recipes.find((r) => norm(r.name) === s);
    if (hit) return hit;
    // Substring match
    hit = data.recipes.find((r) => norm(r.name).includes(s) || s.includes(norm(r.name)));
    if (hit) return hit;
    // Word-overlap (≥50% of words must match)
    const sWords = s.split(/\s+/);
    let best: SavedRecipe | undefined;
    let bestScore = 0;
    for (const r of data.recipes) {
      const rWords = norm(r.name).split(/\s+/);
      const overlap = sWords.filter((w) => rWords.includes(w)).length;
      const score = overlap / Math.max(sWords.length, rWords.length);
      if (score > bestScore && score >= 0.5) { bestScore = score; best = r; }
    }
    return best;
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

  function applyVoiceFields(v: VoiceBrewFields, additive = false) {
    setForm((f) => {
      let u = { ...f };

      // Brew date (resolved relative phrase like "yesterday" or "last Sunday")
      if (v.brewDate) u.brewDate = v.brewDate;

      // Brew method
      if (v.brewMethod) u.brewMethod = v.brewMethod as BrewMethod;

      // Brewing device — auto-populate filter, shape, bypass
      if (v.brewingDevice) {
        const dev = v.brewingDevice;
        const resolvedFilter = v.filter ?? FILTER_PRESELECT[dev] ?? f.filter ?? '';
        u.brewingDevice = dev;
        if (v.filter) u.filter = v.filter;
        else if (FILTER_PRESELECT[dev]) u.filter = FILTER_PRESELECT[dev];
        if (!v.brewerShape && DEVICE_SHAPE[dev]) u.brewerShape = DEVICE_SHAPE[dev];
        if (!v.bypass) u.bypass = resolveBypass(dev, resolvedFilter) ?? f.bypass;
      } else if (v.filter) {
        u.filter = v.filter;
        if (!v.bypass) u.bypass = resolveBypass(f.brewingDevice, v.filter) ?? f.bypass;
      }
      if (v.brewerShape) u.brewerShape = v.brewerShape;
      if (v.bypass) u.bypass = v.bypass;

      // Grinder / grind
      if (v.grinder) u.grinder = v.grinder;
      if (v.grindSetting != null) u.grindSetting = v.grindSetting;
      // Auto-resolve grind size from grinder + setting; explicit voice override wins
      if (v.grindSize) {
        u.grindSize = v.grindSize;
      } else if (v.grinder || v.grindSetting != null) {
        u.grindSize = resolveGrindSize(u.grinder, u.grindSetting) ?? u.grindSize;
      }

      // Recipe parameters
      if (v.coffeeDose) u.coffeeDose = v.coffeeDose;
      if (v.waterAmount) u.waterAmount = v.waterAmount;
      if (v.waterTempF) u.waterTempF = v.waterTempF;
      if (v.waterPPM != null) u.waterPPM = v.waterPPM;
      if (v.brewRecipeName) u.brewRecipeName = v.brewRecipeName;

      // Pour over details
      if (u.pourOverDetails || v.pourStyle || v.melodrip != null || v.doubleBloom != null
        || v.varyingPourSpeed != null || v.totalPours || v.bloomAmount || v.bloomTime || v.totalBrewTime) {
        const po = { ...(u.pourOverDetails ?? defaultPourOver) };
        if (v.pourStyle)              po.pourStyle         = v.pourStyle;
        if (v.pourHeight)             po.pourHeight        = v.pourHeight;
        if (v.pourSpeed)              po.pourSpeed         = v.pourSpeed;
        if (v.agitation)              po.agitation         = v.agitation;
        if (v.pourSpeedMlS)           po.pourSpeedMlS      = v.pourSpeedMlS;
        if (v.pourSpeedMinMlS)        po.pourSpeedMinMlS   = v.pourSpeedMinMlS;
        if (v.pourSpeedMaxMlS)        po.pourSpeedMaxMlS   = v.pourSpeedMaxMlS;
        if (v.melodrip        != null) po.melodrip          = v.melodrip;
        if (v.doubleBloom     != null) po.doubleBloom       = v.doubleBloom;
        if (v.varyingPourSpeed!= null) po.varyingPourSpeed  = v.varyingPourSpeed;
        if (v.totalPours)             po.totalPours        = v.totalPours;
        if (v.bloomAmount)            po.bloomAmount       = v.bloomAmount;
        if (v.bloomTime)              po.bloomTime         = v.bloomTime;
        if (v.totalBrewTime)          po.totalBrewTime     = v.totalBrewTime;
        u.pourOverDetails = po;
      }

      // Espresso details
      if (v.espressoYield || v.espressoBrewTime || v.espressoMaxPressure) {
        const esp = { ...(u.espressoDetails ?? defaultEspresso) };
        if (v.espressoYield)       esp.totalYield   = v.espressoYield;
        if (v.espressoBrewTime)    esp.brewTime     = v.espressoBrewTime;
        if (v.espressoMaxPressure) esp.maxPressure  = v.espressoMaxPressure;
        u.espressoDetails = esp;
      }

      // Water recipe, quick score, recipe details & measurements
      if (v.waterRecipe)       u.waterRecipe       = v.waterRecipe;
      if (v.quickScore)        u.quickScore        = v.quickScore;
      if (v.brewRecipeDetails) {
        u.brewRecipeDetails = (additive && f.brewRecipeDetails)
          ? `${f.brewRecipeDetails}\n${v.brewRecipeDetails}`
          : v.brewRecipeDetails;
      }
      if (v.finalBrewWeight != null) u.finalBrewWeight = v.finalBrewWeight;
      if (v.tds             != null) u.tds             = v.tds;
      if (v.extractionYield != null) u.extractionYield = v.extractionYield;

      // Flavor profile
      const fp = { ...f.flavorProfile };
      const clamp = (n: number, lo = 1, hi = 5) => Math.min(hi, Math.max(lo, Math.round(n)));
      if (v.acidity     != null) fp.acidity     = clamp(v.acidity);
      if (v.sweetness   != null) fp.sweetness   = clamp(v.sweetness);
      if (v.body        != null) fp.body        = clamp(v.body);
      if (v.florality   != null) fp.florality   = clamp(v.florality);
      if (v.clarity     != null) fp.clarity     = clamp(v.clarity);
      if (v.juiciness   != null) fp.juiciness   = clamp(v.juiciness);
      if (v.finish      != null) fp.finish      = clamp(v.finish);
      if (v.astringency != null) fp.astringency = clamp(v.astringency);
      if (v.sourness    != null) fp.sourness    = clamp(v.sourness);
      if (v.flavorNotes) {
        fp.flavorNotes = (additive && f.flavorProfile.flavorNotes)
          ? `${f.flavorProfile.flavorNotes} · ${v.flavorNotes}`
          : v.flavorNotes;
      }
      if (v.perceivedExtraction) fp.perceivedExtraction = v.perceivedExtraction;
      if (v.suggestedChange) {
        fp.suggestedChange = (additive && f.flavorProfile.suggestedChange)
          ? `${f.flavorProfile.suggestedChange} · ${v.suggestedChange}`
          : v.suggestedChange;
      }
      if (v.moreAcidity    != null) fp.moreAcidity    = v.moreAcidity;
      if (v.moreSweetness  != null) fp.moreSweetness  = v.moreSweetness;
      if (v.moreClarity    != null) fp.moreClarity    = v.moreClarity;
      if (v.moreFlorality  != null) fp.moreFlorality  = v.moreFlorality;
      if (v.moreBody       != null) fp.moreBody       = v.moreBody;
      if ((v as any).moreIntensity  != null) fp.moreIntensity  = (v as any).moreIntensity;
      if ((v as any).flavorsPopping != null) fp.flavorsPopping = (v as any).flavorsPopping;
      if ((v as any).texture != null) fp.texture = clamp((v as any).texture);
      if ((v as any).fruit != null) fp.fruit = clamp((v as any).fruit);
      if ((v as any).chocolateCaramel != null) fp.chocolateCaramel = clamp((v as any).chocolateCaramel);
      if (v.lessBitterness != null) fp.lessBitterness = v.lessBitterness;
      if (v.lessAstringency!= null) fp.lessAstringency= v.lessAstringency;
      if (v.lessSourness   != null) fp.lessSourness   = v.lessSourness;
      if ((v as any).lessMuddled   != null) fp.lessMuddled   = (v as any).lessMuddled;
      if ((v as any).lessIntensity != null) fp.lessIntensity = (v as any).lessIntensity;
      u.flavorProfile = fp;

      return u;
    });

    // Auto-expand to show filled flavor profile
    const hasFlavor = v.acidity != null || v.sweetness != null || v.body != null
      || v.flavorNotes || v.perceivedExtraction || v.suggestedChange;
    if (hasFlavor) setShowAdvanced(true);
  }

  async function handleGetSuggestion() {
    if (!selectedCoffee) return;
    const intent = [
      ...intentChips,
      intentText.trim(),
    ].filter(Boolean).join('; ');
    if (!intent) return;

    const brewHistory = data.brews
      .filter((b) => b.coffeeId === form.coffeeId)
      .sort((a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime())
      .slice(0, 5)
      .map((b) => ({
        brewDate: b.brewDate,
        brewingDevice: b.brewingDevice,
        grindSetting: b.grindSetting,
        grindSize: b.grindSize,
        rpmSpeed: (b as any).rpmSpeed,
        coffeeDose: b.coffeeDose,
        waterAmount: b.waterAmount,
        waterTempF: b.waterTempF,
        waterPPM: b.waterPPM,
        brewScore: b.brewScore,
        perceivedExtraction: b.flavorProfile?.perceivedExtraction,
        flavorNotes: b.flavorProfile?.flavorNotes,
        acidity: b.flavorProfile?.acidity,
        sweetness: b.flavorProfile?.sweetness,
        clarity: b.flavorProfile?.clarity,
        body: b.flavorProfile?.body,
        juiciness: b.flavorProfile?.juiciness,
        finish: b.flavorProfile?.finish,
        astringency: b.flavorProfile?.astringency,
        sourness: b.flavorProfile?.sourness,
        suggestedChange: b.flavorProfile?.suggestedChange,
        pourOverDetails: b.pourOverDetails,
      }));

    const daysOff = selectedCoffee.roastDate
      ? daysOffRoast(selectedCoffee.roastDate, form.brewDate)
      : undefined;

    const prompt = buildPreBrewPrompt(
      {
        roaster: selectedCoffee.roaster,
        coffeeName: selectedCoffee.coffeeName,
        countryOrigin: selectedCoffee.countryOrigin,
        region: selectedCoffee.region,
        processingMethod: selectedCoffee.processingMethod,
        roastLevel: selectedCoffee.roastLevel,
        varietal: selectedCoffee.varietal,
        elevation: selectedCoffee.elevation,
        tastingNotes: selectedCoffee.tastingNotes,
        daysOffRoast: daysOff ?? undefined,
      },
      intent,
      brewHistory,
    );

    setIntentResponse('');
    setIntentStreaming(true);
    try {
      await streamSuggestion(
        prompt,
        intentModel,
        (delta) => setIntentResponse((prev) => prev + delta),
        getApiKey() ?? undefined,
        BREW_EXPERT_SYSTEM,
      );
    } catch (err: any) {
      setIntentResponse(`Error: ${err.message || 'Something went wrong. Check your API key.'}`);
    } finally {
      setIntentStreaming(false);
    }
  }

  async function handleVoiceFill() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition not supported in this browser.\nUse Chrome on desktop or iOS Safari.');
      return;
    }

    // Tap while listening → stop, which fires onend → parse
    if (voiceListening) {
      voiceRecRef.current?.stop?.();
      return;
    }

    const rec = new SR();
    rec.continuous = true;       // keep going until user taps stop
    rec.interimResults = true;   // live preview while speaking
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
      setVoiceFilledFields([]); // reset chips for this pass

      // Helper: map a partial/full VoiceBrewFields object → human-readable chip names
      function chipsFromFields(v: Partial<VoiceBrewFields>): string[] {
        const chips: string[] = [];
        if (v.brewDate)              chips.push('Brew Date');
        if (v.brewMethod)            chips.push('Brew Method');
        if (v.brewingDevice)         chips.push('Device');
        if (v.grinder)               chips.push('Grinder');
        if (v.grindSetting != null)  chips.push('Grind Setting');
        if (v.grindSize)             chips.push('Grind Size');
        if (v.filter)                chips.push('Filter');
        if (v.coffeeDose)            chips.push('Dose');
        if (v.waterAmount)           chips.push('Water');
        if (v.waterTempF)            chips.push('Temp');
        if (v.waterRecipe)           chips.push('Water Recipe');
        if (v.brewRecipeName)        chips.push('Recipe');
        if (v.brewRecipeDetails)     chips.push('Recipe Details');
        if (v.quickScore)            chips.push('Quick Score');
        const hasPO = v.totalPours || v.bloomAmount || v.bloomTime || v.totalBrewTime
          || v.pourHeight || v.pourSpeed || v.melodrip != null;
        if (hasPO)                   chips.push('Pour Details');
        const hasFlavor = v.acidity != null || v.sweetness != null || v.body != null
          || v.florality != null || v.clarity != null || v.juiciness != null || v.finish != null;
        if (hasFlavor)               chips.push('Flavor Sliders');
        if (v.flavorNotes)           chips.push('Flavor Notes');
        if (v.perceivedExtraction)   chips.push('Extraction');
        if (v.suggestedChange)       chips.push('Suggested Change');
        return chips;
      }

      try {
        const recipeNames = data.recipes.map((r) => r.name);
        const today = new Date().toISOString().split('T')[0];

        // Stream the parse — onPartialFields fires as Claude emits each key:value,
        // giving the user a live chip preview without modifying the form mid-stream.
        const fields = await parseVoiceWithClaudeStream(
          transcript,
          (partial) => {
            const incoming = chipsFromFields(partial);
            if (incoming.length === 0) return;
            setVoiceFilledFields((prev) => {
              // Merge without duplicates, preserving order
              const seen = new Set(prev);
              const next = [...prev];
              for (const c of incoming) {
                if (!seen.has(c)) { seen.add(c); next.push(c); }
              }
              return next;
            });
          },
          getApiKey() ?? undefined,
          recipeNames,
          today,
        );

        // If a saved recipe was mentioned, apply it first so all its params load in,
        // then overlay any explicit adjustments spoken on top.
        if (fields.brewRecipeName) {
          const matched = findRecipeByName(fields.brewRecipeName);
          if (matched) {
            applyRecipe(matched);
            setSelectedRecipeId(matched.id);
          }
        }
        applyVoiceFields(fields, voiceAdditive);

        // Final authoritative chip list from the complete parse result
        const finalChips = chipsFromFields(fields);
        if (finalChips.length > 0) {
          setVoiceFilledFields(finalChips);
          setTimeout(() => setVoiceFilledFields([]), 10000);
        }
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.coffeeId) return alert('Please select a coffee.');
    const brewScore = calcBrewScore(form.flavorProfile);
    const brewRatio = form.coffeeDose > 0
      ? Math.round((form.waterAmount / form.coffeeDose) * 100) / 100
      : undefined;
    const bloomRatio = form.pourOverDetails?.bloomAmount && form.coffeeDose > 0
      ? Math.round((form.pourOverDetails.bloomAmount / form.coffeeDose) * 100) / 100
      : undefined;

    // Snapshot coffee details at brew time for analytics (avoids join at query time)
    const coffee = getCoffee(form.coffeeId);
    const roastDays = coffee?.roastDate
      ? daysOffRoast(coffee.roastDate, form.brewDate)
      : undefined;

    const dilutionToCoffeeRatio = form.isDiluted && form.dilutionAmount && form.coffeeDose > 0
      ? Math.round((form.dilutionAmount / form.coffeeDose) * 100) / 100
      : undefined;
    const dilutionToBrewWaterRatio = form.isDiluted && form.dilutionAmount && form.waterAmount > 0
      ? Math.round((form.dilutionAmount / form.waterAmount) * 100) / 100
      : undefined;

    const payload = {
      ...form,
      isQuickLog: !showAdvanced,
      brewScore,
      brewRatio,
      bloomRatio,
      dilutionToCoffeeRatio,
      dilutionToBrewWaterRatio,
      daysOffRoast:            roastDays,
      coffeeProcessingMethod:  coffee?.processingMethod,
      coffeeVarietal:          coffee?.varietal,
      coffeeOrigin:            coffee?.countryOrigin,
      coffeeRegion:            coffee?.region,
      coffeeElevation:         coffee?.elevation,
      coffeeRoastLevel:        coffee?.roastLevel,
    };
    if (isEdit && editId) {
      updateBrew(editId, payload);
      navigate(`/brews/${editId}`);
      return;
    }
    addBrew(payload);
    if (saveAsRecipe && recipeSaveName.trim()) {
      addRecipe({
        name: recipeSaveName.trim(),
        source: recipeSaveSource.trim(),
        brewMethod: form.brewMethod,
        brewingDevice: form.brewingDevice,
        filter: form.filter,
        brewerShape: form.brewerShape,
        bypass: form.bypass,
        coffeeDose: form.coffeeDose,
        waterAmount: form.waterAmount,
        waterTempF: form.waterTempF,
        waterPPM: form.waterPPM,
        waterRecipe: form.waterRecipe,
        recipeDetails: form.brewRecipeDetails,
        pourOverDetails: form.pourOverDetails,
        espressoDetails: form.espressoDetails,
      });
    }
    navigate('/brews');
  }

  const selectedCoffee = getCoffee(form.coffeeId);
  const days =
    selectedCoffee?.roastDate && form.brewDate
      ? daysOffRoast(selectedCoffee.roastDate, form.brewDate)
      : null;

  const liveScore = calcBrewScore(form.flavorProfile);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <h1 className="font-display italic text-brew-text text-2xl leading-tight">
          {isEdit ? 'Edit Brew' : 'Log a Brew'}
        </h1>
        <div className="ml-auto flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Additive mode toggle */}
            <button
              type="button"
              onClick={() => setVoiceAdditive((v) => !v)}
              title={voiceAdditive ? 'Additive: text fields append on next pass' : 'Replace: each voice pass fully overwrites text fields'}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                voiceAdditive
                  ? 'bg-brew-primary/15 text-brew-primary-light border-brew-primary/40'
                  : 'bg-brew-surface text-brew-faint border-brew-border hover:border-brew-muted'
              }`}
            >
              <Layers size={12} />
              {voiceAdditive ? 'Additive' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={handleVoiceFill}
              disabled={voiceParsing}
              title={voiceListening ? 'Tap to stop and parse' : 'Speak your brew — everything fills automatically'}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                voiceListening
                  ? 'bg-brew-negative/15 text-brew-negative border-brew-negative/40 animate-pulse'
                  : voiceParsing
                  ? 'bg-brew-surface text-brew-muted border-brew-border cursor-default'
                  : 'bg-brew-surface text-brew-muted border-brew-border hover:text-brew-primary hover:border-brew-primary'
              }`}
            >
              {voiceParsing
                ? <><Loader2 size={13} className="animate-spin" /> Parsing…</>
                : voiceListening
                ? <><MicOff size={13} /> Stop &amp; Parse</>
                : <><Mic size={13} /> Voice Fill</>
              }
            </button>
          </div>
          {voiceListening && voiceInterim && (
            <p className="text-xs text-brew-faint max-w-[260px] text-right leading-snug italic">
              "{voiceInterim}"
            </p>
          )}
          {!voiceListening && !voiceParsing && voiceFilledFields.length === 0 && (
            <p className="text-xs text-brew-faint">Speak your full brew — tap again to stop</p>
          )}
          {/* Post-parse fields summary */}
          {voiceFilledFields.length > 0 && !voiceListening && !voiceParsing && (
            <div className="flex flex-wrap gap-1 justify-end max-w-[280px]">
              <span className="text-xs text-brew-positive font-medium w-full text-right">✓ Filled:</span>
              {voiceFilledFields.map((f) => (
                <span key={f} className="text-xs px-1.5 py-0.5 bg-brew-positive/10 text-brew-positive rounded-full border border-brew-positive/20">{f}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-3xl">

        {/* ── Brew Again banner ────────────────────────────── */}
        {cloneBrew && !isEdit && (
          <div className="flex items-start gap-3 p-4 bg-brew-primary/8 border border-brew-primary/20 rounded-xl">
            <Repeat2 size={16} className="text-brew-primary-light flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brew-text">Brew Again</p>
              <p className="text-xs text-brew-faint mt-0.5">
                Cloned from {formatDate(cloneBrew.brewDate)} · {cloneBrew.brewMethod} · {cloneBrew.brewingDevice || '—'}
              </p>
              <p className="text-xs text-brew-muted mt-1.5">
                Parameters are pre-filled. You'll likely want to adjust <strong className="text-brew-text">Grind Setting</strong> and add fresh <strong className="text-brew-text">Tasting Notes</strong> after drinking.
              </p>
            </div>
          </div>
        )}

        {/* ── Coffee Selection ─────────────────────────────── */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Coffee</SectionTitle>
          {data.coffees.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-brew-surface rounded-lg border border-brew-border">
              <p className="text-brew-muted text-sm flex-1">No coffees added yet.</p>
              <Button size="sm" type="button" onClick={() => navigate('/coffees/new')}>Add Coffee First</Button>
            </div>
          ) : (
            <Select
              label="Select Coffee"
              value={form.coffeeId}
              onChange={(e) => set('coffeeId', e.target.value)}
              placeholder="— Choose a coffee —"
              options={data.coffees.map((c) => ({
                value: c.id,
                label: `${c.roaster} · ${c.countryOrigin}${c.region ? `, ${c.region}` : ''} (${c.processingMethod})`,
              }))}
            />
          )}
          {selectedCoffee && (
            <div className="flex items-center gap-3 p-3 bg-brew-surface rounded-lg text-sm">
              <div className="flex-1">
                <span className="text-brew-text font-medium">{selectedCoffee.roaster}</span>
                <span className="text-brew-faint ml-2 text-xs">{selectedCoffee.roastLevel} · {selectedCoffee.processingMethod}</span>
              </div>
              {days !== null && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days >= 7 && days <= 30 ? 'bg-brew-positive/20 text-brew-positive' : 'bg-brew-border text-brew-muted'}`}>
                  {days}d off roast
                </span>
              )}
            </div>
          )}
        </Card>

        {/* ── Pre-Brew Intent ──────────────────────────────── */}
        {selectedCoffee && (
          <Card className="p-5 flex flex-col gap-0">
            {/* Header — always visible */}
            <button
              type="button"
              onClick={() => setShowIntentCard((v) => !v)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brew-primary-light" />
                <span className="text-sm font-medium text-brew-text">Pre-Brew Intent</span>
                <span className="text-xs text-brew-faint ml-1">· AI suggestion</span>
              </div>
              {showIntentCard ? <ChevronUp size={15} className="text-brew-faint" /> : <ChevronDown size={15} className="text-brew-faint" />}
            </button>

            {showIntentCard && (
              <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-brew-border">

                {/* Intent chips */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">What are you optimizing for?</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_CHIPS.map((chip) => {
                      const active = intentChips.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setIntentChips((prev) =>
                            active ? prev.filter((c) => c !== chip) : [...prev, chip]
                          )}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            active
                              ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                              : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                          }`}
                        >
                          {active ? '✓ ' : ''}{chip}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Free text input */}
                <textarea
                  className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
                  rows={2}
                  placeholder="Or describe your intent… e.g. 'want more sweetness, last brew was too sharp'"
                  value={intentText}
                  onChange={(e) => setIntentText(e.target.value)}
                />

                {/* Model toggle + Ask button */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-lg border border-brew-border overflow-hidden text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setIntentModel(HAIKU_MODEL)}
                      className={`px-3 py-1.5 transition-colors ${
                        intentModel === HAIKU_MODEL
                          ? 'bg-brew-primary text-brew-bg'
                          : 'bg-brew-surface text-brew-muted hover:text-brew-text'
                      }`}
                    >
                      Haiku · Fast
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntentModel(SONNET_MODEL)}
                      className={`px-3 py-1.5 border-l border-brew-border transition-colors ${
                        intentModel === SONNET_MODEL
                          ? 'bg-brew-primary text-brew-bg'
                          : 'bg-brew-surface text-brew-muted hover:text-brew-text'
                      }`}
                    >
                      Sonnet · Deep
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGetSuggestion}
                    disabled={intentStreaming || (intentChips.length === 0 && !intentText.trim())}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      intentStreaming || (intentChips.length === 0 && !intentText.trim())
                        ? 'bg-brew-surface text-brew-faint border-brew-border cursor-default'
                        : 'bg-brew-primary text-brew-bg border-brew-primary hover:bg-brew-primary-light'
                    }`}
                  >
                    {intentStreaming
                      ? <><Loader2 size={12} className="animate-spin" /> Getting suggestion…</>
                      : <><Sparkles size={12} /> Get Suggestion</>
                    }
                  </button>
                  {intentResponse && !intentStreaming && (
                    <button
                      type="button"
                      onClick={() => { setIntentResponse(''); setIntentChips([]); setIntentText(''); }}
                      className="text-xs text-brew-faint hover:text-brew-muted transition-colors ml-auto"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Streaming response */}
                {(intentResponse || intentStreaming) && (
                  <div className="p-4 bg-brew-surface rounded-xl border border-brew-border">
                    {renderSuggestion(intentResponse)}
                    {intentStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-brew-primary-light ml-0.5 animate-pulse rounded-sm align-middle" />
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Apply Saved Recipe ───────────────────────────── */}
        {data.recipes.length > 0 && (
          <Card className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <BookMarked size={15} className="text-brew-primary-light" />
              <span className="text-sm font-medium text-brew-text">Apply a Saved Recipe</span>
            </div>
            <p className="text-xs text-brew-faint -mt-1">
              Select a recipe to auto-fill brew parameters. You can still adjust anything afterwards.
            </p>
            <div className="flex gap-2">
              <select
                id="recipe-select"
                className="flex-1 bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary transition-colors appearance-none"
                value={selectedRecipeId}
                onChange={(e) => {
                  setSelectedRecipeId(e.target.value);
                  if (!e.target.value) return;
                  const r = getRecipe(e.target.value);
                  if (r) applyRecipe(r);
                }}
              >
                <option value="">— Select a recipe —</option>
                {data.recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.source ? ` · ${r.source}` : ''} ({r.brewMethod})
                  </option>
                ))}
              </select>
            </div>
            {preselectedRecipeId && initialRecipe && (
              <p className="text-xs text-brew-positive">
                ✓ Applied: <strong>{initialRecipe.name}</strong>
              </p>
            )}
          </Card>
        )}

        {/* ── Quick Log Card ───────────────────────────────── */}
        {!showAdvanced && (
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <SectionTitle>Quick Details</SectionTitle>
              <span className="text-xs text-brew-faint">Fill in the essentials</span>
            </div>
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
                label="Grinder"
                value={form.grinder}
                onChange={(e) => {
                  const g = e.target.value;
                  setForm((f) => ({ ...f, grinder: g, grindSize: resolveGrindSize(g, f.grindSetting) ?? f.grindSize }));
                }}
                placeholder="— Select grinder —"
                options={GRINDERS.map((g) => ({ value: g, label: g }))}
              />
              <Input label="Grind Setting" type="number" min={0} step={0.5} value={form.grindSetting || ''} onChange={(e) => {
                  const s = parseFloat(e.target.value) || 0;
                  setForm((f) => ({ ...f, grindSetting: s, grindSize: resolveGrindSize(f.grinder, s) ?? f.grindSize }));
                }} hint="Clicks / steps / dial position" />
              {form.grinder.toLowerCase().includes('sculptor') && (
                <Input label="RPM Speed" type="number" min={0} step={50} value={form.rpmSpeed ?? 800} onChange={(e) => set('rpmSpeed', parseFloat(e.target.value) || undefined)} suffix="rpm" hint="Grinder motor speed" />
              )}
              <Input label="Coffee Dose" type="number" min={0} step={0.1} value={form.coffeeDose || ''} onChange={(e) => set('coffeeDose', parseFloat(e.target.value) || 0)} suffix="g" />
              <Input label="Water Amount" type="number" min={0} step={1} value={form.waterAmount || ''} onChange={(e) => set('waterAmount', parseFloat(e.target.value) || 0)} suffix="g" />
              {form.coffeeDose > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Brew Ratio (1:x)</label>
                  <input
                    type="number"
                    min={1}
                    step={0.1}
                    value={form.waterAmount > 0 ? parseFloat((form.waterAmount / form.coffeeDose).toFixed(1)) : ''}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value);
                      if (!isNaN(r) && r > 0) set('waterAmount', Math.round(form.coffeeDose * r));
                    }}
                    placeholder="e.g. 15"
                    className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
                  />
                  {form.waterAmount > 0 && <span className="text-xs text-brew-faint">→ {form.waterAmount}g water</span>}
                </div>
              )}
              <Input label="Water Temp" type="number" min={150} max={212} value={form.waterTempF || ''} onChange={(e) => set('waterTempF', parseFloat(e.target.value) || 0)} suffix="°F" />
              <Input label="Recipe Name" value={form.brewRecipeName} onChange={(e) => set('brewRecipeName', e.target.value)} placeholder="e.g. Hoffmann 4-6" />
            </div>
            {isPourOverMethod(form.brewMethod) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Total Pours" type="number" min={1} max={20} value={form.pourOverDetails?.totalPours || ''} onChange={(e) => setPO('totalPours', parseInt(e.target.value) || 0)} />
                <div className="flex items-center justify-between pt-5">
                  <span className="text-sm text-brew-text">Melodrip</span>
                  <button type="button" onClick={() => setPO('melodrip', !form.pourOverDetails?.melodrip)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.pourOverDetails?.melodrip ? 'bg-brew-primary' : 'bg-brew-border'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.pourOverDetails?.melodrip ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            )}
            {/* Quick Score */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Quick Score</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => set('quickScore', form.quickScore === n ? undefined : n)}
                    className={`w-10 h-10 rounded-lg border text-lg transition-all ${
                      (form.quickScore ?? 0) >= n
                        ? 'bg-brew-amber/20 border-brew-amber text-brew-amber'
                        : 'bg-brew-surface border-brew-border text-brew-faint hover:border-brew-muted'
                    }`}>★</button>
                ))}
                {form.quickScore && <span className="self-center text-sm text-brew-muted ml-1">{form.quickScore}/5</span>}
              </div>
            </div>
          </Card>
        )}

        {/* ── Advanced Toggle ──────────────────────────────── */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-brew-primary hover:text-brew-primary-light transition-colors self-start"
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
        </button>

        {showAdvanced && <>

        {/* ── Brew Setup ───────────────────────────────────── */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Brew Setup</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Brew Date"
              type="date"
              value={form.brewDate}
              onChange={(e) => set('brewDate', e.target.value)}
            />
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
            <Select
              label="Grinder"
              value={form.grinder}
              onChange={(e) => {
                const g = e.target.value;
                setForm((f) => ({ ...f, grinder: g, grindSize: resolveGrindSize(g, f.grindSetting) ?? f.grindSize }));
              }}
              placeholder="— Select grinder —"
              options={GRINDERS.map((g) => ({ value: g, label: g }))}
            />
            <Input
              label="Grind Setting"
              type="number"
              min={0}
              step={0.5}
              value={form.grindSetting || ''}
              onChange={(e) => {
                const s = parseFloat(e.target.value) || 0;
                setForm((f) => ({ ...f, grindSetting: s, grindSize: resolveGrindSize(f.grinder, s) ?? f.grindSize }));
              }}
              hint="Clicks / steps / dial position"
            />
            {form.grinder.toLowerCase().includes('sculptor') && (
              <Input label="RPM Speed" type="number" min={0} step={50} value={form.rpmSpeed ?? 800} onChange={(e) => set('rpmSpeed', parseFloat(e.target.value) || undefined)} suffix="rpm" hint="Grinder motor speed" />
            )}
            <Select
              label="Grind Size"
              value={form.grindSize ?? ''}
              onChange={(e) => set('grindSize', e.target.value)}
              placeholder="— Select grind size —"
              options={GRIND_SIZES.map((s) => ({ value: s, label: s }))}
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

        {/* ── Recipe Parameters ────────────────────────────── */}
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
            {form.coffeeDose > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Brew Ratio (1:x)</label>
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={form.waterAmount > 0 ? parseFloat((form.waterAmount / form.coffeeDose).toFixed(1)) : ''}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    if (!isNaN(r) && r > 0) set('waterAmount', Math.round(form.coffeeDose * r));
                  }}
                  placeholder="e.g. 15"
                  className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
                />
                {form.waterAmount > 0 && (
                  <span className="text-xs text-brew-faint">→ {form.waterAmount}g water</span>
                )}
              </div>
            )}
          </div>

          {/* Dilution */}
          <div className="flex flex-col gap-3 pt-2 border-t border-brew-border">
            <Toggle
              label="Diluted Brew"
              checked={!!form.isDiluted}
              onChange={(v) => set('isDiluted', v)}
              description="Water added after brewing (bypass, iced, etc.)"
            />
            {form.isDiluted && (
              <div className="flex flex-col gap-2">
                <Input
                  label="Dilution Amount"
                  type="number"
                  min={0}
                  step={1}
                  value={form.dilutionAmount ?? ''}
                  onChange={(e) => set('dilutionAmount', parseFloat(e.target.value) || undefined)}
                  suffix="g"
                  placeholder="e.g. 50"
                />
                {form.dilutionAmount && form.dilutionAmount > 0 && form.coffeeDose > 0 && form.waterAmount > 0 && (
                  <div className="flex gap-4 text-xs text-brew-faint">
                    <span>Dilution : Coffee <span className="text-brew-text font-semibold">{(form.dilutionAmount / form.coffeeDose).toFixed(2)}</span></span>
                    <span>Dilution : Brew Water <span className="text-brew-text font-semibold">{(form.dilutionAmount / form.waterAmount).toFixed(2)}</span></span>
                  </div>
                )}
              </div>
            )}
          </div>

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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Water Recipe</label>
              <input
                list="water-recipe-list"
                value={form.waterRecipe}
                onChange={(e) => set('waterRecipe', e.target.value)}
                placeholder={waterRecipeNames.length ? 'Select saved or type custom…' : 'e.g. Third Wave Water'}
                className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
              />
              <datalist id="water-recipe-list">
                {waterRecipeNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>

          {/* Apax Drops */}
          <div className="flex flex-col gap-3 pt-2 border-t border-brew-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brew-text">Apax Drops Used?</p>
              </div>
              <button
                type="button"
                onClick={() => set('apaxDropsUsed', !form.apaxDropsUsed)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                  form.apaxDropsUsed ? 'bg-brew-primary' : 'bg-brew-border'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  form.apaxDropsUsed ? 'translate-x-4.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {form.apaxDropsUsed && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {(['tonik', 'jamm', 'lylac', 'april', 'konflux', 'tanat'] as const).map((drop) => (
                  <div key={drop} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{drop}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={form.apaxDrops?.[drop] ?? ''}
                      onChange={(e) => set('apaxDrops', {
                        ...form.apaxDrops,
                        [drop]: e.target.value === '' ? undefined : parseFloat(e.target.value),
                      })}
                      placeholder="0"
                      className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <Input
            label="Recipe Name"
            value={form.brewRecipeName}
            onChange={(e) => set('brewRecipeName', e.target.value)}
            placeholder="e.g. Hoffmann 4-6, Scott Rao Recipe..."
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Recipe Details</label>
              <MicButton onResult={(t) => set('brewRecipeDetails', form.brewRecipeDetails ? `${form.brewRecipeDetails}\n${t}` : t)} />
            </div>
            <textarea
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
              value={form.brewRecipeDetails}
              onChange={(e) => set('brewRecipeDetails', e.target.value)}
              rows={3}
              placeholder="Notes on your recipe: pours, timing, technique..."
            />
          </div>
        </Card>

        {/* ── Pour Over Details ─────────────────────────────── */}
        {isPourOverMethod(form.brewMethod) && form.pourOverDetails && (
          <Card className="p-6 flex flex-col gap-4">
            <SectionTitle>Pour Over Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Total Pours"
                type="number"
                min={1}
                max={20}
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
                    Bloom ratio: {bloomRatio(form.pourOverDetails.bloomAmount, form.coffeeDose)}
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
              {(form.brewMethod === 'Immersion' || form.brewMethod === 'Hybrid Immersion & Filter') && (
                <Input
                  label="Immersion Time"
                  type="number"
                  min={0}
                  step={0.25}
                  value={form.pourOverDetails.immersionTime ?? ''}
                  onChange={(e) => setPO('immersionTime', parseFloat(e.target.value) || undefined)}
                  suffix="min"
                />
              )}
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

            <div className="flex flex-col gap-3 pt-2">
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
              <Toggle
                label="Samo Bloom"
                checked={!!form.pourOverDetails.samoBloom}
                onChange={(v) => setPO('samoBloom', v)}
                description="Bypass-style bloom technique"
              />
              <Toggle
                label="Immersed Bloom"
                checked={!!form.pourOverDetails.immersedBloom}
                onChange={(v) => setPO('immersedBloom', v)}
                description="Bloom step done immersed (no drawdown)"
              />
              <Toggle
                label="Agitate Bloom"
                checked={!!form.pourOverDetails.agitateBloom}
                onChange={(v) => setPO('agitateBloom', v)}
                description="Stir or swirl during bloom"
              />
              <Toggle
                label="Swirl"
                checked={!!form.pourOverDetails.swirl}
                onChange={(v) => setPO('swirl', v)}
                description="Swirl brewer during brew"
              />
              <Toggle
                label="Multiple Temperatures"
                checked={!!form.pourOverDetails.multipleTemperatures}
                onChange={(v) => setPO('multipleTemperatures', v)}
                description="Different water temps used during brew"
              />
              {form.pourOverDetails.multipleTemperatures && (
                <div className="flex flex-wrap gap-2 pl-4">
                  {(['Cooler Bloom', 'Cooler Finish', 'Both'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPO('multipleTemperaturesType', opt)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        form.pourOverDetails?.multipleTemperaturesType === opt
                          ? 'bg-brew-primary/20 border-brew-primary/60 text-brew-primary-light font-medium'
                          : 'border-brew-border text-brew-faint hover:border-brew-muted hover:text-brew-muted'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── AeroPress Details ─────────────────────────────── */}
        {form.brewMethod === 'AeroPress' && form.pourOverDetails && (
          <Card className="p-6 flex flex-col gap-4">
            <SectionTitle>AeroPress Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Immersion Time"
                type="number"
                min={0}
                step={0.25}
                value={form.pourOverDetails.immersionTime ?? ''}
                onChange={(e) => setPO('immersionTime', parseFloat(e.target.value) || undefined)}
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
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Toggle
                label="Agitate Bloom"
                checked={!!form.pourOverDetails.agitateBloom}
                onChange={(v) => setPO('agitateBloom', v)}
                description="Stir or swirl during bloom"
              />
              <Toggle
                label="Swirl"
                checked={!!form.pourOverDetails.swirl}
                onChange={(v) => setPO('swirl', v)}
                description="Swirl brewer during brew"
              />
            </div>
          </Card>
        )}

        {/* ── Espresso Details ──────────────────────────────── */}
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

        {/* ── Measurements ─────────────────────────────────── */}
        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Measurements</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Final Brew Weight"
              type="number"
              min={0}
              step={0.1}
              value={form.finalBrewWeight || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || undefined;
                setForm((f) => {
                  const ey = !eyOverride ? calcEY(f.tds ?? 0, v ?? 0, f.coffeeDose) ?? undefined : f.extractionYield;
                  return { ...f, finalBrewWeight: v, extractionYield: ey };
                });
              }}
              suffix="g"
              placeholder="e.g. 238"
            />
            <Input
              label="TDS"
              type="number"
              min={0}
              max={5}
              step={0.01}
              value={form.tds || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || undefined;
                setForm((f) => {
                  const ey = !eyOverride ? calcEY(v ?? 0, f.finalBrewWeight ?? 0, f.coffeeDose) ?? undefined : f.extractionYield;
                  return { ...f, tds: v, extractionYield: ey };
                });
              }}
              suffix="%"
              placeholder="e.g. 1.35"
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Extraction Yield</label>
                <button
                  type="button"
                  onClick={() => {
                    setEyOverride((v) => {
                      if (v) {
                        // turning off override — recalculate
                        const ey = calcEY(form.tds ?? 0, form.finalBrewWeight ?? 0, form.coffeeDose) ?? undefined;
                        setForm((f) => ({ ...f, extractionYield: ey }));
                      }
                      return !v;
                    });
                  }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    eyOverride
                      ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                      : 'bg-brew-surface border-brew-border text-brew-faint hover:border-brew-muted'
                  }`}
                >
                  {eyOverride ? 'manual' : 'auto'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.1}
                  value={form.extractionYield ?? ''}
                  onChange={(e) => eyOverride && set('extractionYield', parseFloat(e.target.value) || undefined)}
                  readOnly={!eyOverride}
                  placeholder={!form.tds || !form.finalBrewWeight ? 'fill TDS + weight' : '—'}
                  className={`w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm pr-8 transition-colors focus:outline-none ${
                    eyOverride
                      ? 'text-brew-text focus:border-brew-primary'
                      : 'text-brew-muted cursor-default'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brew-faint">%</span>
              </div>
              {form.extractionYield != null && (
                <span className={`text-xs font-medium ${
                  form.extractionYield >= 18 && form.extractionYield <= 22
                    ? 'text-brew-positive'
                    : form.extractionYield < 18
                    ? 'text-brew-amber'
                    : 'text-brew-negative'
                }`}>
                  {form.extractionYield >= 18 && form.extractionYield <= 22
                    ? 'Ideal range (18–22%)'
                    : form.extractionYield < 18
                    ? 'Under-extracted (< 18%)'
                    : 'Over-extracted (> 22%)'}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* ── Flavor Profile ────────────────────────────────── */}
        <Card className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <SectionTitle>Flavor Profile</SectionTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-brew-faint">Brew Score</span>
              <ScoreRing score={liveScore} size={48} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brew-positive mb-4">Positive Attributes</p>
            <div className="flex flex-col gap-5">
              <Slider label="Acidity" value={form.flavorProfile.acidity} onChange={(v) => setFP('acidity', v)} />
              <Slider label="Sweetness" value={form.flavorProfile.sweetness} onChange={(v) => setFP('sweetness', v)} />
              <Slider label="Body" value={form.flavorProfile.body} onChange={(v) => setFP('body', v)} />
              <Slider label="Florality" value={form.flavorProfile.florality} onChange={(v) => setFP('florality', v)} />
              <Slider label="Clarity" value={form.flavorProfile.clarity} onChange={(v) => setFP('clarity', v)} />
              <Slider label="Juiciness" value={form.flavorProfile.juiciness} onChange={(v) => setFP('juiciness', v)} />
              <Slider label="Finish" value={form.flavorProfile.finish} onChange={(v) => setFP('finish', v)} />
              <Slider label="Flavors Popping" value={(form.flavorProfile as any).flavorsPopping ?? 3} onChange={(v) => setFP('flavorsPopping', v)} />
              <Slider label="Texture" value={(form.flavorProfile as any).texture ?? 3} onChange={(v) => setFP('texture', v)} />
              <Slider label="Fruit" value={(form.flavorProfile as any).fruit ?? 3} onChange={(v) => setFP('fruit', v)} />
              <Slider label="Chocolates / Caramels" value={(form.flavorProfile as any).chocolateCaramel ?? 3} onChange={(v) => setFP('chocolateCaramel', v)} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brew-negative mb-4">Negative Attributes</p>
            <div className="flex flex-col gap-5">
              <Slider label="Astringency" value={form.flavorProfile.astringency} onChange={(v) => setFP('astringency', v)} negative />
              <Slider label="Sourness" value={form.flavorProfile.sourness} onChange={(v) => setFP('sourness', v)} negative />
              <Slider label="Funkiness" value={form.flavorProfile.funkiness ?? 1} onChange={(v) => setFP('funkiness', v)} negative />
              <Slider label="Vegetal" value={form.flavorProfile.vegetal ?? 1} onChange={(v) => setFP('vegetal', v)} negative />
              <Slider label="Harsh" value={form.flavorProfile.harsh ?? 1} onChange={(v) => setFP('harsh', v)} negative />
              <Slider label="Thin-ness" value={form.flavorProfile.thinness ?? 1} onChange={(v) => setFP('thinness', v)} negative />
              <Slider label="Muddled" value={(form.flavorProfile as any).muddled ?? 1} onChange={(v) => setFP('muddled', v)} negative />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Flavor Notes</label>
              <MicButton onResult={(t) => setFP('flavorNotes', form.flavorProfile.flavorNotes ? `${form.flavorProfile.flavorNotes} ${t}` : t)} />
            </div>
            <textarea
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
              value={form.flavorProfile.flavorNotes}
              onChange={(e) => setFP('flavorNotes', e.target.value)}
              rows={3}
              placeholder="Describe what you taste — aromas, flavors, mouthfeel, finish..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Perceived Extraction</label>
            <div className="flex gap-2">
              {(['Under', 'Balanced', 'Over', 'Uneven', 'Unsure'] as PerceivedExtraction[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setFP('perceivedExtraction', e)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                    form.flavorProfile.perceivedExtraction === e
                      ? e === 'Balanced'
                        ? 'bg-brew-positive/20 border-brew-positive text-brew-positive'
                        : e === 'Over'
                        ? 'bg-brew-negative/20 border-brew-negative text-brew-negative'
                        : e === 'Uneven'
                        ? 'bg-purple-500/15 border-purple-400 text-purple-400'
                        : e === 'Unsure'
                        ? 'bg-brew-muted/15 border-brew-muted text-brew-muted'
                        : 'bg-brew-amber/20 border-brew-amber text-brew-amber'
                      : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Reflection / Next Brew ────────────────────────── */}
        <Card className="p-6 flex flex-col gap-5">
          <SectionTitle>Reflection & Next Brew</SectionTitle>

          <div>
            <p className="text-xs text-brew-muted mb-3 uppercase tracking-wider font-medium">More of</p>
            <div className="flex flex-wrap gap-2">
              <Chip label="Acidity" checked={form.flavorProfile.moreAcidity} onChange={(v) => setFP('moreAcidity', v)} color="positive" />
              <Chip label="Sweetness" checked={form.flavorProfile.moreSweetness} onChange={(v) => setFP('moreSweetness', v)} color="positive" />
              <Chip label="Clarity" checked={form.flavorProfile.moreClarity} onChange={(v) => setFP('moreClarity', v)} color="positive" />
              <Chip label="Florality" checked={form.flavorProfile.moreFlorality} onChange={(v) => setFP('moreFlorality', v)} color="positive" />
              <Chip label="Body" checked={form.flavorProfile.moreBody} onChange={(v) => setFP('moreBody', v)} color="positive" />
              <Chip label="Intensity" checked={form.flavorProfile.moreIntensity ?? false} onChange={(v) => setFP('moreIntensity', v)} color="positive" />
              <Chip label="Flavors Popping" checked={((form.flavorProfile as any).flavorsPopping ?? 1) >= 4} onChange={(v) => setFP('flavorsPopping', v ? 5 : 1)} color="positive" />
            </div>
          </div>

          <div>
            <p className="text-xs text-brew-muted mb-3 uppercase tracking-wider font-medium">Less of</p>
            <div className="flex flex-wrap gap-2">
              <Chip label="Bitterness" checked={form.flavorProfile.lessBitterness} onChange={(v) => setFP('lessBitterness', v)} color="negative" />
              <Chip label="Astringency" checked={form.flavorProfile.lessAstringency} onChange={(v) => setFP('lessAstringency', v)} color="negative" />
              <Chip label="Sourness" checked={form.flavorProfile.lessSourness} onChange={(v) => setFP('lessSourness', v)} color="negative" />
              <Chip label="Muddled Flavors" checked={form.flavorProfile.lessMuddled} onChange={(v) => setFP('lessMuddled', v)} color="negative" />
              <Chip label="Intensity" checked={form.flavorProfile.lessIntensity ?? false} onChange={(v) => setFP('lessIntensity', v)} color="negative" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Suggested Change for Next Brew</label>
              <MicButton onResult={(t) => setFP('suggestedChange', t)} />
            </div>
            <textarea
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
              value={form.flavorProfile.suggestedChange}
              onChange={(e) => setFP('suggestedChange', e.target.value)}
              rows={2}
              placeholder="e.g. Grind finer by 1 click, increase water temp to 208°F..."
            />
          </div>
        </Card>

        {/* ── Save as Recipe ─────────────────────────────────── */}
        <Card className="p-5 flex flex-col gap-4">
          <Toggle
            label="Save as a Named Recipe"
            checked={saveAsRecipe}
            onChange={setSaveAsRecipe}
            description="Add this brew's parameters to your Saved Recipes library"
          />
          {saveAsRecipe && (
            <div className="flex flex-col gap-3 pt-1 border-t border-brew-border">
              <Input
                label="Recipe Name *"
                value={recipeSaveName}
                onChange={(e) => setRecipeSaveName(e.target.value)}
                placeholder="e.g. Hoffmann V60, Scott Rao Espresso"
              />
              <Input
                label="Source / Author"
                value={recipeSaveSource}
                onChange={(e) => setRecipeSaveSource(e.target.value)}
                placeholder="e.g. James Hoffmann, personal"
              />
            </div>
          )}
        </Card>

        {/* ── Go-To Recipe ──────────────────────────────────── */}
        <Card className="p-5">
          <Toggle
            label="Mark as Go-To Recipe"
            checked={form.isGoToRecipe}
            onChange={(v) => set('isGoToRecipe', v)}
            description="Save this brew as a reference recipe for this coffee"
          />
        </Card>

        </>} {/* end showAdvanced */}

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <Button type="submit" size="lg">
            <Star size={14} /> {isEdit ? 'Save Changes' : 'Save Brew'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
