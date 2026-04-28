import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LayoutDashboard, Coffee, BookOpen, BarChart3, BookMarked, Settings2, Plus, Droplets } from 'lucide-react';
import { Button } from './ui';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/coffees', icon: Coffee, label: 'Coffees' },
  { to: '/brews', icon: BookOpen, label: 'Brew Journal' },
  { to: '/recipes', icon: BookMarked, label: 'Recipes' },
  { to: '/water-recipes', icon: Droplets, label: 'Water' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full bg-brew-bg text-brew-text">

      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-brew-surface border-r border-brew-border flex-col z-20">
        <div className="px-5 pt-6 pb-4 border-b border-brew-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-brew-primary flex items-center justify-center text-brew-bg text-xs font-bold">
              ☕
            </div>
            <div>
              <div className="font-display italic text-brew-text text-lg leading-none tracking-wide">Brew Journal</div>
              <div className="text-brew-faint text-xs mt-0.5 tracking-widest uppercase">Specialty Coffee</div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <Button variant="primary" className="w-full" onClick={() => navigate('/brews/new')}>
            <Plus size={14} /> Log Brew
          </Button>
        </div>

        <nav className="flex-1 px-3 pt-4 flex flex-col gap-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brew-primary/15 text-brew-primary-light'
                    : 'text-brew-muted hover:text-brew-text hover:bg-brew-card'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-3 border-t border-brew-border pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-brew-primary/15 text-brew-primary-light' : 'text-brew-muted hover:text-brew-text hover:bg-brew-card'
              }`
            }
          >
            <Settings2 size={16} />
            Settings
          </NavLink>
          <p className="text-xs text-brew-faint mt-2 px-3">All data stored locally.</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 min-h-screen md:ml-56 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-brew-surface border-t border-brew-border flex items-center">
        {nav.slice(0, 2).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brew-primary-light' : 'text-brew-faint'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Centre Log Brew FAB */}
        <div className="flex-shrink-0 px-3">
          <button
            onClick={() => navigate('/brews/new')}
            className="w-12 h-12 rounded-full bg-brew-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={22} className="text-brew-bg" />
          </button>
        </div>

        {nav.slice(2).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brew-primary-light' : 'text-brew-faint'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
