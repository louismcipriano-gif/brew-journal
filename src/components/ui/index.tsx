import { useState, useRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { Mic, MicOff } from 'lucide-react';

// ── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brew-primary text-brew-bg hover:bg-brew-primary-light active:bg-brew-primary-dark',
    secondary: 'bg-brew-card border border-brew-border text-brew-text hover:bg-brew-surface hover:border-brew-primary',
    ghost: 'text-brew-muted hover:text-brew-text hover:bg-brew-card',
    danger: 'bg-brew-negative/20 text-brew-negative border border-brew-negative/30 hover:bg-brew-negative/30',
  };
  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3',
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  suffix?: string;
}

export function Input({ label, hint, suffix, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <input
          className={`w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors ${suffix ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brew-faint">{suffix}</span>
        )}
      </div>
      {hint && <span className="text-xs text-brew-faint">{hint}</span>}
    </div>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>}
      <textarea
        className={`w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text placeholder-brew-faint focus:outline-none focus:border-brew-primary transition-colors resize-none ${className}`}
        {...props}
      />
    </div>
  );
}

// ── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-brew-muted uppercase tracking-wider">{label}</label>}
      <select
        className={`w-full bg-brew-surface border border-brew-border rounded-lg px-3 py-2 text-sm text-brew-text focus:outline-none focus:border-brew-primary transition-colors appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}

export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div>
        <div className="text-sm text-brew-text group-hover:text-brew-primary-light transition-colors">{label}</div>
        {description && <div className="text-xs text-brew-faint">{description}</div>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-brew-primary' : 'bg-brew-border'}`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-5' : 'left-0.5'}`}
        />
      </div>
    </label>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  negative?: boolean;
  description?: string;
}

export function Slider({ label, value, onChange, negative = false, description }: SliderProps) {
  const color = negative ? '#9b3328' : '#5a3820';
  const bgTrack = negative
    ? `linear-gradient(to right, #9b3328 0%, #9b3328 ${value * 10}%, #e5ddd0 ${value * 10}%, #e5ddd0 100%)`
    : `linear-gradient(to right, #5a3820 0%, #5a3820 ${value * 10}%, #e5ddd0 ${value * 10}%, #e5ddd0 100%)`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-brew-text">{label}</span>
          {description && <span className="text-xs text-brew-faint ml-2">{description}</span>}
        </div>
        <span
          className="text-sm font-bold tabular-nums w-6 text-right"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={negative ? 'negative' : ''}
        style={{ background: bgTrack, width: '100%' }}
      />
      <div className="flex justify-between text-xs text-brew-faint">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-brew-card border border-brew-border rounded-xl shadow-card ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:border-brew-primary/30 transition-all duration-150' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'positive' | 'negative' | 'amber' | 'gold';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-brew-border/60 text-brew-muted',
    positive: 'bg-brew-positive/20 text-brew-positive',
    negative: 'bg-brew-negative/20 text-brew-negative',
    amber: 'bg-brew-primary/20 text-brew-primary-light',
    gold: 'bg-brew-gold/20 text-brew-gold',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 10) * circumference;
  let color = '#9b3328';
  if (score >= 8.5) color = '#b8920a';
  else if (score >= 7) color = '#2d6e4e';
  else if (score >= 5) color = '#b87d28';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5ddd0" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.25, color }}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display italic text-brew-primary text-xl leading-none">{children}</h2>
      {action}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="text-brew-faint opacity-50">{icon}</div>
      <div>
        <p className="text-brew-text font-medium">{title}</p>
        {description && <p className="text-brew-muted text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── MicButton ─────────────────────────────────────────────────────────────────

export function MicButton({ onResult, className = '' }: { onResult: (t: string) => void; className?: string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const accRef = useRef('');

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Try Chrome or Safari.'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    accRef.current = '';
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) accRef.current += e.results[i][0].transcript + ' ';
      }
    };
    rec.onerror = (e: any) => { setListening(false); if (e.error !== 'aborted') alert(`Mic error: ${e.error}`); };
    rec.onend = () => { setListening(false); if (accRef.current.trim()) onResult(accRef.current.trim()); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Stop listening' : 'Dictate'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors flex-shrink-0 ${
        listening
          ? 'bg-brew-negative/15 text-brew-negative border-brew-negative/40 animate-pulse'
          : 'bg-brew-surface text-brew-faint border-brew-border hover:text-brew-primary hover:border-brew-primary'
      } ${className}`}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
    </button>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

export function Chip({ label, checked, onChange, color = 'positive' }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: 'positive' | 'negative';
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
        checked
          ? color === 'positive'
            ? 'bg-brew-positive/20 border-brew-positive text-brew-positive'
            : 'bg-brew-negative/20 border-brew-negative text-brew-negative'
          : 'bg-transparent border-brew-border text-brew-faint hover:border-brew-muted'
      }`}
    >
      {checked ? '✓ ' : ''}{label}
    </button>
  );
}
