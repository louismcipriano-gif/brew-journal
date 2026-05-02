import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LayoutDashboard, Coffee, BookOpen, BarChart3, BookMarked,
  Settings2, Plus, Droplets, GitCompare, MoreHorizontal, X, GraduationCap,
} from 'lucide-react';
import { Button } from './ui';

const primaryNav = [
  { to: '/',      icon: LayoutDashboard, label: 'Home'    },
  { to: '/brews', icon: BookOpen,        label: 'Brews'   },
  // FAB slot in the middle
  { to: '/coffees',   icon: Coffee,   label: 'Coffees'  },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const moreNav = [
  { to: '/recipes',       icon: BookMarked,     label: 'Recipes'   },
  { to: '/water-recipes', icon: Droplets,       label: 'Water'     },
  { to: '/compare',       icon: GitCompare,     label: 'Compare'   },
  { to: '/learnings',     icon: GraduationCap,  label: 'Learnings' },
  { to: '/settings',      icon: Settings2,      label: 'Settings'  },
];

const sidebarNav = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/coffees',       icon: Coffee,          label: 'Coffees'      },
  { to: '/brews',         icon: BookOpen,        label: 'Brew Journal' },
  { to: '/recipes',       icon: BookMarked,      label: 'Recipes'      },
  { to: '/water-recipes', icon: Droplets,        label: 'Water'        },
  { to: '/compare',       icon: GitCompare,      label: 'Compare'      },
  { to: '/analytics',     icon: BarChart3,       label: 'Analytics'    },
  { to: '/learnings',     icon: GraduationCap,   label: 'Learnings'    },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-brew-bg text-brew-text">

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
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
          {sidebarNav.map(({ to, icon: Icon, label }) => (
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
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 min-h-screen md:ml-56 pb-28 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile: More sheet backdrop ───────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* ── Mobile: More sheet ────────────────────────────────── */}
      <div className={`md:hidden fixed left-0 right-0 z-50 bg-brew-surface rounded-t-2xl border-t border-brew-border shadow-xl transition-transform duration-300 ${moreOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ bottom: 0 }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brew-border" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="text-sm font-semibold text-brew-text">More</span>
          <button onClick={() => setMoreOpen(false)} className="p-1 text-brew-faint">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 px-4 pb-6" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          {moreNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors ${
                  isActive ? 'bg-brew-primary/15 text-brew-primary-light' : 'text-brew-muted active:bg-brew-card'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-brew-surface border-t border-brew-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center h-16">
          {/* First 2 primary items */}
          {primaryNav.slice(0, 2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                  isActive ? 'text-brew-primary-light' : 'text-brew-faint'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}

          {/* Centre FAB */}
          <div className="flex-shrink-0 flex items-center justify-center px-4">
            <button
              onClick={() => navigate('/brews/new')}
              className="w-14 h-14 rounded-full bg-brew-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform -mt-5"
            >
              <Plus size={26} className="text-brew-bg" />
            </button>
          </div>

          {/* Last 2 primary items */}
          {primaryNav.slice(2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                  isActive ? 'text-brew-primary-light' : 'text-brew-faint'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center h-full gap-1 text-brew-faint active:text-brew-text transition-colors"
          >
            <MoreHorizontal size={22} />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
