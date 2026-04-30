import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Sparkles, Loader2, Trophy,
  ToggleLeft, ToggleRight, GitCompare, FlaskConical,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Card, SectionTitle, ScoreRing, Button, Slider } from '../components/ui';
import { calcBrewScore, daysOffRoast, formatDate, brewRatio, fToC } from '../utils';
import type { Brew, FlavorProfile, PerceivedExtraction } from '../types';
import { getApiKey } from './Settings';

// ── Constants ──────────────────────────────────────────────────────────────────

const SLOT_COLORS = ['#5a3820', '#2d6e4e', '#b8920a', '#9b3328'];
const SLOT_LABELS = ['Brew A', 'Brew B', 'Brew C', 'Brew D'];
const MAX_SLOTS = 4;

const FLAVOR_DIMS = [
  { key: 'acidity',   label: 'Acidity'   },
  { key: 'sweetness', label: 'Sweetness' },
  { key: 'body',      label: 'Body'      },
  { key: 'florality', label: 'Florality' },
  { key: 'clarity',   label: 'Clarity'   },
  { key: 'juiciness', label: 'Juiciness' },
  { key: 'finish',    label: 'Finish'    },
] as const;

const NEG_DIMS = ['astringency', 'sourness'] as const;

const defaultFP = (): FlavorProfile => ({
  acidity: 5, sweetness: 5, body: 5, florality: 5,
  clarity: 5, juiciness: 5, finish: 5,
  astringency: 0, sourness: 0,
  flavorNotes: '', perceivedExtraction: 'Balanced',
  moreAcidity: false, moreSweetness: false, moreClarity: false,
  moreFlorality: false, moreBody: false, lessBitterness: false,
  lessAstringency: false, lessSourness: false, suggestedChange: '',
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface CuppingSlot {
  coffeeId: string;
  brewMethod: string;
  brewingDevice: string;
  grindSetting: number;
  grindSize: string;
  coffeeDose: number;
  waterAmount: number;
  waterTempF: number;
  waterPPM: number;
  brewRecipeName: string;
  flavorProfile: FlavorProfile;
  brewDate: string;
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

function numDelta(a: number, b: number, lowerBetter = false): string {
  const d = b - a;
  if (d === 0) return '';
  const better = lowerBetter ? d < 0 : d > 0;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d % 1 === 0 ? d : d.toFixed(1)}${better ? '' : ''}`;
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
  if (allSame && values.length === 2) return null; // filtered by showDiffsOnly upstream

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
      {/* Delta col — only for exactly 2 brews */}
      <span className="text-xs text-right text-brew-faint">
        {numeric && values.length === 2 && nums[0] !== nums[1]
          ? <span className={nums[1] > nums[0] !== lowerBetter ? 'text-brew-positive' : 'text-brew-muted'}>
              {numDelta(nums[0], nums[1], lowerBetter)}{unit}
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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Compare() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, addBrew, getCoffee } = useApp();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

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

  // ── New cupping mode ───────────────────────────────────────────────────────
  const blankSlot = (): CuppingSlot => ({
    coffeeId: '', brewMethod: 'Pour Over', brewingDevice: '',
    grindSetting: 0, grindSize: '', coffeeDose: 15,
    waterAmount: 250, waterTempF: 205, waterPPM: 60,
    brewRecipeName: '', flavorProfile: defaultFP(),
    brewDate: new Date().toISOString().split('T')[0],
  });

  const [slots, setSlots] = useState<CuppingSlot[]>([blankSlot(), blankSlot()]);

  function addSlot() { if (slots.length < MAX_SLOTS) setSlots([...slots, blankSlot()]); }
  function removeSlot(i: number) { setSlots(slots.filter((_, idx) => idx !== i)); }
  function updateSlot(i: number, patch: Partial<CuppingSlot>) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function updateFP(i: number, k: keyof FlavorProfile, v: any) {
    setSlots(slots.map((s, idx) =>
      idx === i ? { ...s, flavorProfile: { ...s.flavorProfile, [k]: v } } : s
    ));
  }
  function copyParamsToAll(fromIdx: number) {
    const src = slots[fromIdx];
    setSlots(slots.map((s, i) => i === fromIdx ? s : {
      ...s,
      brewMethod: src.brewMethod,
      brewingDevice: src.brewingDevice,
      coffeeDose: src.coffeeDose,
      waterAmount: src.waterAmount,
      waterTempF: src.waterTempF,
      waterPPM: src.waterPPM,
      brewRecipeName: src.brewRecipeName,
    }));
  }

  function handleSaveAll() {
    if (slots.some((s) => !s.coffeeId)) { alert('Please select a coffee for each brew.'); return; }
    slots.forEach((s) => {
      const score = calcBrewScore(s.flavorProfile);
      addBrew({
        coffeeId: s.coffeeId,
        brewDate: s.brewDate,
        brewMethod: s.brewMethod as any,
        grinder: '', grindSetting: s.grindSetting, grindSize: s.grindSize,
        brewingDevice: s.brewingDevice, filter: '', coffeeDose: s.coffeeDose,
        waterAmount: s.waterAmount, waterTempF: s.waterTempF,
        waterPPM: s.waterPPM, waterRecipe: '', apaxDropsUsed: false, apaxDrops: {},
        brewRecipeName: s.brewRecipeName, brewRecipeDetails: '',
        flavorProfile: s.flavorProfile,
        brewScore: score,
        brewRatio: s.coffeeDose > 0 ? Math.round((s.waterAmount / s.coffeeDose) * 100) / 100 : undefined,
        isGoToRecipe: false, isQuickLog: false,
        coffeeProcessingMethod: getCoffee(s.coffeeId)?.processingMethod,
        coffeeVarietal: getCoffee(s.coffeeId)?.varietal,
        coffeeOrigin: getCoffee(s.coffeeId)?.countryOrigin,
        coffeeRegion: getCoffee(s.coffeeId)?.region,
        coffeeRoastLevel: getCoffee(s.coffeeId)?.roastLevel,
      });
    });
    alert(`${slots.length} brews saved to your journal.`);
    setSlots([blankSlot(), blankSlot()]);
  }

  // ── Brew data for comparison view ──────────────────────────────────────────
  type CompBrew = {
    label: string; color: string; score: number;
    coffee?: ReturnType<typeof getCoffee>;
    fp: FlavorProfile;
    date: string;
    // params
    device: string; filter: string; bypass: string; shape: string;
    grinder: string; grindSetting: number; grindSize: string;
    dose: number; water: number; ratio: string; tempF: number; tempC: number; ppm: number;
    pours?: number; bloom?: number; bloomTime?: number; brewTime?: number;
    pourHeight?: string; pourSpeed?: string; pourSpeedMlS?: string;
    agitation?: string; melodrip?: boolean; doubleBloom?: boolean; varyingPourSpeed?: boolean;
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
        device: s.brewingDevice || '—', filter: '—', bypass: '—', shape: '—',
        grinder: '—', grindSetting: s.grindSetting,
        grindSize: s.grindSize || '—',
        dose: s.coffeeDose, water: s.waterAmount,
        ratio: brewRatio(s.waterAmount, s.coffeeDose),
        tempF: s.waterTempF, tempC: fToC(s.waterTempF), ppm: s.waterPPM,
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
    try {
      const summary = compBrews.map((b) => `
${b.label} (${b.date}) — Score: ${b.score.toFixed(1)}
Coffee: ${b.coffee?.roaster ?? '?'} ${b.coffee?.coffeeName ?? '?'} | ${b.coffee?.processingMethod ?? '?'} | ${b.coffee?.roastLevel ?? '?'}
Device: ${b.device} | Grind: ${b.grindSetting} (${b.grindSize}) | ${b.dose}g : ${b.water}g | ${b.tempF}°F
Flavor: Acidity ${b.fp.acidity} | Sweetness ${b.fp.sweetness} | Body ${b.fp.body} | Clarity ${b.fp.clarity} | Florality ${b.fp.florality} | Juiciness ${b.fp.juiciness} | Finish ${b.fp.finish} | Astringency ${b.fp.astringency} | Sourness ${b.fp.sourness}
Notes: ${b.fp.flavorNotes || '—'} | Extraction: ${b.fp.perceivedExtraction}
`).join('\n---\n');

      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `You are a specialty coffee expert analyzing a side-by-side brew comparison. Give 3-4 specific, actionable insights about what drove the differences in score and flavor. Be concise and direct — name the variable, explain the likely effect. Reference brew labels (Brew A, Brew B, etc.) and specific numbers.

Comparison data:
${summary}

Return a JSON array of insight strings, e.g. ["Brew A scored higher because...", "The coarser grind in Brew B..."]
Return ONLY the JSON array, no markdown.`,
          }],
        }),
      });
      const d = await resp.json();
      const text = d.content?.[0]?.text ?? '[]';
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      setAiInsights(JSON.parse(cleaned));
    } catch (e: any) {
      alert('Could not generate insights: ' + e.message);
    } finally {
      setLoadingInsights(false);
    }
  }

  // ── Radar data ─────────────────────────────────────────────────────────────
  const radarData = FLAVOR_DIMS.map(({ key, label }) => {
    const entry: Record<string, any> = { attr: label };
    compBrews.forEach((b) => { entry[b.label] = (b.fp as any)[key]; });
    return entry;
  });

  // ── Check if all values same (for diffs-only filter) ──────────────────────
  function allSame(vals: (string | number | undefined)[]) {
    const d = vals.filter(v => v !== undefined && v !== '' && v !== 0 && v !== '—');
    return d.length > 0 && d.every(v => v === d[0]);
  }

  function rowVisible(vals: (string | number | undefined)[]) {
    return !showDiffsOnly || !allSame(vals);
  }

  // ── Brew options for selectors ─────────────────────────────────────────────
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
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-brew-muted hover:text-brew-text transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="font-display italic text-brew-text text-2xl leading-tight">Compare Brews</h1>
        </div>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-brew-border overflow-hidden text-sm">
          {([['existing', GitCompare, 'Compare Existing'], ['new', FlaskConical, 'New Cupping']] as const).map(([m, Icon, lbl]) => (
            <button key={m} onClick={() => setMode(m as any)}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${mode === m ? 'bg-brew-primary/15 text-brew-primary-light font-medium' : 'text-brew-muted hover:text-brew-text'}`}>
              <Icon size={13} />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── EXISTING MODE: brew selectors ───────────────────────────── */}
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
                <select
                  value={id}
                  onChange={(e) => setExistingId(i, e.target.value)}
                  className="flex-1 bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none"
                >
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

      {/* ── NEW CUPPING MODE: slot forms ────────────────────────────── */}
      {mode === 'new' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-brew-muted">Fill in each cup — parameters can be shared, flavors are individual.</p>
            <div className="flex items-center gap-2">
              {slots.length < MAX_SLOTS && (
                <button onClick={addSlot}
                  className="flex items-center gap-1 text-xs text-brew-primary hover:text-brew-primary-light transition-colors">
                  <Plus size={12} /> Add Cup
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid gap-3 min-w-[320px]" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(280px, 1fr))` }}>
              {slots.map((slot, i) => (
                <Card key={i} className="p-4 flex flex-col gap-4">
                  {/* Slot header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: SLOT_COLORS[i] }}>{SLOT_LABELS[i]}</span>
                    <div className="flex gap-2">
                      {i > 0 && (
                        <button onClick={() => copyParamsToAll(0)}
                          className="text-xs text-brew-faint hover:text-brew-muted transition-colors">
                          Copy A's params
                        </button>
                      )}
                      {slots.length > 2 && (
                        <button onClick={() => removeSlot(i)} className="text-brew-faint hover:text-brew-negative transition-colors">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Coffee */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Coffee</label>
                    <select
                      value={slot.coffeeId}
                      onChange={(e) => updateSlot(i, { coffeeId: e.target.value })}
                      className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none"
                    >
                      <option value="">— Select coffee —</option>
                      {data.coffees.map((c) => (
                        <option key={c.id} value={c.id}>{c.roaster} — {c.coffeeName || c.countryOrigin}</option>
                      ))}
                    </select>
                  </div>

                  {/* Key params */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Dose (g)', key: 'coffeeDose', step: 0.5 },
                      { label: 'Water (g)', key: 'waterAmount', step: 1 },
                      { label: 'Temp (°F)', key: 'waterTempF', step: 1 },
                      { label: 'PPM', key: 'waterPPM', step: 5 },
                    ].map(({ label, key, step }) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-xs text-brew-faint">{label}</label>
                        <input
                          type="number" step={step}
                          value={(slot as any)[key] || ''}
                          onChange={(e) => updateSlot(i, { [key]: parseFloat(e.target.value) || 0 } as any)}
                          className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text focus:outline-none focus:border-brew-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-brew-faint">Recipe Name</label>
                    <input
                      type="text" value={slot.brewRecipeName}
                      onChange={(e) => updateSlot(i, { brewRecipeName: e.target.value })}
                      placeholder="e.g. Hoffmann 4-6"
                      className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary"
                    />
                  </div>

                  {/* Flavor profile */}
                  <div className="border-t border-brew-border pt-3 flex flex-col gap-2">
                    <p className="text-xs font-medium text-brew-muted uppercase tracking-wider">Flavor</p>
                    {FLAVOR_DIMS.map(({ key, label }) => (
                      <Slider
                        key={key} label={label}
                        value={(slot.flavorProfile as any)[key]}
                        onChange={(v) => updateFP(i, key as keyof FlavorProfile, v)}
                      />
                    ))}
                    {NEG_DIMS.map((key) => (
                      <Slider
                        key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}
                        value={(slot.flavorProfile as any)[key]}
                        onChange={(v) => updateFP(i, key as keyof FlavorProfile, v)}
                        negative
                      />
                    ))}
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="text-xs text-brew-faint">Tasting Notes</label>
                      <textarea
                        value={slot.flavorProfile.flavorNotes}
                        onChange={(e) => updateFP(i, 'flavorNotes', e.target.value)}
                        rows={2}
                        placeholder="jasmine, lemon, peach..."
                        className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-xs text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary resize-none"
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      {(['Under', 'Balanced', 'Over'] as PerceivedExtraction[]).map((v) => (
                        <button key={v} type="button"
                          onClick={() => updateFP(i, 'perceivedExtraction', v)}
                          className={`flex-1 py-1 rounded text-xs font-medium border transition-all ${
                            slot.flavorProfile.perceivedExtraction === v
                              ? v === 'Balanced' ? 'bg-brew-positive/20 border-brew-positive text-brew-positive'
                              : v === 'Over' ? 'bg-brew-negative/20 border-brew-negative text-brew-negative'
                              : 'bg-brew-primary/20 border-brew-primary text-brew-primary-light'
                              : 'border-brew-border text-brew-faint'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveAll} size="lg">
              Save All {slots.length} Brews to Journal
            </Button>
          </div>
        </div>
      )}

      {/* ── COMPARISON VIEW (both modes) ────────────────────────────── */}
      {hasData && (
        <>
          {/* Rank bar */}
          {compBrews.length >= 2 && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-brew-gold" />
                  <span className="text-sm font-semibold text-brew-text">Ranking</span>
                </div>
                <RankBar brews={compBrews.map((b) => ({ label: b.label, score: b.score, color: b.color }))} />
              </div>
            </Card>
          )}

          {/* AI Insights */}
          <Card className="p-5 flex flex-col gap-4 border-brew-primary/20 bg-brew-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brew-primary-light" />
                <SectionTitle>AI Insights</SectionTitle>
              </div>
              <Button variant="secondary" size="sm" onClick={generateInsights} disabled={loadingInsights}>
                {loadingInsights ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : 'Generate Insights'}
              </Button>
            </div>
            {aiInsights.length > 0 ? (
              <div className="flex flex-col gap-3">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-brew-primary text-sm font-bold flex-shrink-0">{i + 1}.</span>
                    <p className="text-sm text-brew-text leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brew-faint">
                Hit Generate Insights to have Claude analyze what drove the differences between these brews.
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
                  {b.label}
                  <br />
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
            </Card>
          )}

          {/* Flavor Profile */}
          <Card className="p-5 flex flex-col gap-4">
            <SectionTitle>Flavor Profile</SectionTitle>

            {/* Scores */}
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

            {/* Radar (3-4 brews) or bars (2 brews) */}
            {compBrews.length >= 3 ? (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5ddd0" />
                  <PolarAngleAxis dataKey="attr" tick={{ fontSize: 11, fill: '#8a7a6a' }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
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
                              <div className="h-full rounded-full" style={{
                                width: `${v * 10}%`,
                                background: i === bi ? '#2d6e4e' : '#b0a090',
                              }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums w-4 text-right"
                              style={{ color: i === bi ? '#2d6e4e' : '#b0a090' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Negative dims */}
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
                              <div className="h-full rounded-full" style={{
                                width: `${v * 10}%`,
                                background: i === bi ? '#2d6e4e' : '#9b3328',
                              }} />
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
        </>
      )}

      {/* Empty state */}
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
          <p className="text-brew-muted text-sm">Or switch to New Cupping to log fresh brews side by side.</p>
        </Card>
      )}

      <div className="pb-8" />
    </div>
  );
}
