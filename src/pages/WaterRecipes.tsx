import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Edit2, Droplets } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Badge, Input, EmptyState, SectionTitle } from '../components/ui';
import { formatDate } from '../utils';
import type { WaterRecipe, WaterProduct } from '../types';

const PRODUCTS: WaterProduct[] = ['Apax Labs', 'Lotus Drops', 'Third Wave Water', 'Aquacode'];

type WRFormKey = keyof Omit<WaterRecipe, 'id' | 'createdAt'>;

const MINERAL_FIELDS: { key: WRFormKey; label: string }[] = [
  { key: 'ppm',  label: 'Total PPM' },
  { key: 'gh',   label: 'GH' },
  { key: 'kh',   label: 'KH' },
  { key: 'ca',   label: 'Ca' },
  { key: 'mg',   label: 'Mg' },
  { key: 'na',   label: 'Na' },
  { key: 'k',    label: 'K' },
];

const APAX_FIELDS: { key: WRFormKey; label: string }[] = [
  { key: 'apaxTonik',   label: 'TONIK' },
  { key: 'apaxJamm',    label: 'JAMM' },
  { key: 'apaxLylac',   label: 'LYLAC' },
  { key: 'apaxApril',   label: 'APRIL' },
  { key: 'apaxKonflux', label: 'KONFLUX' },
];

const blank: Omit<WaterRecipe, 'id' | 'createdAt'> = {
  name: '',
  ppm: undefined,
  gh: undefined,
  kh: undefined,
  ca: undefined,
  mg: undefined,
  na: undefined,
  k: undefined,
  apaxTonik: undefined,
  apaxJamm: undefined,
  apaxLylac: undefined,
  apaxApril: undefined,
  apaxKonflux: undefined,
  productsUsed: [],
  notes: '',
};

// ── Form ──────────────────────────────────────────────────────────────────────

export function WaterRecipeForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const { addWaterRecipe, updateWaterRecipe, getWaterRecipe } = useApp();

  const existing = isEdit ? getWaterRecipe(id!) : undefined;
  const [form, setForm] = useState<Omit<WaterRecipe, 'id' | 'createdAt'>>(
    existing
      ? {
          name: existing.name,
          ppm: existing.ppm,
          gh: existing.gh,
          kh: existing.kh,
          ca: existing.ca,
          mg: existing.mg,
          na: existing.na,
          k: existing.k,
          apaxTonik: existing.apaxTonik,
          apaxJamm: existing.apaxJamm,
          apaxLylac: existing.apaxLylac,
          apaxApril: existing.apaxApril,
          apaxKonflux: existing.apaxKonflux,
          productsUsed: existing.productsUsed ?? [],
          notes: existing.notes ?? '',
        }
      : blank,
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setNum(k: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [k]: val === '' ? undefined : parseFloat(val) }));
  }

  function toggleProduct(p: WaterProduct) {
    setForm((f) => ({
      ...f,
      productsUsed: f.productsUsed.includes(p)
        ? f.productsUsed.filter((x) => x !== p)
        : [...f.productsUsed, p],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (isEdit) {
      updateWaterRecipe(id!, form);
      navigate(`/water-recipes/${id}`);
    } else {
      const r = addWaterRecipe(form);
      navigate(`/water-recipes/${r.id}`);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <h1 className="font-display italic text-brew-text text-2xl leading-tight">
          {isEdit ? 'Edit Water Recipe' : 'Add Water Recipe'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-6">

        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Recipe Identity</SectionTitle>
          <Input
            label="Recipe Name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Apax TONIK Build, My V60 Water, TWW Classic"
            required
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">Products Used</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((p) => {
                const active = form.productsUsed.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      active
                        ? 'bg-brew-primary/15 border-brew-primary text-brew-primary-light'
                        : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
                    }`}
                  >
                    {active ? '✓ ' : ''}{p}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Mineral Profile</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {MINERAL_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={(form[key] as number | undefined) ?? ''}
                    onChange={(e) => setNum(key, e.target.value)}
                    placeholder="—"
                    className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brew-faint">ppm</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <SectionTitle>Apax Concentrates</SectionTitle>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {APAX_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={(form[key] as number | undefined) ?? ''}
                    onChange={(e) => setNum(key, e.target.value)}
                    placeholder="—"
                    className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brew-faint">ml</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 flex flex-col gap-2">
          <SectionTitle>Notes</SectionTitle>
          <textarea
            className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            placeholder="Any notes about this recipe — source, adjustments, best use case..."
          />
        </Card>

        <div className="flex gap-3 pb-8">
          <Button type="submit" size="lg">{isEdit ? 'Save Changes' : 'Save Water Recipe'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ── Detail ────────────────────────────────────────────────────────────────────

export function WaterRecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getWaterRecipe, deleteWaterRecipe } = useApp();

  const recipe = getWaterRecipe(id!);
  if (!recipe) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/water-recipes')}><ArrowLeft size={14} /> Back</Button>
        <p className="text-brew-muted mt-4">Recipe not found.</p>
      </div>
    );
  }

  function handleDelete() {
    if (confirm(`Delete "${recipe!.name}"? This cannot be undone.`)) {
      deleteWaterRecipe(id!);
      navigate('/water-recipes');
    }
  }

  const minerals = MINERAL_FIELDS.filter(({ key }) => recipe[key] != null);
  const apax = APAX_FIELDS.filter(({ key }) => recipe[key] != null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/water-recipes')}><ArrowLeft size={14} /> Back</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/water-recipes/${id}/edit`)}><Edit2 size={14} /> Edit</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}><Trash2 size={14} /> Delete</Button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          {(recipe.productsUsed ?? []).map((p) => <Badge key={p} variant="amber">{p}</Badge>)}
        </div>
        <h1 className="font-display italic text-brew-text text-4xl leading-tight">{recipe.name}</h1>
        <p className="text-brew-faint text-xs mt-1">Saved {formatDate(recipe.createdAt)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {minerals.length > 0 && (
          <Card className="p-5">
            <SectionTitle>Mineral Profile</SectionTitle>
            <dl className="flex flex-col gap-2">
              {minerals.map(({ key, label }) => (
                <div key={key} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-brew-faint">{label}</span>
                  <span className="text-brew-text font-medium">{recipe[key] as number} ppm</span>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {apax.length > 0 && (
          <Card className="p-5">
            <SectionTitle>Apax Concentrates</SectionTitle>
            <dl className="flex flex-col gap-2">
              {apax.map(({ key, label }) => (
                <div key={key} className="flex justify-between text-sm border-b border-brew-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-brew-faint">{label}</span>
                  <span className="text-brew-text font-medium">{recipe[key] as number} ml</span>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>

      {recipe.notes && (
        <Card className="p-5">
          <SectionTitle>Notes</SectionTitle>
          <p className="text-brew-text text-sm whitespace-pre-wrap leading-relaxed">{recipe.notes}</p>
        </Card>
      )}
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

export default function WaterRecipes() {
  const navigate = useNavigate();
  const { data } = useApp();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">Water Recipes</h1>
          <p className="text-brew-muted text-sm mt-1">
            {data.waterRecipes.length} recipe{data.waterRecipes.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button onClick={() => navigate('/water-recipes/new')}><Plus size={14} /> Add Recipe</Button>
      </div>

      {data.waterRecipes.length === 0 ? (
        <EmptyState
          icon={<Droplets size={40} />}
          title="No water recipes yet"
          description="Save your mineral builds to reuse them across brews."
          action={<Button onClick={() => navigate('/water-recipes/new')}><Plus size={14} /> Add Your First Recipe</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.waterRecipes.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col gap-3" onClick={() => navigate(`/water-recipes/${r.id}`)}>
              <div className="flex flex-wrap gap-1.5">
                {(r.productsUsed ?? []).map((p) => <Badge key={p} variant="amber">{p}</Badge>)}
              </div>
              <div>
                <div className="font-semibold text-brew-text">{r.name}</div>
                {r.ppm != null && <div className="text-brew-faint text-xs mt-0.5">{r.ppm} ppm total</div>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-brew-border">
                {[{ label: 'GH', val: r.gh }, { label: 'KH', val: r.kh }, { label: 'Mg', val: r.mg }].map(({ label, val }) => (
                  <div key={label}>
                    <div className="text-xs text-brew-faint">{label}</div>
                    <div className="text-sm font-medium text-brew-text">{val != null ? `${val}` : '—'}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <Card
            className="p-5 flex flex-col items-center justify-center gap-2 border-dashed min-h-[160px]"
            onClick={() => navigate('/water-recipes/new')}
          >
            <Plus size={24} className="text-brew-faint" />
            <span className="text-sm text-brew-faint">Add Recipe</span>
          </Card>
        </div>
      )}
    </div>
  );
}
