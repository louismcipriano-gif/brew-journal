import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Snowflake } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, EmptyState } from '../components/ui';
import { Coffee } from 'lucide-react';

// ── Stage definitions ─────────────────────────────────────────────────────────

type Stage = 'pre-roast' | 'resting' | 'approaching' | 'ready' | 'finish-soon' | 'past-peak';

const STAGE_CONFIG: Record<Stage, {
  label: string;
  sublabel: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}> = {
  'pre-roast':   { label: 'Pre-Roast',    sublabel: 'not yet roasted',  bg: 'bg-brew-card',           text: 'text-brew-faint',   border: 'border-brew-border',      dot: '#6b7280' },
  'resting':     { label: 'Resting',      sublabel: 'still resting',    bg: 'bg-green-950/60',        text: 'text-green-400',    border: 'border-green-800/50',     dot: '#4ade80' },
  'approaching': { label: 'Approaching',  sublabel: 'on the cusp',      bg: 'bg-orange-950/60',       text: 'text-orange-400',   border: 'border-orange-800/50',    dot: '#fb923c' },
  'ready':       { label: 'Ready',        sublabel: 'prime window',     bg: 'bg-amber-950/60',        text: 'text-amber-300',    border: 'border-amber-700/50',     dot: '#fbbf24' },
  'finish-soon': { label: 'Finish Soon',  sublabel: 'should finish',    bg: 'bg-blue-950/60',         text: 'text-blue-400',     border: 'border-blue-800/50',      dot: '#60a5fa' },
  'past-peak':   { label: 'Past Peak',    sublabel: 'past peak',        bg: 'bg-purple-950/40',       text: 'text-purple-400',   border: 'border-purple-800/40',    dot: '#c084fc' },
};

const STAGE_ORDER: Record<Stage, number> = {
  'ready': 0, 'approaching': 1, 'resting': 2, 'finish-soon': 3, 'pre-roast': 4, 'past-peak': 5,
};

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

function getStage(days: number): Stage {
  if (days < 0)  return 'pre-roast';
  if (days < 14) return 'resting';
  if (days < 21) return 'approaching';
  if (days < 42) return 'ready';
  if (days < 56) return 'finish-soon';
  return 'past-peak';
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

  // Active coffees with a roast date, sorted by current stage priority
  const activeCoffees = useMemo(() =>
    data.coffees
      .filter((c) => !c.isFinished && c.roastDate)
      .sort((a, b) => {
        const dA = daysOffRoastAt(a.roastDate, today);
        const dB = daysOffRoastAt(b.roastDate, today);
        const stageDiff = STAGE_ORDER[getStage(dA)] - STAGE_ORDER[getStage(dB)];
        if (stageDiff !== 0) return stageDiff;
        return dA - dB; // within same stage, newer roast first
      }),
    [data.coffees, today]
  );

  // Per-week: does any coffee have a stage worth drinking (ready or approaching)?
  const weekDrinkability = useMemo(() =>
    weeks.map((w) => {
      const stages = activeCoffees.map((c) => getStage(daysOffRoastAt(c.roastDate, w)));
      return {
        hasReady:      stages.some((s) => s === 'ready'),
        hasApproaching: stages.some((s) => s === 'approaching'),
        isEmpty:       !stages.some((s) => s === 'ready' || s === 'approaching'),
      };
    }),
    [weeks, activeCoffees]
  );

  // Current week summary
  const currentWeekStages = useMemo(() =>
    activeCoffees.reduce<Record<Stage, number>>(
      (acc, c) => {
        const s = getStage(daysOffRoastAt(c.roastDate, today));
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<Stage, number>
    ),
    [activeCoffees, today]
  );

  // Gap weeks (after current week, no ready/approaching coffees)
  const gapWeeks = weeks
    .slice(1)
    .filter((_, i) => weekDrinkability[i + 1].isEmpty)
    .map((w) => w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Readiness</h1>
          <p className="text-brew-muted text-sm mt-1">
            {activeCoffees.length} active coffee{activeCoffees.length !== 1 ? 's' : ''} · rest windows for the next 9 weeks
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.entries(STAGE_CONFIG) as [Stage, (typeof STAGE_CONFIG)[Stage]][])
          .filter(([s]) => s !== 'pre-roast')
          .map(([stage, cfg]) => (
            <div key={stage} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
              <span className="text-xs text-brew-muted">{cfg.label}</span>
              <span className="text-xs text-brew-faint hidden sm:inline">— {cfg.sublabel}</span>
            </div>
          ))}
      </div>

      {/* This week summary strip */}
      {activeCoffees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {(Object.entries(currentWeekStages) as [Stage, number][])
            .sort(([a], [b]) => STAGE_ORDER[a] - STAGE_ORDER[b])
            .map(([stage, count]) => {
              const cfg = STAGE_CONFIG[stage];
              return (
                <div key={stage} className={`rounded-xl border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
                  <div className={`text-lg font-bold leading-none ${cfg.text}`}>{count}</div>
                  <div className={`text-xs mt-1 ${cfg.text} opacity-80`}>{cfg.label}</div>
                </div>
              );
            })}
        </div>
      )}

      {/* Gap / order alert */}
      {gapWeeks.length > 0 && (
        <Card className="p-3.5 flex items-start gap-3 border-amber-700/40 bg-amber-950/20">
          <ShoppingCart size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Consider ordering soon</p>
            <p className="text-xs text-brew-muted mt-0.5">
              No coffees will be in their drinking window during:{' '}
              <span className="text-amber-400/80">{gapWeeks.join(', ')}</span>.
              {' '}A coffee ordered today typically needs 2–3 weeks of rest after it arrives.
            </p>
          </div>
        </Card>
      )}

      {/* Swimlane */}
      {activeCoffees.length === 0 ? (
        <EmptyState
          icon={<Coffee size={36} />}
          title="No active coffees"
          description="Add coffees with roast dates to see their rest windows here."
        />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8">
          <table className="border-collapse" style={{ minWidth: `${160 + weeks.length * 100}px` }}>

            {/* Week headers */}
            <thead>
              <tr>
                <th className="text-left pb-3 pr-3 w-40 min-w-40">
                  <span className="text-xs text-brew-faint font-normal">Coffee</span>
                </th>
                {weeks.map((w, i) => {
                  const { primary, secondary } = formatWeekLabel(w, i);
                  const info = weekDrinkability[i];
                  return (
                    <th key={i} className={`pb-3 px-1 min-w-24 text-center ${i === 0 ? 'text-brew-text' : info.isEmpty ? 'text-amber-500/70' : 'text-brew-muted'}`}>
                      <div className={`text-xs font-semibold leading-tight ${i === 0 ? 'text-brew-text' : ''}`}>{primary}</div>
                      {secondary && <div className="text-xs font-normal opacity-60 mt-0.5">{secondary}</div>}
                      {info.isEmpty && i > 0 && (
                        <div className="text-amber-500/60 mt-0.5" style={{ fontSize: '9px' }}>⚠ gap</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Coffee rows */}
            <tbody>
              {activeCoffees.map((coffee) => (
                <tr
                  key={coffee.id}
                  className="cursor-pointer group"
                  onClick={() => navigate(`/coffees/${coffee.id}`)}
                >
                  {/* Coffee name column */}
                  <td className="py-1 pr-3 align-middle">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-brew-text leading-tight truncate max-w-36 group-hover:text-brew-primary transition-colors">
                          {coffee.roaster}
                        </div>
                        <div className="text-xs text-brew-faint leading-tight truncate max-w-36 flex items-center gap-1">
                          {coffee.coffeeName || `${coffee.countryOrigin}${coffee.region ? `, ${coffee.region}` : ''}`}
                          {coffee.isFreezing && <Snowflake size={9} className="text-blue-400 flex-shrink-0" />}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Week cells */}
                  {weeks.map((w, i) => {
                    const days = daysOffRoastAt(coffee.roastDate, w);
                    const stage = getStage(days);
                    const cfg = STAGE_CONFIG[stage];
                    const isToday = i === 0;

                    return (
                      <td key={i} className="py-1 px-1 align-middle">
                        <div className={`
                          rounded-lg border px-2 py-2 text-center transition-opacity
                          ${cfg.bg} ${cfg.border}
                          ${isToday ? 'ring-1 ring-brew-primary/30' : ''}
                        `}>
                          <div className={`text-xs font-bold leading-none ${cfg.text}`}>
                            {days < 0 ? `−${-days}d` : `${days}d`}
                          </div>
                          <div className={`leading-tight mt-0.5 ${cfg.text} opacity-70`} style={{ fontSize: '9px' }}>
                            {stage === 'pre-roast' ? 'pre' : cfg.label.toLowerCase()}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Finished coffees note */}
      {data.coffees.some((c) => c.isFinished) && (
        <p className="text-xs text-brew-faint">
          {data.coffees.filter((c) => c.isFinished).length} finished coffee{data.coffees.filter((c) => c.isFinished).length !== 1 ? 's' : ''} hidden.
        </p>
      )}

    </div>
  );
}
