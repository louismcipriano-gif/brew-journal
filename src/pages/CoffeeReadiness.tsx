import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Snowflake } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, EmptyState } from '../components/ui';
import { Coffee } from 'lucide-react';
import type { Coffee as CoffeeType } from '../types';

// ── Stage definitions ─────────────────────────────────────────────────────────

type Stage = 'pre-roast' | 'resting' | 'ready' | 'peaking' | 'past-peak';

// 4 visible stages, each in a completely different hue family:
//   Blue (resting) → Mint (ready) → Gold (peaking ★) → Coral (past-peak)
const STAGE_CONFIG: Record<Stage, {
  label: string;
  short: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}> = {
  'pre-roast': { label: 'Pre-Roast', short: 'pre',  bg: 'bg-slate-900/50',   text: 'text-slate-500',   border: 'border-slate-700/40',   dot: '#64748b' },
  'resting':   { label: 'Resting',   short: 'rest', bg: 'bg-blue-950/70',    text: 'text-blue-300',    border: 'border-blue-700/50',    dot: '#60a5fa' },
  'ready':     { label: 'Ready',     short: 'rdy',  bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-700/50', dot: '#86efac' },
  'peaking':   { label: 'Peaking',   short: 'PEAK', bg: 'bg-amber-900/60',   text: 'text-amber-200',   border: 'border-amber-500/60',   dot: '#fbbf24' },
  'past-peak': { label: 'Past Peak', short: 'past', bg: 'bg-rose-950/70',    text: 'text-rose-300',    border: 'border-rose-700/50',    dot: '#f87171' },
};

const STAGE_PRIORITY: Record<Stage, number> = {
  'peaking': 0, 'ready': 1, 'past-peak': 2, 'resting': 3, 'pre-roast': 4,
};

const STAGE_ORDER: Stage[] = ['resting', 'ready', 'peaking', 'past-peak'];

function isDrinkable(s: Stage) {
  return s === 'ready' || s === 'peaking' || s === 'past-peak';
}

function isOptimal(s: Stage) {
  return s === 'ready' || s === 'peaking';
}

// ── Brewing window defaults ───────────────────────────────────────────────────

const BREW_WINDOW_DEFAULTS: Record<string, { start: number; peakMin: number; peakMax: number }> = {
  'Ultra Light': { start: 2.5, peakMin: 3.5, peakMax: 8   },
  'Light':        { start: 2,   peakMin: 3,   peakMax: 6   },
  'Light-Medium': { start: 1.5, peakMin: 2.5, peakMax: 5   },
  'Medium':       { start: 1,   peakMin: 2,   peakMax: 4   },
  'Medium-Dark':  { start: 0.5, peakMin: 1,   peakMax: 2.5 },
  'Dark':         { start: 0.3, peakMin: 0.5, peakMax: 1.5 },
};

function getWindow(c: CoffeeType) {
  const def = BREW_WINDOW_DEFAULTS[c.roastLevel] ?? BREW_WINDOW_DEFAULTS['Light'];
  return {
    start:   c.brewWindowStart   ?? def.start,
    peakMin: c.brewWindowPeakMin ?? def.peakMin,
    peakMax: c.brewWindowPeakMax ?? def.peakMax,
  };
}

// Approaching → resting, finish-soon → past-peak (collapsed into 4 stages)
function getStage(days: number, c: CoffeeType): Stage {
  if (days < 0) return 'pre-roast';
  const { start, peakMin, peakMax } = getWindow(c);
  const peakMid = peakMin + (peakMax - peakMin) * 0.5;
  if (days < start   * 7) return 'resting';
  if (days < peakMid * 7) return 'ready';    // start → midpoint (was approaching + ready)
  if (days < peakMax * 7) return 'peaking';  // midpoint → peakMax
  return 'past-peak';                         // everything after (was past-peak + finish-soon)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function getWeekStarts(count: number): Date[] {
  const monday = getMondayOfWeek(new Date());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    return d;
  });
}

function daysOffRoastAt(roastDate: string, atDate: Date): number {
  const roast = new Date(roastDate + 'T00:00:00');
  return Math.floor((atDate.getTime() - roast.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtWeeks(days: number): string {
  const w = Math.round((days / 7) * 10) / 10;
  return `${w}w`;
}

function formatWeekLabel(date: Date, index: number): { primary: string; secondary?: string } {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const label = date.toLocaleDateString('en-US', opts);
  if (index === 0) return { primary: 'This Week', secondary: label };
  if (index === 1) return { primary: 'Next Week', secondary: label };
  return { primary: label };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoffeeReadiness() {
  const { data } = useApp();
  const navigate = useNavigate();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weeks = useMemo(() => getWeekStarts(9), []);

  const activeCoffees = useMemo(() =>
    data.coffees.filter((c) => !c.isFinished && c.roastDate),
    [data.coffees]
  );

  const weekDrinkability = useMemo(() =>
    weeks.map((w) => {
      const stages = activeCoffees.map((c) => getStage(daysOffRoastAt(c.roastDate, w), c));
      return {
        hasPeaking:  stages.some((s) => s === 'peaking'),
        hasReady:    stages.some((s) => s === 'ready'),
        hasPastPeak: stages.some((s) => s === 'past-peak'),
        isDrinkable: stages.some(isDrinkable),
        hasOptimal:  stages.some(isOptimal),
        isEmpty:     !stages.some(isDrinkable),
      };
    }),
    [weeks, activeCoffees]
  );

  const gapWeekLabels = useMemo(() =>
    weeks
      .slice(1)
      .filter((_, i) => weekDrinkability[i + 1].isEmpty)
      .map((w) => w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    [weeks, weekDrinkability]
  );

  const currentWeekStageCounts = useMemo(() => {
    const counts: Partial<Record<Stage, number>> = {};
    activeCoffees.forEach((c) => {
      const s = getStage(daysOffRoastAt(c.roastDate, today), c);
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [activeCoffees, today]);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="font-display italic text-brew-text text-3xl leading-tight">Brewing Calendar</h1>
        <p className="text-brew-muted text-sm mt-1">
          {activeCoffees.length} active coffee{activeCoffees.length !== 1 ? 's' : ''} · 9-week brewing outlook
        </p>
      </div>

      {/* 9-week drinkability bar */}
      {activeCoffees.length > 0 && (
        <div className="flex gap-1">
          {weeks.map((w, i) => {
            const info = weekDrinkability[i];
            const { primary } = formatWeekLabel(w, i);
            const dot = info.hasPeaking  ? STAGE_CONFIG['peaking'].dot
              : info.hasReady    ? STAGE_CONFIG['ready'].dot
              : info.hasPastPeak ? STAGE_CONFIG['past-peak'].dot
              : '#374151';
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div
                  className="w-full h-2 rounded-full"
                  style={{ backgroundColor: info.isEmpty ? '#374151' : dot, opacity: info.isEmpty ? 0.4 : 1 }}
                />
                <span
                  className={`text-center leading-tight ${i === 0 ? 'text-brew-text font-semibold' : info.isEmpty ? 'text-slate-500' : 'text-brew-faint'}`}
                  style={{ fontSize: '9px' }}
                >
                  {i === 0 ? 'Now' : i === 1 ? 'Nxt' : primary}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {STAGE_ORDER.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const isPeaking = stage === 'peaking';
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <div
                className={`rounded-full flex-shrink-0 ${isPeaking ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}
                style={{ backgroundColor: cfg.dot }}
              />
              <span className="text-xs text-brew-muted">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* This-week summary chips */}
      {activeCoffees.length > 0 && Object.keys(currentWeekStageCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER
            .filter((s) => currentWeekStageCounts[s])
            .map((stage) => {
              const count = currentWeekStageCounts[stage]!;
              const cfg = STAGE_CONFIG[stage];
              const isPeaking = stage === 'peaking';
              return (
                <div
                  key={stage}
                  className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${cfg.bg} ${cfg.border} ${isPeaking ? 'ring-1 ring-amber-400/40' : ''}`}
                >
                  <div
                    className={`rounded-full flex-shrink-0 ${isPeaking ? 'w-3 h-3' : 'w-2 h-2'}`}
                    style={{ backgroundColor: cfg.dot }}
                  />
                  <span className={`font-bold ${cfg.text} ${isPeaking ? 'text-base' : 'text-sm'}`}>{count}</span>
                  <span className={`text-xs font-medium ${cfg.text} ${isPeaking ? '' : 'opacity-70'}`}>{cfg.label}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Order alert */}
      {gapWeekLabels.length > 0 && (
        <Card className="p-3.5 flex items-start gap-3 border-amber-700/40 bg-amber-950/20">
          <ShoppingCart size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Consider ordering soon</p>
            <p className="text-xs text-brew-muted mt-0.5">
              No coffees will be in their drinking window during:{' '}
              <span className="text-amber-400/80">{gapWeekLabels.join(', ')}</span>.
              {' '}A coffee ordered today typically needs 2–3 weeks of rest after it arrives.
            </p>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {activeCoffees.length === 0 && (
        <EmptyState
          icon={<Coffee size={36} />}
          title="No active coffees"
          description="Add coffees with roast dates to see their rest windows here."
        />
      )}

      {/* Weekly card stack */}
      {activeCoffees.length > 0 && (
        <div className="flex flex-col gap-3">
          {weeks.map((weekStart, wi) => {
            const { primary, secondary } = formatWeekLabel(weekStart, wi);
            const info = weekDrinkability[wi];
            const isNow = wi === 0;

            const bestStage: Stage = info.hasPeaking  ? 'peaking'
              : info.hasReady    ? 'ready'
              : info.hasPastPeak ? 'past-peak'
              : 'resting';
            const bestCfg = STAGE_CONFIG[bestStage];

            const weekCoffees = [...activeCoffees].sort((a, b) => {
              const sA = getStage(daysOffRoastAt(a.roastDate, weekStart), a);
              const sB = getStage(daysOffRoastAt(b.roastDate, weekStart), b);
              const diff = STAGE_PRIORITY[sA] - STAGE_PRIORITY[sB];
              if (diff !== 0) return diff;
              return daysOffRoastAt(a.roastDate, weekStart) - daysOffRoastAt(b.roastDate, weekStart);
            });

            return (
              <Card
                key={wi}
                className={`overflow-hidden ${
                  info.hasPeaking && isNow ? 'border-amber-500/40' :
                  isNow               ? 'border-brew-primary/30' :
                  info.isEmpty        ? 'border-slate-700/30'    : ''
                }`}
              >
                {/* Week header */}
                <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
                  info.hasPeaking && isNow ? 'bg-amber-950/30 border-amber-700/30' :
                  isNow                   ? 'bg-brew-primary/10 border-brew-primary/20' :
                  info.isEmpty            ? 'bg-slate-800/30 border-slate-700/20' :
                  'bg-brew-card/50 border-brew-border'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      info.hasPeaking && isNow ? 'text-amber-200' :
                      isNow                   ? 'text-brew-primary-light' :
                      info.isEmpty            ? 'text-slate-400' :
                      'text-brew-text'
                    }`}>
                      {primary}
                    </span>
                    {secondary && <span className="text-xs text-brew-faint">{secondary}</span>}
                    {info.isEmpty && wi > 0 && (
                      <span className="text-xs text-slate-500 font-medium">⚠ gap</span>
                    )}
                  </div>

                  {/* Week-level stage pill */}
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                    info.isDrinkable ? `${bestCfg.bg} ${bestCfg.border}` : 'bg-slate-800/40 border-slate-700/30'
                  }`}>
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: info.isDrinkable ? bestCfg.dot : '#475569' }}
                    />
                    <span className={`text-xs font-medium ${info.isDrinkable ? bestCfg.text : 'text-slate-500'}`}>
                      {info.isDrinkable
                        ? info.hasPeaking  ? 'Peaking ★'
                        : info.hasReady    ? 'Ready'
                        : 'Past Peak'
                        : 'No window'}
                    </span>
                  </div>
                </div>

                {/* Coffee rows */}
                <div className="divide-y divide-brew-border/40">
                  {weekCoffees.map((coffee) => {
                    const days = daysOffRoastAt(coffee.roastDate, weekStart);
                    const stage = getStage(days, coffee);
                    const cfg = STAGE_CONFIG[stage];
                    const trail = weeks.map((w) => getStage(daysOffRoastAt(coffee.roastDate, w), coffee));

                    return (
                      <div
                        key={coffee.id}
                        className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-brew-card/40 transition-colors group"
                        onClick={() => navigate(`/coffees/${coffee.id}`)}
                      >
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-brew-text truncate group-hover:text-brew-primary transition-colors">
                            {coffee.roaster}
                          </div>
                          <div className="text-xs text-brew-faint truncate flex items-center gap-1">
                            {coffee.coffeeName || `${coffee.countryOrigin}${coffee.region ? `, ${coffee.region}` : ''}`}
                            {coffee.isFreezing && <Snowflake size={9} className="text-blue-400 flex-shrink-0" />}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-16">
                          <span className={`text-xs font-bold ${cfg.text}`}>{fmtWeeks(days)}</span>
                          <span
                            className={`leading-tight font-medium ${stage === 'peaking' ? cfg.text : `${cfg.text} opacity-60`}`}
                            style={{ fontSize: '9px' }}
                          >
                            {cfg.short}
                          </span>
                        </div>

                        {/* 9-dot trail */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {trail.map((s, di) => {
                            const dotCfg = STAGE_CONFIG[s];
                            const isCurrent = di === wi;
                            return (
                              <div
                                key={di}
                                className="rounded-full flex-shrink-0"
                                style={{
                                  width:  isCurrent ? 9 : 7,
                                  height: isCurrent ? 9 : 7,
                                  backgroundColor: dotCfg.dot,
                                  opacity: di < wi ? 0.3 : 1,
                                  outline: isCurrent ? `1.5px solid ${dotCfg.dot}55` : 'none',
                                  outlineOffset: '1px',
                                }}
                                title={`Week ${di + 1}: ${dotCfg.label}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {data.coffees.some((c) => c.isFinished) && (
        <p className="text-xs text-brew-faint">
          {data.coffees.filter((c) => c.isFinished).length} finished coffee{data.coffees.filter((c) => c.isFinished).length !== 1 ? 's' : ''} hidden.
        </p>
      )}

    </div>
  );
}
