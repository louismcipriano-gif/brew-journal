import { useState, useEffect } from 'react';
import {
  GraduationCap, Star, Trash2, Plus, X, GitCompare,
} from 'lucide-react';
import { Card, SectionTitle, Button } from '../components/ui';
import { uid } from '../utils';
import type { Learning, LearningCategory } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

export const LEARNING_CATEGORIES: LearningCategory[] = [
  'Grind', 'Temperature', 'Water', 'Extraction', 'Ratio',
  'Brewing Technique', 'Filter', 'Device', 'Coffee Origin',
  'Processing', 'Roast', 'Dilution', 'Flavor', 'Timing',
  'Pour Technique', 'Agitation', 'Other',
];

const CATEGORY_HEX: Record<LearningCategory, string> = {
  'Grind':            '#d97706',
  'Temperature':      '#ea580c',
  'Water':            '#0284c7',
  'Extraction':       '#16a34a',
  'Ratio':            '#7c3aed',
  'Brewing Technique':'#0d9488',
  'Filter':           '#64748b',
  'Device':           '#6b7280',
  'Coffee Origin':    '#65a30d',
  'Processing':       '#059669',
  'Roast':            '#dc2626',
  'Dilution':         '#0891b2',
  'Flavor':           '#db2777',
  'Timing':           '#4f46e5',
  'Pour Technique':   '#9333ea',
  'Agitation':        '#c026d3',
  'Other':            '#9ca3af',
};

const LEARNINGS_KEY = 'brew-journal-learnings-v1';

// ── Helpers ────────────────────────────────────────────────────────────────────

export function loadLearnings(): Learning[] {
  try { return JSON.parse(localStorage.getItem(LEARNINGS_KEY) ?? '[]'); }
  catch { return []; }
}

export function saveLearningsToStorage(learnings: Learning[]) {
  localStorage.setItem(LEARNINGS_KEY, JSON.stringify(learnings));
}

export function addLearningToStorage(l: Omit<Learning, 'id' | 'createdAt'>): Learning {
  const learning: Learning = { ...l, id: uid(), createdAt: new Date().toISOString() };
  const existing = loadLearnings();
  saveLearningsToStorage([learning, ...existing]);
  return learning;
}

// ── Category Badge ─────────────────────────────────────────────────────────────

export function CategoryBadge({ cat }: { cat: LearningCategory }) {
  const hex = CATEGORY_HEX[cat] ?? '#9ca3af';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: hex + '18', color: hex, borderColor: hex + '40' }}
    >
      {cat}
    </span>
  );
}

// ── Blank form ─────────────────────────────────────────────────────────────────

function blankForm() {
  return { text: '', category: 'Grind' as LearningCategory, comboTags: [] as LearningCategory[], notes: '' };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Learnings() {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'starred' | LearningCategory>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  // Load from localStorage on mount
  useEffect(() => {
    setLearnings(loadLearnings());
  }, []);

  function persist(updated: Learning[]) {
    setLearnings(updated);
    saveLearningsToStorage(updated);
  }

  function handleAdd() {
    if (!form.text.trim()) return;
    const l: Learning = {
      id: uid(),
      text: form.text.trim(),
      category: form.category,
      comboTags: form.comboTags,
      starred: false,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    persist([l, ...learnings]);
    setForm(blankForm());
    setShowAddForm(false);
  }

  function toggleStar(id: string) {
    persist(learnings.map(l => l.id === id ? { ...l, starred: !l.starred } : l));
  }

  function deleteLearning(id: string) {
    persist(learnings.filter(l => l.id !== id));
  }

  function saveNotes(id: string) {
    const notes = editingNotes[id] ?? '';
    persist(learnings.map(l => l.id === id ? { ...l, notes } : l));
    setEditingNotes(n => { const next = { ...n }; delete next[id]; return next; });
  }

  function updateCategory(id: string, category: LearningCategory) {
    persist(learnings.map(l => l.id === id ? { ...l, category } : l));
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = learnings.filter(l => {
    if (activeFilter === 'starred') return l.starred;
    if (activeFilter === 'all') return true;
    return l.category === activeFilter || l.comboTags.includes(activeFilter as LearningCategory);
  });

  // Category counts for filter chips
  const catCounts: Partial<Record<LearningCategory, number>> = {};
  learnings.forEach(l => {
    catCounts[l.category] = (catCounts[l.category] ?? 0) + 1;
    l.comboTags.forEach(t => { catCounts[t] = (catCounts[t] ?? 0) + 1; });
  });
  const usedCategories = LEARNING_CATEGORIES.filter(c => (catCounts[c] ?? 0) > 0);

  const starredCount = learnings.filter(l => l.starred).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap size={22} className="text-brew-primary" />
          <h1 className="font-display italic text-brew-text text-2xl leading-tight">Learnings</h1>
          {learnings.length > 0 && (
            <span className="text-xs text-brew-faint bg-brew-surface border border-brew-border rounded-full px-2 py-0.5">
              {learnings.length}
            </span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAddForm(v => !v)}>
          {showAddForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add Manually</>}
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-5 flex flex-col gap-4 border-brew-primary/30">
          <SectionTitle>New Learning</SectionTitle>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-brew-muted uppercase tracking-wider">What did you learn?</label>
            <textarea
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              rows={3}
              placeholder="e.g. Finer grind on this washed Ethiopian made sweetness jump noticeably..."
              className="w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-brew-muted uppercase tracking-wider">Primary Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as LearningCategory }))}
                className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text focus:outline-none focus:border-brew-primary appearance-none"
              >
                {LEARNING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-brew-muted uppercase tracking-wider">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="extra context..."
                className="w-full bg-brew-surface border border-brew-border rounded-lg px-2 py-1.5 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary"
              />
            </div>
          </div>
          {/* Combo tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium text-brew-muted uppercase tracking-wider">Also involves (combo tags)</label>
            <div className="flex flex-wrap gap-1.5">
              {LEARNING_CATEGORIES.filter(c => c !== form.category).map(c => {
                const active = form.comboTags.includes(c);
                const hex = CATEGORY_HEX[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      comboTags: active ? f.comboTags.filter(x => x !== c) : [...f.comboTags, c],
                    }))}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all"
                    style={active
                      ? { background: hex + '18', color: hex, borderColor: hex + '60' }
                      : { background: 'transparent', color: '#9ca3af', borderColor: '#e5ddd0' }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!form.text.trim()}>Save Learning</Button>
        </Card>
      )}

      {/* Filter chips */}
      {learnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <FilterChip label="All" count={learnings.length} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
          {starredCount > 0 && (
            <FilterChip label="★ Starred" count={starredCount} active={activeFilter === 'starred'} onClick={() => setActiveFilter('starred')} />
          )}
          <span className="w-px h-4 bg-brew-border mx-0.5" />
          {usedCategories.map(c => (
            <FilterChip
              key={c}
              label={c}
              count={catCounts[c] ?? 0}
              active={activeFilter === c}
              onClick={() => setActiveFilter(activeFilter === c ? 'all' : c)}
              color={CATEGORY_HEX[c]}
            />
          ))}
        </div>
      )}

      {/* Learning cards */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(l => (
            <LearningCard
              key={l.id}
              learning={l}
              editingNotes={editingNotes[l.id]}
              onToggleStar={() => toggleStar(l.id)}
              onDelete={() => deleteLearning(l.id)}
              onCategoryChange={cat => updateCategory(l.id, cat)}
              onNotesChange={v => setEditingNotes(n => ({ ...n, [l.id]: v }))}
              onNotesSave={() => saveNotes(l.id)}
              onNotesCancel={() => setEditingNotes(n => { const next = { ...n }; delete next[l.id]; return next; })}
            />
          ))}
        </div>
      ) : learnings.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-4 text-center">
          <GraduationCap size={36} className="text-brew-border" />
          <div>
            <p className="text-brew-text font-medium">No learnings yet</p>
            <p className="text-brew-muted text-sm mt-1">
              Generate AI insights in Compare and save them here, or add your own observations manually.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-brew-faint border border-brew-border rounded-lg px-4 py-3">
            <GitCompare size={14} />
            <span>Go to Compare → Generate Insights → Save to Learnings</span>
          </div>
        </Card>
      ) : (
        <Card className="p-8 flex flex-col items-center gap-2 text-center">
          <p className="text-brew-text font-medium">No learnings in this filter</p>
          <button onClick={() => setActiveFilter('all')} className="text-sm text-brew-primary hover:text-brew-primary-light transition-colors">
            Clear filter
          </button>
        </Card>
      )}

      <div className="pb-8" />
    </div>
  );
}

// ── Filter Chip ────────────────────────────────────────────────────────────────

function FilterChip({
  label, count, active, onClick, color,
}: { label: string; count: number; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
      style={active && color
        ? { background: color + '18', color: color, borderColor: color + '60' }
        : active
        ? { background: 'var(--color-brew-primary, #5a3820)', color: '#fff', borderColor: 'var(--color-brew-primary, #5a3820)', opacity: 0.85 }
        : { background: 'transparent', color: '#8a7a6a', borderColor: '#e5ddd0' }}
    >
      {label}
      <span className="opacity-60 text-[10px]">{count}</span>
    </button>
  );
}

// ── Learning Card ──────────────────────────────────────────────────────────────

function LearningCard({
  learning: l,
  editingNotes,
  onToggleStar,
  onDelete,
  onCategoryChange,
  onNotesChange,
  onNotesSave,
  onNotesCancel,
}: {
  learning: Learning;
  editingNotes: string | undefined;
  onToggleStar: () => void;
  onDelete: () => void;
  onCategoryChange: (c: LearningCategory) => void;
  onNotesChange: (v: string) => void;
  onNotesSave: () => void;
  onNotesCancel: () => void;
}) {
  const [showCatPicker, setShowCatPicker] = useState(false);
  const isEditingNotes = editingNotes !== undefined;
  const date = new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Card className="p-4 flex flex-col gap-3">
      {/* Top row: star + categories + delete */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <button
            onClick={onToggleStar}
            className="flex-shrink-0 transition-colors"
            style={{ color: l.starred ? '#d97706' : '#c5b8a8' }}
            title={l.starred ? 'Unstar' : 'Star'}
          >
            <Star size={15} fill={l.starred ? 'currentColor' : 'none'} />
          </button>

          {/* Primary category (clickable to change) */}
          <button onClick={() => setShowCatPicker(v => !v)} title="Change category">
            <CategoryBadge cat={l.category} />
          </button>

          {/* Combo tags */}
          {l.comboTags.map(t => (
            <CategoryBadge key={t} cat={t} />
          ))}
          {l.comboTags.length > 0 && (
            <span className="text-[9px] text-brew-faint uppercase tracking-wider">combo</span>
          )}
        </div>

        <button
          onClick={onDelete}
          className="text-brew-faint hover:text-brew-negative transition-colors flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Category picker */}
      {showCatPicker && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-brew-bg rounded-lg border border-brew-border">
          {LEARNING_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { onCategoryChange(c); setShowCatPicker(false); }}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all"
              style={l.category === c
                ? { background: CATEGORY_HEX[c] + '20', color: CATEGORY_HEX[c], borderColor: CATEGORY_HEX[c] + '60' }
                : { background: 'transparent', color: '#8a7a6a', borderColor: '#e5ddd0' }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Learning text */}
      <p className="text-sm text-brew-text leading-relaxed">{l.text}</p>

      {/* Notes */}
      {isEditingNotes ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editingNotes}
            onChange={e => onNotesChange(e.target.value)}
            rows={2}
            placeholder="Add your own notes..."
            autoFocus
            className="w-full bg-brew-surface border border-brew-primary/40 rounded-lg px-3 py-2 text-xs text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary resize-none"
          />
          <div className="flex gap-2">
            <button onClick={onNotesSave} className="text-xs text-brew-primary font-medium hover:text-brew-primary-light transition-colors">Save</button>
            <button onClick={onNotesCancel} className="text-xs text-brew-faint hover:text-brew-muted transition-colors">Cancel</button>
          </div>
        </div>
      ) : l.notes ? (
        <button
          onClick={() => onNotesChange(l.notes)}
          className="text-xs text-brew-muted italic text-left hover:text-brew-text transition-colors leading-relaxed"
        >
          {l.notes}
        </button>
      ) : (
        <button
          onClick={() => onNotesChange('')}
          className="text-xs text-brew-faint hover:text-brew-muted transition-colors text-left"
        >
          + Add notes
        </button>
      )}

      {/* Source + date */}
      <div className="flex items-center gap-2 pt-1 border-t border-brew-border/40">
        {l.sourceContext && (
          <>
            <GitCompare size={11} className="text-brew-faint flex-shrink-0" />
            <span className="text-[10px] text-brew-faint">{l.sourceContext}</span>
            <span className="text-brew-border">·</span>
          </>
        )}
        <span className="text-[10px] text-brew-faint ml-auto">{date}</span>
      </div>
    </Card>
  );
}
