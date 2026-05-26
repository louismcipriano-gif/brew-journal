import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Select, EmptyState } from '../components/ui';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, ReferenceLine,
} from 'recharts';
import { calcBrewScore, avg, groupBy, formatDate, daysOffRoast } from '../utils';

const COLORS = ['#5a3820', '#2d6e4e', '#b87d28', '#4a6b9a', '#8b3a5e', '#4a7a6b'];

// Recharts formatter types are loose; cast helper avoids repetitive `as any`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tf = (fn: (...args: any[]) => [string | number, string]) => fn as any;

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #e5ddd0', borderRadius: 8, boxShadow: '0 4px 12px rgba(90,56,32,0.10)' },
  labelStyle: { color: '#6b5040', fontSize: 11 },
  itemStyle: { color: '#5a3820' },
};

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-brew-muted mb-4">{title}</h3>
      {children}
    </Card>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-xs text-brew-faint uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold" style={{ color: color || '#1c1510' }}>{value}</span>
    </Card>
  );
}

export default function Analytics() {
  const { data, getCoffee } = useApp();
  const [filterMethod, setFilterMethod] = useState('');
  const [filterProcess, setFilterProcess] = useState('');

  const brewsWithScore = useMemo(() => {
    let brews = data.brews;
    if (filterMethod) brews = brews.filter((b) => b.brewMethod === filterMethod);
    if (filterProcess) {
      brews = brews.filter((b) => {
        const c = getCoffee(b.coffeeId);
        return c?.processingMethod === filterProcess;
      });
    }
    return brews
      .map((b) => ({ ...b, score: calcBrewScore(b.flavorProfile) }))
      .sort((a, b) => new Date(a.brewDate).getTime() - new Date(b.brewDate).getTime());
  }, [data.brews, filterMethod, filterProcess, getCoffee]);

  if (data.brews.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={40} />}
        title="No data yet"
        description="Log at least a few brews to start seeing patterns in your data."
      />
    );
  }

  const scores = brewsWithScore.map((b) => b.score);
  const avgScore = avg(scores);
  const bestScore = scores.length ? Math.max(...scores) : 0;

  // Score over time
  const scoreTrend = brewsWithScore.map((b) => ({
    date: b.brewDate,
    score: b.score,
    method: b.brewMethod,
  }));

  // By processing method
  const processByMethod = useMemo(() => {
    const grouped = groupBy(data.brews, (b) => {
      const c = getCoffee(b.coffeeId);
      return c?.processingMethod ?? 'Unknown';
    });
    return Object.entries(grouped).map(([method, brews]) => ({
      method,
      avgScore: avg(brews.map((b) => calcBrewScore(b.flavorProfile))),
      count: brews.length,
      avgAcidity: avg(brews.map((b) => b.flavorProfile.acidity)),
      avgSweetness: avg(brews.map((b) => b.flavorProfile.sweetness)),
      avgBody: avg(brews.map((b) => b.flavorProfile.body)),
      avgAstringency: avg(brews.map((b) => b.flavorProfile.astringency)),
    }));
  }, [data.brews, getCoffee]);

  // By brew method
  const brewMethodData = useMemo(() => {
    const grouped = groupBy(data.brews, (b) => b.brewMethod);
    return Object.entries(grouped).map(([method, brews]) => ({
      method,
      avgScore: avg(brews.map((b) => calcBrewScore(b.flavorProfile))),
      count: brews.length,
    }));
  }, [data.brews]);

  // Days off roast scatter
  const daysScatter = useMemo(() => {
    return brewsWithScore
      .map((b) => {
        const c = getCoffee(b.coffeeId);
        if (!c?.roastDate) return null;
        const days = daysOffRoast(c.roastDate, b.brewDate);
        return { days, score: b.score, method: b.brewMethod };
      })
      .filter(Boolean) as { days: number; score: number; method: string }[];
  }, [brewsWithScore, getCoffee]);

  // Brew ratio scatter (pour over)
  const ratioScatter = useMemo(() => {
    return brewsWithScore
      .filter((b) => b.coffeeDose > 0 && b.waterAmount > 0)
      .map((b) => ({
        ratio: parseFloat((b.waterAmount / b.coffeeDose).toFixed(2)),
        score: b.score,
        method: b.brewMethod,
      }));
  }, [brewsWithScore]);

  // Radar data: average flavor profile
  const avgRadar = useMemo(() => {
    const attrs: (keyof typeof brewsWithScore[0]['flavorProfile'])[] = [
      'acidity', 'sweetness', 'body', 'florality', 'clarity', 'juiciness', 'finish', 'astringency', 'sourness',
    ];
    return attrs.map((attr) => ({
      attr: attr.charAt(0).toUpperCase() + attr.slice(1),
      value: parseFloat(avg(brewsWithScore.map((b) => b.flavorProfile[attr] as number)).toFixed(1)),
    }));
  }, [brewsWithScore]);

  // Top coffees
  const topCoffees = useMemo(() => {
    const grouped = groupBy(data.brews, (b) => b.coffeeId);
    return Object.entries(grouped)
      .map(([coffeeId, brews]) => {
        const c = getCoffee(coffeeId);
        return {
          name: c ? `${c.roaster} · ${c.countryOrigin}` : 'Unknown',
          avgScore: parseFloat(avg(brews.map((b) => calcBrewScore(b.flavorProfile))).toFixed(2)),
          count: brews.length,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);
  }, [data.brews, getCoffee]);

  // Apax Labs analytics
  const apaxAnalytics = useMemo(() => {
    const withApax = data.brews.filter((b) => b.apaxDropsUsed);
    if (withApax.length === 0) return null;
    const withoutApax = data.brews.filter((b) => !b.apaxDropsUsed);
    const avgWithApax = parseFloat(avg(withApax.map((b) => calcBrewScore(b.flavorProfile))).toFixed(2));
    const avgWithoutApax = withoutApax.length
      ? parseFloat(avg(withoutApax.map((b) => calcBrewScore(b.flavorProfile))).toFixed(2))
      : null;

    const drops = ['tonik', 'jamm', 'lylac', 'april', 'konflux', 'tanat'] as const;
    const byDrop = drops.map((drop) => {
      const brewsWithDrop = withApax.filter((b) => (b.apaxDrops?.[drop] ?? 0) > 0);
      if (brewsWithDrop.length === 0) return null;
      return {
        drop: drop.charAt(0).toUpperCase() + drop.slice(1),
        avgScore: parseFloat(avg(brewsWithDrop.map((b) => calcBrewScore(b.flavorProfile))).toFixed(2)),
        count: brewsWithDrop.length,
        avgDose: parseFloat(avg(brewsWithDrop.map((b) => b.apaxDrops?.[drop] ?? 0)).toFixed(1)),
      };
    }).filter(Boolean) as { drop: string; avgScore: number; count: number; avgDose: number }[];

    const comparison = [
      { label: 'With Apax', avgScore: avgWithApax, count: withApax.length },
      ...(avgWithoutApax !== null ? [{ label: 'Without Apax', avgScore: avgWithoutApax, count: withoutApax.length }] : []),
    ];

    return { comparison, byDrop, withApaxCount: withApax.length };
  }, [data.brews]);

  // Extraction breakdown
  const extractionCounts = useMemo(() => {
    const counts: Record<string, number> = { Under: 0, Balanced: 0, Over: 0, Uneven: 0, Unsure: 0 };
    brewsWithScore.forEach((b) => {
      const key = b.flavorProfile.perceivedExtraction;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [brewsWithScore]);

  const methods = [...new Set(data.brews.map((b) => b.brewMethod))];
  const processTypes = [...new Set(
    data.brews.map((b) => getCoffee(b.coffeeId)?.processingMethod).filter(Boolean)
  )] as string[];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display italic text-brew-text text-3xl leading-tight">Analytics</h1>
        <p className="text-brew-muted text-sm mt-1">Patterns and insights across your brews</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          options={methods.map((m) => ({ value: m, label: m }))}
          placeholder="All Brew Methods"
          className="max-w-44"
        />
        <Select
          value={filterProcess}
          onChange={(e) => setFilterProcess(e.target.value)}
          options={processTypes.map((p) => ({ value: p, label: p }))}
          placeholder="All Processing"
          className="max-w-44"
        />
        {(filterMethod || filterProcess) && (
          <button
            type="button"
            onClick={() => { setFilterMethod(''); setFilterProcess(''); }}
            className="text-xs text-brew-faint hover:text-brew-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Brews (filtered)" value={brewsWithScore.length} />
        <StatPill label="Avg Score" value={avgScore ? avgScore.toFixed(1) : '—'} color="#c47c3a" />
        <StatPill label="Best Score" value={bestScore ? bestScore.toFixed(1) : '—'} color="#e8c84a" />
        <StatPill label="Go-To Recipes" value={brewsWithScore.filter((b) => b.isGoToRecipe).length} color="#5ca882" />
      </div>

      {/* Score Over Time */}
      {scoreTrend.length > 1 && (
        <ChartCard title="Score Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#a8907c', fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(v) => formatDate(v as string)}
                formatter={tf((v: number) => [v.toFixed(1), 'Score'])}
              />
              <ReferenceLine y={3.5} stroke="#2d6e4e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#5a3820"
                strokeWidth={2}
                dot={{ fill: '#5a3820', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Two-column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Processing Method */}
        {processByMethod.length > 0 && (
          <ChartCard title="Score by Processing Method">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={processByMethod} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                <XAxis dataKey="method" tick={{ fill: '#a8907c', fontSize: 10 }} />
                <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={tf((v: number, name: string) => [v.toFixed(2), name === 'avgScore' ? 'Avg Score' : name])}
                />
                <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]}>
                  {processByMethod.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {processByMethod.map((p) => (
                <div key={p.method} className="flex items-center justify-between text-xs p-2 bg-brew-surface rounded-lg">
                  <span className="text-brew-muted">{p.method}</span>
                  <div className="flex gap-3 text-brew-faint">
                    <span>↑ S:{p.avgSweetness.toFixed(1)}</span>
                    <span>Body:{p.avgBody.toFixed(1)}</span>
                    <span className="text-brew-negative">A:{p.avgAstringency.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* By Brew Method */}
        {brewMethodData.length > 0 && (
          <ChartCard title="Score by Brew Method">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={brewMethodData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                <XAxis dataKey="method" tick={{ fill: '#a8907c', fontSize: 10 }} />
                <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={tf((v: number) => [v.toFixed(2), 'Avg Score'])}
                />
                <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]}>
                  {brewMethodData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Days Off Roast Scatter */}
        {daysScatter.length > 2 && (
          <ChartCard title="Days Off Roast vs Score">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="days"
                  name="Days Off Roast"
                  tick={{ fill: '#a8907c', fontSize: 10 }}
                  label={{ value: 'days off roast', position: 'insideBottom', offset: -3, fill: '#a8907c', fontSize: 10 }}
                  height={40}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  name="Score"
                  domain={[1, 5]}
                  tick={{ fill: '#a8907c', fontSize: 10 }}
                  width={24}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={tf((v: number, name: string) => [
                    name === 'score' ? v.toFixed(1) : v,
                    name === 'score' ? 'Score' : 'Days Off Roast',
                  ])}
                />
                <Scatter data={daysScatter} fill="#5a3820" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Brew Ratio Scatter */}
        {ratioScatter.length > 2 && (
          <ChartCard title="Brew Ratio vs Score">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="ratio"
                  name="Ratio"
                  tick={{ fill: '#a8907c', fontSize: 10 }}
                  tickFormatter={(v) => `1:${v}`}
                  label={{ value: 'brew ratio', position: 'insideBottom', offset: -3, fill: '#a8907c', fontSize: 10 }}
                  height={40}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  name="Score"
                  domain={[1, 5]}
                  tick={{ fill: '#a8907c', fontSize: 10 }}
                  width={24}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={tf((v: number, name: string) => [
                    name === 'score' ? v.toFixed(1) : `1:${v}`,
                    name === 'score' ? 'Score' : 'Brew Ratio',
                  ])}
                />
                <Scatter data={ratioScatter} fill="#2d6e4e" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Full width charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Average Flavor Radar */}
        <ChartCard title="Average Flavor Profile">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={avgRadar} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e5ddd0" />
              <PolarAngleAxis dataKey="attr" tick={{ fill: '#a8907c', fontSize: 11 }} />
              <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
              <Radar name="Avg" dataKey="value" stroke="#5a3820" fill="#5a3820" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e5ddd0', borderRadius: 8 }}
                itemStyle={{ color: '#e8a76e' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Coffees */}
        {topCoffees.length > 0 && (
          <ChartCard title="Top Performing Coffees">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topCoffees}
                layout="vertical"
                margin={{ top: 5, right: 40, bottom: 5, left: 0 }}
              >
                <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#a8907c', fontSize: 10 }}
                  width={160}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={tf((v: number) => [v.toFixed(2), 'Avg Score'])}
                />
                <Bar dataKey="avgScore" name="Avg Score" radius={[0, 4, 4, 0]}>
                  {topCoffees.map((entry, i) => (
                    <Cell key={i} fill={entry.avgScore >= 3.5 ? '#2d6e4e' : entry.avgScore >= 2.5 ? '#5a3820' : '#9b3328'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Extraction Distribution */}
      <ChartCard title="Extraction Distribution">
        <div className="flex gap-6 items-center">
          {extractionCounts.map(({ name, value }) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div
                className="text-3xl font-bold"
                style={{
                  color: name === 'Balanced' ? '#2d6e4e' : name === 'Over' ? '#9b3328' : '#b87d28',
                }}
              >
                {value}
              </div>
              <div className="text-xs text-brew-faint">{name}</div>
              <div className="text-xs text-brew-faint">
                ({brewsWithScore.length ? Math.round((value / brewsWithScore.length) * 100) : 0}%)
              </div>
            </div>
          ))}
          <div className="flex-1 h-4 rounded-full overflow-hidden bg-brew-surface flex ml-4">
            {extractionCounts.map(({ name, value }) => {
              const pct = brewsWithScore.length ? (value / brewsWithScore.length) * 100 : 0;
              const color = name === 'Balanced' ? '#2d6e4e' : name === 'Over' ? '#9b3328' : '#b87d28';
              return <div key={name} style={{ width: `${pct}%`, background: color }} />;
            })}
          </div>
        </div>
      </ChartCard>

      {/* Apax Labs Analytics */}
      {apaxAnalytics && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Apax vs No Apax comparison */}
            <ChartCard title="Apax Labs: Avg Score Comparison">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={apaxAnalytics.comparison} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: '#a8907c', fontSize: 11 }} />
                  <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={tf((v: number, name: string) => [v.toFixed(2), name === 'avgScore' ? 'Avg Score' : name])}
                  />
                  <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]}>
                    {apaxAnalytics.comparison.map((entry, i) => (
                      <Cell key={i} fill={entry.label === 'With Apax' ? '#2d6e4e' : '#a8907c'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-3 text-xs text-brew-faint">
                {apaxAnalytics.comparison.map((e) => (
                  <span key={e.label}>{e.label}: <strong className="text-brew-text">{e.count} brews</strong></span>
                ))}
              </div>
            </ChartCard>

            {/* By drop type */}
            {apaxAnalytics.byDrop.length > 0 && (
              <ChartCard title="Score by Apax Drop">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={apaxAnalytics.byDrop} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
                    <XAxis dataKey="drop" tick={{ fill: '#a8907c', fontSize: 11 }} />
                    <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={tf((v: number, name: string) => [
                        name === 'avgScore' ? v.toFixed(2) : `${v} ml avg`,
                        name === 'avgScore' ? 'Avg Score' : 'Avg Dose',
                      ])}
                    />
                    <Bar dataKey="avgScore" name="avgScore" radius={[4, 4, 0, 0]}>
                      {apaxAnalytics.byDrop.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {apaxAnalytics.byDrop.map((d) => (
                    <div key={d.drop} className="flex items-center justify-between text-xs p-2 bg-brew-surface rounded-lg">
                      <span className="text-brew-muted font-medium">{d.drop}</span>
                      <div className="flex flex-col items-end text-brew-faint">
                        <span>{d.count} brews</span>
                        <span>{d.avgDose} ml avg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {/* Flavor Attribute Trends by Processing */}
      {processByMethod.length > 1 && (
        <ChartCard title="Flavor Attributes by Processing Method">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={processByMethod} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#e5ddd0" strokeDasharray="4 4" />
              <XAxis dataKey="method" tick={{ fill: '#a8907c', fontSize: 10 }} />
              <YAxis domain={[1, 5]} tick={{ fill: '#a8907c', fontSize: 10 }} width={24} />
              <Tooltip
                {...tooltipStyle}
                formatter={tf((v: number, name: string) => [v.toFixed(1), name])}
              />
              <Legend wrapperStyle={{ color: '#a8907c', fontSize: 11 }} />
              <Bar dataKey="avgAcidity" name="Acidity" fill="#6b8fd4" radius={[2, 2, 0, 0]} />
              <Bar dataKey="avgSweetness" name="Sweetness" fill="#e8c84a" radius={[2, 2, 0, 0]} />
              <Bar dataKey="avgBody" name="Body" fill="#5a3820" radius={[2, 2, 0, 0]} />
              <Bar dataKey="avgAstringency" name="Astringency" fill="#c45040" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
