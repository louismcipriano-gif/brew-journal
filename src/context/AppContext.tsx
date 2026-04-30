import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Coffee, Brew, SavedRecipe, WaterRecipe } from '../types';
import { uid } from '../utils';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'brew-journal-v1';
const MIGRATED_KEY = 'brew-journal-migrated-v1';
const FP_SCALE_KEY = 'brew-journal-fp-scale-v2'; // tracks 1-5 flavor scale migration

// ── Flavor profile scale migration (0-10 → 1-5) ──────────────────────────────
function migrateFP(fp: any): any {
  if (!fp) return fp;
  const dims = ['acidity','sweetness','body','florality','clarity','juiciness','finish','astringency','sourness'];
  const needsMigration = dims.some((k) => (fp[k] ?? 0) > 5);
  if (!needsMigration) return fp;
  const scalePos = (v: number) => Math.max(1, Math.min(5, Math.round(v / 2) || 1));
  const scaleNeg = (v: number) => Math.max(1, Math.min(5, Math.round(v / 2) || 1));
  return {
    ...fp,
    acidity:    scalePos(fp.acidity    ?? 5),
    sweetness:  scalePos(fp.sweetness  ?? 5),
    body:       scalePos(fp.body       ?? 5),
    florality:  scalePos(fp.florality  ?? 5),
    clarity:    scalePos(fp.clarity    ?? 5),
    juiciness:  scalePos(fp.juiciness  ?? 5),
    finish:     scalePos(fp.finish     ?? 5),
    astringency: scaleNeg(fp.astringency ?? 0),
    sourness:    scaleNeg(fp.sourness    ?? 0),
  };
}

function migrateBrews(brews: Brew[]): Brew[] {
  return brews.map((b) => ({ ...b, flavorProfile: migrateFP(b.flavorProfile) }));
}

const defaultData: AppData = { coffees: [], brews: [], recipes: [], waterRecipes: [] };

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbFetch<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('data').order('created_at', { ascending: false });
  if (error) { console.error(`fetch ${table}:`, error); return []; }
  return (data ?? []).map((r: any) => r.data as T);
}

async function sbUpsert(table: string, record: { id: string; [key: string]: any }) {
  const { error } = await supabase.from(table).upsert({ id: record.id, data: record });
  if (error) console.error(`upsert ${table}:`, error);
}

async function sbDelete(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`delete ${table}:`, error);
}

// ── Context interface ─────────────────────────────────────────────────────────

interface AppContextValue {
  data: AppData;
  loading: boolean;
  addCoffee: (c: Omit<Coffee, 'id' | 'createdAt'>) => Coffee;
  updateCoffee: (id: string, c: Partial<Coffee>) => void;
  deleteCoffee: (id: string) => void;
  addBrew: (b: Omit<Brew, 'id' | 'createdAt'>) => Brew;
  updateBrew: (id: string, b: Partial<Brew>) => void;
  deleteBrew: (id: string) => void;
  getCoffee: (id: string) => Coffee | undefined;
  getBrewsForCoffee: (coffeeId: string) => Brew[];
  addRecipe: (r: Omit<SavedRecipe, 'id' | 'createdAt'>) => SavedRecipe;
  updateRecipe: (id: string, r: Partial<SavedRecipe>) => void;
  deleteRecipe: (id: string) => void;
  getRecipe: (id: string) => SavedRecipe | undefined;
  addWaterRecipe: (w: Omit<WaterRecipe, 'id' | 'createdAt'>) => WaterRecipe;
  updateWaterRecipe: (id: string, w: Partial<WaterRecipe>) => void;
  deleteWaterRecipe: (id: string) => void;
  getWaterRecipe: (id: string) => WaterRecipe | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);

  // ── Initial load + localStorage migration ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const [coffees, brews, recipes, waterRecipes] = await Promise.all([
        sbFetch<Coffee>('coffees'),
        sbFetch<Brew>('brews'),
        sbFetch<SavedRecipe>('recipes'),
        sbFetch<WaterRecipe>('water_recipes'),
      ]);

      // Migrate localStorage data if Supabase is empty and migration hasn't run
      const alreadyMigrated = localStorage.getItem(MIGRATED_KEY);
      if (!alreadyMigrated && coffees.length === 0 && brews.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const local: AppData = { ...defaultData, ...JSON.parse(raw) };
            await Promise.all([
              ...local.coffees.map((c) => sbUpsert('coffees', c)),
              ...local.brews.map((b) => sbUpsert('brews', b)),
              ...local.recipes.map((r) => sbUpsert('recipes', r)),
            ]);
            setData({ ...local, waterRecipes: [] });
            localStorage.setItem(MIGRATED_KEY, '1');
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('migration error:', e);
        }
      }

      if (!alreadyMigrated && (coffees.length > 0 || brews.length > 0)) {
        localStorage.setItem(MIGRATED_KEY, '1');
      }

      // One-time migration: scale flavor profile values from 0-10 → 1-5
      const fpMigrated = localStorage.getItem(FP_SCALE_KEY);
      let finalBrews = brews;
      if (!fpMigrated && brews.length > 0) {
        const migrated = migrateBrews(brews);
        const changed = migrated.filter((b, i) =>
          JSON.stringify(b.flavorProfile) !== JSON.stringify(brews[i].flavorProfile)
        );
        if (changed.length > 0) {
          await Promise.all(changed.map((b) => sbUpsert('brews', b)));
          finalBrews = migrated;
        }
        localStorage.setItem(FP_SCALE_KEY, '1');
      }

      setData({ coffees, brews: finalBrews, recipes, waterRecipes });
      setLoading(false);
    }

    init();
  }, []);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('brew-journal-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coffees' }, (payload) => {
        setData((d) => applyChange(d, 'coffees', payload));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brews' }, (payload) => {
        setData((d) => applyChange(d, 'brews', payload));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, (payload) => {
        setData((d) => applyChange(d, 'recipes', payload));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_recipes' }, (payload) => {
        setData((d) => applyChange(d, 'waterRecipes', payload));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Coffees ───────────────────────────────────────────────────────────────
  const addCoffee = useCallback((c: Omit<Coffee, 'id' | 'createdAt'>): Coffee => {
    const coffee: Coffee = { ...c, id: uid(), createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, coffees: [coffee, ...d.coffees] }));
    sbUpsert('coffees', coffee);
    return coffee;
  }, []);

  const updateCoffee = useCallback((id: string, c: Partial<Coffee>) => {
    setData((d) => {
      const coffees = d.coffees.map((x) => (x.id === id ? { ...x, ...c } : x));
      const updated = coffees.find((x) => x.id === id)!;
      sbUpsert('coffees', updated);
      return { ...d, coffees };
    });
  }, []);

  const deleteCoffee = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      coffees: d.coffees.filter((x) => x.id !== id),
      brews: d.brews.filter((x) => x.coffeeId !== id),
    }));
    sbDelete('coffees', id);
    supabase.from('brews').delete().eq('data->>coffeeId', id);
  }, []);

  // ── Brews ─────────────────────────────────────────────────────────────────
  const addBrew = useCallback((b: Omit<Brew, 'id' | 'createdAt'>): Brew => {
    const brew: Brew = { ...b, id: uid(), createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, brews: [brew, ...d.brews] }));
    sbUpsert('brews', brew);
    return brew;
  }, []);

  const updateBrew = useCallback((id: string, b: Partial<Brew>) => {
    setData((d) => {
      const brews = d.brews.map((x) => (x.id === id ? { ...x, ...b } : x));
      const updated = brews.find((x) => x.id === id)!;
      sbUpsert('brews', updated);
      return { ...d, brews };
    });
  }, []);

  const deleteBrew = useCallback((id: string) => {
    setData((d) => ({ ...d, brews: d.brews.filter((x) => x.id !== id) }));
    sbDelete('brews', id);
  }, []);

  // ── Recipes ───────────────────────────────────────────────────────────────
  const addRecipe = useCallback((r: Omit<SavedRecipe, 'id' | 'createdAt'>): SavedRecipe => {
    const recipe: SavedRecipe = { ...r, id: uid(), createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, recipes: [recipe, ...d.recipes] }));
    sbUpsert('recipes', recipe);
    return recipe;
  }, []);

  const updateRecipe = useCallback((id: string, r: Partial<SavedRecipe>) => {
    setData((d) => {
      const recipes = d.recipes.map((x) => (x.id === id ? { ...x, ...r } : x));
      const updated = recipes.find((x) => x.id === id)!;
      sbUpsert('recipes', updated);
      return { ...d, recipes };
    });
  }, []);

  const deleteRecipe = useCallback((id: string) => {
    setData((d) => ({ ...d, recipes: d.recipes.filter((x) => x.id !== id) }));
    sbDelete('recipes', id);
  }, []);

  // ── Water Recipes ─────────────────────────────────────────────────────────
  const addWaterRecipe = useCallback((w: Omit<WaterRecipe, 'id' | 'createdAt'>): WaterRecipe => {
    const recipe: WaterRecipe = { ...w, id: uid(), createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, waterRecipes: [recipe, ...d.waterRecipes] }));
    sbUpsert('water_recipes', recipe);
    return recipe;
  }, []);

  const updateWaterRecipe = useCallback((id: string, w: Partial<WaterRecipe>) => {
    setData((d) => {
      const waterRecipes = d.waterRecipes.map((x) => (x.id === id ? { ...x, ...w } : x));
      const updated = waterRecipes.find((x) => x.id === id)!;
      sbUpsert('water_recipes', updated);
      return { ...d, waterRecipes };
    });
  }, []);

  const deleteWaterRecipe = useCallback((id: string) => {
    setData((d) => ({ ...d, waterRecipes: d.waterRecipes.filter((x) => x.id !== id) }));
    sbDelete('water_recipes', id);
  }, []);

  // ── Lookups ───────────────────────────────────────────────────────────────
  const getCoffee = useCallback((id: string) => data.coffees.find((c) => c.id === id), [data.coffees]);
  const getBrewsForCoffee = useCallback((coffeeId: string) => data.brews.filter((b) => b.coffeeId === coffeeId), [data.brews]);
  const getRecipe = useCallback((id: string) => data.recipes.find((r) => r.id === id), [data.recipes]);
  const getWaterRecipe = useCallback((id: string) => data.waterRecipes.find((w) => w.id === id), [data.waterRecipes]);

  return (
    <AppContext.Provider value={{
      data, loading,
      addCoffee, updateCoffee, deleteCoffee,
      addBrew, updateBrew, deleteBrew,
      getCoffee, getBrewsForCoffee,
      addRecipe, updateRecipe, deleteRecipe, getRecipe,
      addWaterRecipe, updateWaterRecipe, deleteWaterRecipe, getWaterRecipe,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// ── Real-time change applier ──────────────────────────────────────────────────

type DataKey = 'coffees' | 'brews' | 'recipes' | 'waterRecipes';
const TABLE_KEY: Record<string, DataKey> = {
  coffees: 'coffees',
  brews: 'brews',
  recipes: 'recipes',
  water_recipes: 'waterRecipes',
};

function applyChange(data: AppData, tableOrKey: string, payload: any): AppData {
  const key = TABLE_KEY[tableOrKey] ?? (tableOrKey as DataKey);
  const list = [...(data[key] as any[])];
  const record = payload.new?.data ?? payload.old?.data;
  if (!record) return data;

  if (payload.eventType === 'INSERT') {
    if (list.find((x) => x.id === record.id)) return data;
    return { ...data, [key]: [record, ...list] };
  }
  if (payload.eventType === 'UPDATE') {
    return { ...data, [key]: list.map((x) => (x.id === record.id ? record : x)) };
  }
  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    return { ...data, [key]: list.filter((x) => x.id !== id) };
  }
  return data;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
