import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ExternalLink, Store, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Input, SectionTitle, EmptyState } from '../components/ui';
import { calcBrewScore } from '../utils';
import { uid } from '../utils';
import type { RoasterWishlist } from '../types';

const WISHLIST_KEY = 'brew-journal-roaster-wishlist-v1';

function loadWishlist(): RoasterWishlist[] {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveWishlist(list: RoasterWishlist[]) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
}

const blankForm = { name: '', location: '', website: '', notes: '' };

export default function Roasters() {
  const { data } = useApp();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState<RoasterWishlist[]>(loadWishlist);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blankForm);

  useEffect(() => { saveWishlist(wishlist); }, [wishlist]);

  // ── Tried roasters — derived from logged coffees ──────────────────────────
  const triedRoasters = useMemo(() => {
    const map = new Map<string, {
      coffeeCount: number;
      origins: Set<string>;
      scores: number[];
      latestDate: string;
      coffeeIds: string[];
    }>();

    data.coffees.forEach((c) => {
      const key = c.roaster.trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, { coffeeCount: 0, origins: new Set(), scores: [], latestDate: '', coffeeIds: [] });
      const entry = map.get(key)!;
      entry.coffeeCount++;
      entry.coffeeIds.push(c.id);
      if (c.countryOrigin) entry.origins.add(c.countryOrigin);
      if (c.roastDate && c.roastDate > entry.latestDate) entry.latestDate = c.roastDate;
    });

    // Attach brew scores
    data.brews.forEach((b) => {
      const coffee = data.coffees.find((c) => c.id === b.coffeeId);
      if (!coffee) return;
      const entry = map.get(coffee.roaster.trim());
      if (entry) entry.scores.push(calcBrewScore(b.flavorProfile));
    });

    return Array.from(map.entries())
      .map(([name, e]) => ({
        name,
        coffeeCount: e.coffeeCount,
        origins: Array.from(e.origins),
        avgScore: e.scores.length ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null,
        brewCount: e.scores.length,
        latestDate: e.latestDate,
        coffeeIds: e.coffeeIds,
        onWishlist: wishlist.some((w) => w.name.toLowerCase() === name.toLowerCase()),
      }))
      .sort((a, b) => b.coffeeCount - a.coffeeCount || a.name.localeCompare(b.name));
  }, [data.coffees, data.brews, wishlist]);

  // ── Wishlist CRUD ────────────────────────────────────────────────────────
  function addToWishlist() {
    if (!form.name.trim()) return;
    const entry: RoasterWishlist = {
      id: uid(),
      name: form.name.trim(),
      location: form.location.trim() || undefined,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setWishlist((w) => [entry, ...w]);
    setForm(blankForm);
    setAdding(false);
  }

  function removeFromWishlist(id: string) {
    setWishlist((w) => w.filter((x) => x.id !== id));
  }


  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Roasters</h1>
          <p className="text-brew-muted text-sm mt-1">
            {triedRoasters.length} tried · {wishlist.length} on wishlist
          </p>
        </div>
        <Button size="sm" onClick={() => { setAdding(true); setForm(blankForm); }}>
          <Plus size={13} /> Add to Wishlist
        </Button>
      </div>

      {/* ── Wishlist ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Wishlist</SectionTitle>

        {/* Add form */}
        {adding && (
          <Card className="p-5 flex flex-col gap-4 border-brew-primary/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Roaster Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. SEY Coffee"
                autoFocus
              />
              <Input
                label="Location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Brooklyn, NY"
              />
            </div>
            <Input
              label="Website / Instagram"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="e.g. seycoffee.com or @seycoffee"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Notes</label>
              <textarea
                className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Why you want to try them, what you've heard..."
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addToWishlist} disabled={!form.name.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {wishlist.length === 0 && !adding ? (
          <EmptyState
            icon={<Store size={28} />}
            title="No roasters on your wishlist"
            description="Add roasters you want to try."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={12} /> Add Roaster
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {wishlist.map((r) => {
              const alreadyTried = triedRoasters.find((t) => t.name.toLowerCase() === r.name.toLowerCase());
              return (
                <Card key={r.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-brew-text">{r.name}</span>
                      {r.location && (
                        <span className="text-xs text-brew-faint">{r.location}</span>
                      )}
                      {alreadyTried && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          ✓ {alreadyTried.coffeeCount} tried
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-brew-muted mt-1 leading-relaxed">{r.notes}</p>
                    )}
                    {r.website && (
                      <a
                        href={r.website.startsWith('http') ? r.website : `https://${r.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brew-primary mt-1 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={10} />
                        {r.website}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromWishlist(r.id)}
                    className="text-brew-faint hover:text-brew-text transition-colors flex-shrink-0 mt-0.5"
                  >
                    <X size={15} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tried Roasters ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Tried ({triedRoasters.length})</SectionTitle>
        <p className="text-xs text-brew-faint -mt-2">From your logged coffees.</p>

        {triedRoasters.length === 0 ? (
          <EmptyState
            icon={<Store size={28} />}
            title="No coffees logged yet"
            description="Your tried roasters will appear here once you log coffees."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {triedRoasters.map((r) => (
              <Card
                key={r.name}
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => navigate(`/coffees?roaster=${encodeURIComponent(r.name)}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-brew-text">{r.name}</span>
                    {r.origins.length > 0 && (
                      <span className="text-xs text-brew-faint">{r.origins.join(', ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-brew-faint flex-wrap">
                    <span>{r.coffeeCount} coffee{r.coffeeCount !== 1 ? 's' : ''}</span>
                    {r.brewCount > 0 && <span>{r.brewCount} brew{r.brewCount !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                {r.avgScore !== null && (
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-1 text-brew-primary-light">
                      <Star size={11} className="fill-brew-primary text-brew-primary" />
                      <span className="text-sm font-bold">{r.avgScore.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-brew-faint">avg score</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
