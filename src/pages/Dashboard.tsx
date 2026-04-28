import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcBrewScore, scoreColor, scoreLabel, formatDate, daysOffRoast } from '../utils';
import { Card, Badge, ScoreRing, Button, EmptyState } from '../components/ui';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-brew-muted mb-1">{label}</div>
      <div className="text-3xl font-bold" style={{ color: color || '#1c1510' }}>{value}</div>
      {sub && <div className="text-xs text-brew-faint mt-1">{sub}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { data, getCoffee } = useApp();
  const navigate = useNavigate();

  const scores = data.brews.map((b) => calcBrewScore(b.flavorProfile));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const goToCount = data.brews.filter((b) => b.isGoToRecipe).length;

  const recentBrews = [...data.brews]
    .sort((a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime())
    .slice(0, 6);

  const methodCounts = data.brews.reduce<Record<string, number>>((acc, b) => {
    acc[b.brewMethod] = (acc[b.brewMethod] || 0) + 1;
    return acc;
  }, {});
  const topMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (!data.brews.length && !data.coffees.length) {
    return (
      <div
        className="fixed inset-0 md:left-56 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(/bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0c1c11',
        }}
      >
        {/* Dark overlay so text is legible regardless of photo brightness */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(10,26,15,0.82) 0%, rgba(20,44,24,0.65) 50%, rgba(40,68,32,0.55) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-8 gap-6 max-w-lg">
          <p className="text-white/40 text-xs tracking-[0.25em] uppercase">Specialty Coffee</p>
          <h1 className="font-display italic text-white text-5xl md:text-6xl leading-tight">
            Brew Journal
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Track every variable. Refine your palate.<br />Discover what makes each cup exceptional.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={() => navigate('/coffees/new')}
              className="px-6 py-2.5 bg-white text-brew-text text-xs font-semibold uppercase tracking-widest hover:bg-white/90 transition-colors"
            >
              Add Your First Coffee
            </button>
            <button
              onClick={() => navigate('/brews/new')}
              className="px-6 py-2.5 border border-white/40 text-white/80 text-xs font-semibold uppercase tracking-widest hover:border-white/70 hover:text-white transition-colors"
            >
              Log a Brew
            </button>
          </div>
          <div className="flex gap-8 mt-4">
            {['Track every variable', 'Score flavor profiles', 'Discover patterns'].map((t) => (
              <span key={t} className="text-white/35 text-xs">{t}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Dashboard</h1>
          <p className="text-brew-muted text-sm mt-1">Your brewing at a glance</p>
        </div>
        <Button onClick={() => navigate('/brews/new')}>
          <Plus size={14} /> Log Brew
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Brews" value={data.brews.length} sub={`${data.coffees.length} coffees tracked`} />
        <StatCard
          label="Avg Score"
          value={avgScore ? avgScore.toFixed(1) : '—'}
          sub={avgScore ? scoreLabel(avgScore) : 'Log a brew to see'}
          color={avgScore ? scoreColor(avgScore) : undefined}
        />
        <StatCard
          label="Best Score"
          value={bestScore ? bestScore.toFixed(1) : '—'}
          sub="All time"
          color={bestScore ? scoreColor(bestScore) : undefined}
        />
        <StatCard
          label="Go-To Recipes"
          value={goToCount}
          sub={topMethod ? `Mostly ${topMethod}` : 'None saved yet'}
          color="#e8c84a"
        />
      </div>

      {/* Recent Brews */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brew-muted">Recent Brews</h2>
          <button
            className="text-xs text-brew-primary hover:text-brew-primary-light flex items-center gap-1 transition-colors"
            onClick={() => navigate('/brews')}
          >
            View all <ChevronRight size={12} />
          </button>
        </div>

        {recentBrews.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={40} />}
            title="No brews yet"
            description="Log your first brew to start tracking."
            action={<Button onClick={() => navigate('/brews/new')}><Plus size={14} /> Log Brew</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recentBrews.map((brew) => {
              const coffee = getCoffee(brew.coffeeId);
              const score = calcBrewScore(brew.flavorProfile);
              const days = coffee?.roastDate ? daysOffRoast(coffee.roastDate, brew.brewDate) : null;
              return (
                <Card
                  key={brew.id}
                  className="p-4 flex items-center gap-4"
                  onClick={() => navigate(`/brews/${brew.id}`)}
                >
                  <ScoreRing score={score} size={52} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brew-text text-sm truncate">
                      {coffee?.roaster ?? 'Unknown Roaster'} — {coffee?.countryOrigin ?? ''}
                    </div>
                    <div className="text-xs text-brew-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{brew.brewMethod}</span>
                      <span>·</span>
                      <span>{brew.brewingDevice || '—'}</span>
                      {days !== null && (
                        <>
                          <span>·</span>
                          <span>{days}d off roast</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {brew.isGoToRecipe && <Badge variant="gold">★ Go-To</Badge>}
                      <Badge variant={
                        brew.flavorProfile.perceivedExtraction === 'Balanced'
                          ? 'positive'
                          : brew.flavorProfile.perceivedExtraction === 'Over'
                          ? 'negative'
                          : 'amber'
                      }>
                        {brew.flavorProfile.perceivedExtraction}
                      </Badge>
                      {brew.brewRecipeName && (
                        <span className="text-xs text-brew-faint truncate">{brew.brewRecipeName}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-brew-faint text-right flex-shrink-0">
                    {formatDate(brew.brewDate)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Coffees quick view */}
      {data.coffees.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-brew-muted">Your Coffees</h2>
            <button
              className="text-xs text-brew-primary hover:text-brew-primary-light flex items-center gap-1 transition-colors"
              onClick={() => navigate('/coffees')}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.coffees.slice(0, 6).map((c) => {
              const brewScores = data.brews
                .filter((b) => b.coffeeId === c.id)
                .map((b) => calcBrewScore(b.flavorProfile));
              const avg = brewScores.length
                ? brewScores.reduce((a, b) => a + b, 0) / brewScores.length
                : null;
              return (
                <Card
                  key={c.id}
                  className="p-4 flex-shrink-0 w-48 cursor-pointer"
                  onClick={() => navigate(`/coffees/${c.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="amber">{c.processingMethod}</Badge>
                    {avg && (
                      <span className="text-xs font-bold" style={{ color: scoreColor(avg) }}>
                        {avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-sm text-brew-text truncate">{c.roaster}</div>
                  <div className="text-xs text-brew-muted truncate">{c.countryOrigin}{c.region ? `, ${c.region}` : ''}</div>
                  <div className="text-xs text-brew-faint mt-1">{c.roastLevel} roast</div>
                  <div className="text-xs text-brew-faint">{brewScores.length} brew{brewScores.length !== 1 ? 's' : ''}</div>
                </Card>
              );
            })}
            <Card
              className="p-4 flex-shrink-0 w-48 flex flex-col items-center justify-center gap-2 cursor-pointer border-dashed"
              onClick={() => navigate('/coffees/new')}
            >
              <Plus size={20} className="text-brew-faint" />
              <span className="text-xs text-brew-faint">Add Coffee</span>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
