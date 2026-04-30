import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Star, GitCompare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Badge, ScoreRing, Select, EmptyState } from '../components/ui';
import { calcBrewScore, formatDate, daysOffRoast, brewRatio } from '../utils';
import type { BrewMethod } from '../types';

const METHODS: BrewMethod[] = ['Pour Over', 'Espresso', 'Immersion', 'AeroPress', 'Zuppa Longa'];

export default function BrewLog() {
  const navigate = useNavigate();
  const { data, getCoffee } = useApp();
  const [filterMethod, setFilterMethod] = useState('');
  const [filterCoffee, setFilterCoffee] = useState('');
  const [filterGoTo, setFilterGoTo] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');

  let brews = [...data.brews];

  if (filterMethod) brews = brews.filter((b) => b.brewMethod === filterMethod);
  if (filterCoffee) brews = brews.filter((b) => b.coffeeId === filterCoffee);
  if (filterGoTo) brews = brews.filter((b) => b.isGoToRecipe);

  brews.sort((a, b) => {
    if (sortBy === 'score') {
      return calcBrewScore(b.flavorProfile) - calcBrewScore(a.flavorProfile);
    }
    return new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime();
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Brew Log</h1>
          <p className="text-brew-muted text-sm mt-1">
            {data.brews.length} brew{data.brews.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Button onClick={() => navigate('/brews/new')}>
          <Plus size={14} /> Log Brew
        </Button>
      </div>

      {/* Filters */}
      {data.brews.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <Select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            options={METHODS.map((m) => ({ value: m, label: m }))}
            placeholder="All Methods"
            className="max-w-44"
          />
          <Select
            value={filterCoffee}
            onChange={(e) => setFilterCoffee(e.target.value)}
            options={data.coffees.map((c) => ({
              value: c.id,
              label: `${c.roaster} · ${c.countryOrigin}`,
            }))}
            placeholder="All Coffees"
            className="max-w-52"
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}
            options={[
              { value: 'date', label: 'Sort: Recent' },
              { value: 'score', label: 'Sort: Best Score' },
            ]}
            className="max-w-40"
          />
          <button
            type="button"
            onClick={() => setFilterGoTo(!filterGoTo)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
              filterGoTo
                ? 'bg-brew-gold/20 border-brew-gold text-brew-gold'
                : 'border-brew-border text-brew-faint hover:border-brew-muted'
            }`}
          >
            <Star size={12} />
            Go-To Only
          </button>
          {(filterMethod || filterCoffee || filterGoTo) && (
            <button
              type="button"
              onClick={() => { setFilterMethod(''); setFilterCoffee(''); setFilterGoTo(false); }}
              className="text-xs text-brew-faint hover:text-brew-muted transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {data.brews.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          title="No brews logged yet"
          description="Start tracking your first brew to begin building your data."
          action={
            <Button onClick={() => navigate('/brews/new')}>
              <Plus size={14} /> Log Your First Brew
            </Button>
          }
        />
      ) : brews.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No brews match your filters"
          description="Try adjusting the filters above."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {brews.map((brew) => {
            const coffee = getCoffee(brew.coffeeId);
            const score = calcBrewScore(brew.flavorProfile);
            const days = coffee?.roastDate ? daysOffRoast(coffee.roastDate, brew.brewDate) : null;
            return (
              <Card
                key={brew.id}
                className="p-4 flex items-center gap-4"
                onClick={() => navigate(`/brews/${brew.id}`)}
              >
                <ScoreRing score={score} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-brew-text">
                      {coffee?.roaster ?? 'Unknown Roaster'}
                    </span>
                    <span className="text-brew-faint text-xs">
                      {coffee?.countryOrigin}{coffee?.region ? `, ${coffee.region}` : ''}
                    </span>
                    {brew.isGoToRecipe && <Badge variant="gold">★ Go-To</Badge>}
                    {coffee?.processingMethod && <Badge variant="amber">{coffee.processingMethod}</Badge>}
                  </div>
                  <div className="text-xs text-brew-muted mt-1 flex flex-wrap gap-2">
                    <span>{brew.brewMethod}</span>
                    <span>·</span>
                    <span>{brew.brewingDevice || '—'}</span>
                    {brew.grinder && <><span>·</span><span>{brew.grinder} @ {brew.grindSetting}</span></>}
                    {brew.coffeeDose > 0 && (
                      <><span>·</span><span>{brew.coffeeDose}g : {brew.waterAmount}g ({brewRatio(brew.waterAmount, brew.coffeeDose)})</span></>
                    )}
                    {days !== null && <><span>·</span><span>{days}d off roast</span></>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      variant={
                        brew.flavorProfile.perceivedExtraction === 'Balanced'
                          ? 'positive'
                          : brew.flavorProfile.perceivedExtraction === 'Over'
                          ? 'negative'
                          : brew.flavorProfile.perceivedExtraction === 'Unsure'
                          ? 'default'
                          : 'amber'
                      }
                    >
                      {brew.flavorProfile.perceivedExtraction}
                    </Badge>
                    {brew.brewRecipeName && (
                      <span className="text-xs text-brew-faint italic">{brew.brewRecipeName}</span>
                    )}
                    {brew.flavorProfile.flavorNotes && (
                      <span className="text-xs text-brew-faint truncate max-w-xs italic">
                        "{brew.flavorProfile.flavorNotes.substring(0, 60)}{brew.flavorProfile.flavorNotes.length > 60 ? '…' : ''}"
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 self-start">
                  <span className="text-xs text-brew-faint">{formatDate(brew.brewDate)}</span>
                  <button
                    className="flex items-center gap-1 text-xs text-brew-muted hover:text-brew-primary transition-colors px-1.5 py-0.5 rounded border border-brew-border hover:border-brew-primary"
                    onClick={(e) => { e.stopPropagation(); navigate(`/compare?a=${brew.id}`); }}
                    title="Compare this brew"
                  >
                    <GitCompare size={11} />
                    Compare
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
