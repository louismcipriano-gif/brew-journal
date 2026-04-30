/**
 * MOCKUP — Side-by-side brew comparison
 * Uses hardcoded sample data to demonstrate the UI concept.
 */

import { useState } from 'react';
import { ArrowLeft, Minus, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionTitle, ScoreRing, Badge } from '../components/ui';

// ── Mock data ─────────────────────────────────────────────────────────────────

const BREW_A = {
  label: 'Brew A',
  date: 'Apr 22, 2026',
  coffee: 'Ethiopia Yirgacheffe',
  roaster: 'Subtext Coffee',
  processing: 'Washed',
  roastLevel: 'Light',
  daysOffRoast: 14,
  // Setup
  device: 'Orea Z1',
  filter: 'Sibarist Z1',
  bypass: 'No Bypass',
  shape: 'Flat',
  grinder: 'Timemore Sculptor 078',
  grindSetting: 7.5,
  grindSize: 'Medium Fine',
  // Recipe
  dose: 15,
  water: 250,
  ratio: '1:16.7',
  tempF: 205,
  tempC: 96,
  ppm: 60,
  // Pour over
  pours: 3,
  bloom: 50,
  bloomRatio: '3.3×',
  bloomTime: '0:45',
  brewTime: '3:10',
  pourHeight: 'Medium',
  pourSpeed: 'Combination',
  pourSpeedMlS: '2–10 ml/s',
  agitation: 'Low',
  melodrip: true,
  doubleBloom: false,
  varyingPourSpeed: true,
  // Flavor
  score: 8.2,
  acidity: 8,
  sweetness: 7,
  body: 5,
  florality: 8,
  clarity: 9,
  juiciness: 7,
  finish: 8,
  astringency: 1,
  sourness: 1,
  notes: 'Jasmine, lemon curd, peach, clean finish',
  extraction: 'Balanced',
};

const BREW_B = {
  label: 'Brew B',
  date: 'Apr 24, 2026',
  coffee: 'Ethiopia Yirgacheffe',
  roaster: 'Subtext Coffee',
  processing: 'Washed',
  roastLevel: 'Light',
  daysOffRoast: 16,
  // Setup
  device: 'Orea Z1',
  filter: 'Sibarist Z1',
  bypass: 'No Bypass',
  shape: 'Flat',
  grinder: 'Timemore Sculptor 078',
  grindSetting: 8.5,
  grindSize: 'Medium',
  // Recipe
  dose: 15,
  water: 250,
  ratio: '1:16.7',
  tempF: 203,
  tempC: 95,
  ppm: 60,
  // Pour over
  pours: 4,
  bloom: 50,
  bloomRatio: '3.3×',
  bloomTime: '0:45',
  brewTime: '3:45',
  pourHeight: 'Medium',
  pourSpeed: 'Medium',
  pourSpeedMlS: '4–6 ml/s',
  agitation: 'Medium',
  melodrip: false,
  doubleBloom: false,
  varyingPourSpeed: false,
  // Flavor
  score: 7.4,
  acidity: 6,
  sweetness: 8,
  body: 6,
  florality: 6,
  clarity: 6,
  juiciness: 8,
  finish: 7,
  astringency: 2,
  sourness: 2,
  notes: 'Stone fruit, honey, slightly muddy, gentle sweetness',
  extraction: 'Balanced',
};

// ── Delta helpers ─────────────────────────────────────────────────────────────

type Delta = 'same' | 'a-better' | 'b-better' | 'diff';

function numDelta(a: number, b: number, lowerIsBetter = false): Delta {
  if (a === b) return 'same';
  const aBetter = lowerIsBetter ? a < b : a > b;
  return aBetter ? 'a-better' : 'b-better';
}

function strDelta(a: string | number | boolean, b: string | number | boolean): Delta {
  return a === b ? 'same' : 'diff';
}

// ── Row component ─────────────────────────────────────────────────────────────

function Row({
  label,
  a,
  b,
  delta,
  format,
}: {
  label: string;
  a: string | number;
  b: string | number;
  delta: Delta;
  format?: (v: string | number) => string;
}) {
  const fmt = format ?? ((v) => String(v));
  const aStr = fmt(a);
  const bStr = fmt(b);
  const same = delta === 'same';

  const aClass = delta === 'a-better'
    ? 'text-brew-positive font-semibold'
    : delta === 'b-better'
    ? 'text-brew-muted'
    : 'text-brew-text';

  const bClass = delta === 'b-better'
    ? 'text-brew-positive font-semibold'
    : delta === 'a-better'
    ? 'text-brew-muted'
    : 'text-brew-text';

  return (
    <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2 border-b border-brew-border/40 last:border-0`}>
      <span className="text-xs text-brew-faint">{label}</span>
      <span className={`text-sm text-right min-w-[80px] ${aClass}`}>{aStr}</span>
      <span className={`text-sm text-right min-w-[80px] ${bClass}`}>{bStr}</span>
      <span className="w-5 flex justify-center">
        {same
          ? <Minus size={12} className="text-brew-border" />
          : delta === 'a-better'
          ? <TrendingUp size={12} className="text-brew-positive" />
          : delta === 'b-better'
          ? <TrendingDown size={12} className="text-brew-positive rotate-180" style={{ transform: 'scaleX(-1)' }} />
          : <div className="w-2 h-2 rounded-full bg-brew-primary/40" />}
      </span>
    </div>
  );
}

// ── Flavor bar ────────────────────────────────────────────────────────────────

function FlavorRow({
  label,
  a,
  b,
  negative = false,
}: {
  label: string;
  a: number;
  b: number;
  negative?: boolean;
}) {
  const delta = numDelta(a, b, negative);
  const color = negative ? '#9b3328' : '#2d6e4e';
  const trackColor = '#e5ddd0';

  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-brew-border/40 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-brew-faint">{label}</span>
        <div className="flex items-center gap-3">
          {delta !== 'same' && (
            <span className={`text-xs font-medium ${delta === 'a-better' ? 'text-brew-positive' : 'text-brew-muted'}`}>
              {a > b ? `A +${a - b}` : `B +${b - a}`}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* A bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: trackColor }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${a * 10}%`,
                background: delta === 'a-better' ? color : delta === 'b-better' ? '#b0a090' : '#5a3820',
              }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums w-4 text-right"
            style={{ color: delta === 'a-better' ? color : delta === 'b-better' ? '#b0a090' : '#5a3820' }}>
            {a}
          </span>
        </div>
        {/* B bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: trackColor }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${b * 10}%`,
                background: delta === 'b-better' ? color : delta === 'a-better' ? '#b0a090' : '#5a3820',
              }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums w-4 text-right"
            style={{ color: delta === 'b-better' ? color : delta === 'a-better' ? '#b0a090' : '#5a3820' }}>
            {b}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Compare() {
  const navigate = useNavigate();
  const [selectedA] = useState('brew-a');
  const [selectedB] = useState('brew-b');

  const A = BREW_A;
  const B = BREW_B;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-brew-muted hover:text-brew-text transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="font-display italic text-brew-text text-2xl leading-tight">Compare Brews</h1>
        <Badge variant="amber">Mockup</Badge>
      </div>

      {/* Brew selectors */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Brew A', value: selectedA, brew: A },
          { label: 'Brew B', value: selectedB, brew: B },
        ].map(({ label, brew }) => (
          <Card key={label} className="p-4 flex flex-col gap-1">
            <p className="text-xs font-medium text-brew-muted uppercase tracking-wider mb-2">{label}</p>
            {/* In real version: dropdown to pick any brew */}
            <select
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none"
              defaultValue={brew.date}
            >
              <option>{brew.date} — {brew.coffee}</option>
            </select>
            <div className="flex items-center gap-2 mt-2">
              <ScoreRing score={brew.score} size={40} />
              <div>
                <p className="text-sm font-medium text-brew-text">{brew.coffee}</p>
                <p className="text-xs text-brew-faint">{brew.roaster} · {brew.date} · {brew.daysOffRoast}d off roast</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4">
        <span />
        <span className="text-xs font-bold text-brew-primary min-w-[80px] text-right">Brew A</span>
        <span className="text-xs font-bold text-brew-muted min-w-[80px] text-right">Brew B</span>
        <span className="w-5" />
      </div>

      {/* Grind & Setup */}
      <Card className="p-5 flex flex-col gap-0">
        <SectionTitle>Grind & Setup</SectionTitle>
        <Row label="Device"        a={A.device}       b={B.device}       delta={strDelta(A.device, B.device)} />
        <Row label="Filter"        a={A.filter}       b={B.filter}       delta={strDelta(A.filter, B.filter)} />
        <Row label="Bypass"        a={A.bypass}       b={B.bypass}       delta={strDelta(A.bypass, B.bypass)} />
        <Row label="Shape"         a={A.shape}        b={B.shape}        delta={strDelta(A.shape, B.shape)} />
        <Row label="Grinder"       a="078"            b="078"            delta="same" />
        <Row label="Grind Setting" a={A.grindSetting} b={B.grindSetting} delta={strDelta(A.grindSetting, B.grindSetting)} />
        <Row label="Grind Size"    a={A.grindSize}    b={B.grindSize}    delta={strDelta(A.grindSize, B.grindSize)} />
      </Card>

      {/* Recipe Parameters */}
      <Card className="p-5 flex flex-col gap-0">
        <SectionTitle>Recipe Parameters</SectionTitle>
        <Row label="Coffee Dose"   a={`${A.dose}g`}   b={`${B.dose}g`}   delta={strDelta(A.dose, B.dose)} />
        <Row label="Water"         a={`${A.water}g`}  b={`${B.water}g`}  delta={strDelta(A.water, B.water)} />
        <Row label="Brew Ratio"    a={A.ratio}        b={B.ratio}        delta={strDelta(A.ratio, B.ratio)} />
        <Row label="Water Temp"    a={`${A.tempF}°F / ${A.tempC}°C`} b={`${B.tempF}°F / ${B.tempC}°C`} delta={strDelta(A.tempF, B.tempF)} />
        <Row label="Water PPM"     a={`${A.ppm} ppm`} b={`${B.ppm} ppm`} delta={strDelta(A.ppm, B.ppm)} />
      </Card>

      {/* Pour Over Details */}
      <Card className="p-5 flex flex-col gap-0">
        <SectionTitle>Pour Over Details</SectionTitle>
        <Row label="Total Pours"       a={A.pours}           b={B.pours}           delta={strDelta(A.pours, B.pours)} />
        <Row label="Bloom"             a={`${A.bloom}g (${A.bloomRatio})`} b={`${B.bloom}g (${B.bloomRatio})`} delta="same" />
        <Row label="Bloom Time"        a={A.bloomTime}       b={B.bloomTime}       delta={strDelta(A.bloomTime, B.bloomTime)} />
        <Row label="Total Brew Time"   a={A.brewTime}        b={B.brewTime}        delta={strDelta(A.brewTime, B.brewTime)} />
        <Row label="Pour Height"       a={A.pourHeight}      b={B.pourHeight}      delta={strDelta(A.pourHeight, B.pourHeight)} />
        <Row label="Pour Speed"        a={A.pourSpeed}       b={B.pourSpeed}       delta={strDelta(A.pourSpeed, B.pourSpeed)} />
        <Row label="Pour Speed ml/s"   a={A.pourSpeedMlS}    b={B.pourSpeedMlS}    delta={strDelta(A.pourSpeedMlS, B.pourSpeedMlS)} />
        <Row label="Agitation"         a={A.agitation}       b={B.agitation}       delta={strDelta(A.agitation, B.agitation)} />
        <Row label="Melodrip"          a={A.melodrip ? 'Yes' : 'No'} b={B.melodrip ? 'Yes' : 'No'} delta={strDelta(A.melodrip, B.melodrip)} />
        <Row label="Varying Pour Speed" a={A.varyingPourSpeed ? 'Yes' : 'No'} b={B.varyingPourSpeed ? 'Yes' : 'No'} delta={strDelta(A.varyingPourSpeed, B.varyingPourSpeed)} />
      </Card>

      {/* Flavor Profile */}
      <Card className="p-5 flex flex-col gap-3">
        <SectionTitle>Flavor Profile</SectionTitle>

        {/* Score comparison */}
        <div className="grid grid-cols-2 gap-4 pb-3 border-b border-brew-border">
          {[A, B].map((brew) => (
            <div key={brew.label} className="flex items-center gap-3">
              <ScoreRing score={brew.score} size={52} />
              <div className="flex flex-col gap-1 flex-1">
                <p className="text-xs text-brew-faint">{brew.extraction}</p>
                <p className="text-xs text-brew-muted leading-snug">{brew.notes}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Column sub-headers */}
        <div className="grid grid-cols-2 gap-3">
          <span className="text-xs font-bold text-brew-primary text-center">Brew A</span>
          <span className="text-xs font-bold text-brew-muted text-center">Brew B</span>
        </div>

        <FlavorRow label="Acidity"     a={A.acidity}     b={B.acidity} />
        <FlavorRow label="Sweetness"   a={A.sweetness}   b={B.sweetness} />
        <FlavorRow label="Body"        a={A.body}        b={B.body} />
        <FlavorRow label="Florality"   a={A.florality}   b={B.florality} />
        <FlavorRow label="Clarity"     a={A.clarity}     b={B.clarity} />
        <FlavorRow label="Juiciness"   a={A.juiciness}   b={B.juiciness} />
        <FlavorRow label="Finish"      a={A.finish}      b={B.finish} />
        <FlavorRow label="Astringency" a={A.astringency} b={B.astringency} negative />
        <FlavorRow label="Sourness"    a={A.sourness}    b={B.sourness}    negative />
      </Card>

      {/* AI Insights */}
      <Card className="p-5 flex flex-col gap-4 border-brew-primary/20 bg-brew-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brew-primary-light" />
          <SectionTitle>Key Differences</SectionTitle>
        </div>
        <p className="text-xs text-brew-faint -mt-3">What actually changed between these two brews</p>

        <div className="flex flex-col gap-3">
          {[
            {
              icon: '🎯',
              text: 'Brew A scored 0.8 pts higher. The main drivers were clarity (+3) and florality (+2).',
              tag: 'Score',
              color: 'text-brew-positive',
            },
            {
              icon: '💧',
              text: 'Melodrip + combination pour speed (2–10 ml/s) in Brew A vs steady medium pour in Brew B — likely the biggest factor in clarity difference.',
              tag: 'Technique',
              color: 'text-brew-primary-light',
            },
            {
              icon: '⚙️',
              text: 'Brew B was 1 step coarser (8.5 vs 7.5) and ran 35 seconds longer — correlates with more body and sweetness but less clarity.',
              tag: 'Grind',
              color: 'text-brew-primary-light',
            },
            {
              icon: '🌡️',
              text: 'Temperature was 2°F lower in Brew B (203 vs 205°F) — minor impact, likely not the deciding factor here.',
              tag: 'Temp',
              color: 'text-brew-muted',
            },
          ].map((insight) => (
            <div key={insight.tag} className="flex gap-3 items-start">
              <span className="text-base flex-shrink-0">{insight.icon}</span>
              <div className="flex flex-col gap-0.5">
                <span className={`text-xs font-semibold uppercase tracking-wide ${insight.color}`}>{insight.tag}</span>
                <p className="text-sm text-brew-text leading-relaxed">{insight.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-brew-border/40">
          <p className="text-xs text-brew-faint italic">
            In the real version, insights are generated by Claude based on your full brew history — not just these two brews.
          </p>
        </div>
      </Card>

      <div className="pb-8" />
    </div>
  );
}
