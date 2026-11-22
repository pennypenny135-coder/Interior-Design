import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { round1 } from '../lib/geometry';

export function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const [txt, setTxt] = useState(String(round1(value)));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setTxt(String(round1(value)));
  }, [value, focus]);
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
      <span>{label}</span>
      <div className="relative">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={txt}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) {
              let v = n;
              if (min !== undefined) v = Math.max(min, v);
              if (max !== undefined) v = Math.min(max, v);
              onChange(v);
            }
          }}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {suffix && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">{suffix}</span>}
      </div>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-200 px-3 py-3">
      <div className="text-xs font-semibold text-slate-700 mb-2">{title}</div>
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'warn';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    default: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
    primary: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-white border-red-300 text-red-600 hover:bg-red-50',
    warn: 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100',
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs ${value === o.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
