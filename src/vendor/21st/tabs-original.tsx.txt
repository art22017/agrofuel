'use client';

import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type Tab = { id: string; label: React.ReactNode; badge?: React.ReactNode; disabled?: boolean };

/**
 * Uncontrolled until you pass `value`, so a simple panel switch needs no state
 * and a URL-driven one still works.
 *
 * Arrow keys move between tabs and skip disabled ones — a tablist that is only
 * clickable is not reachable for anyone navigating by keyboard, and the roving
 * tabindex below is what the ARIA pattern actually requires.
 */
export default function Tabs({
  tabs,
  value,
  defaultValue,
  onChange,
  className,
  children,
}: {
  tabs: Tab[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
  /** Rendered below the tab strip — the caller owns which panel to show. */
  children?: (activeId: string) => React.ReactNode;
}) {
  const base = useId();
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const usable = tabs.filter((t) => !t.disabled);
    const i = usable.findIndex((t) => t.id === active);
    if (i === -1) return;
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = usable[(i + delta + usable.length) % usable.length];
    select(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div role="tablist" onKeyDown={onKey} className="flex shrink-0 items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              disabled={t.disabled}
              onClick={() => select(t.id)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40',
                on
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {t.label}
              {t.badge != null && (
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children && (
        <div role="tabpanel" id={`${base}-panel-${active}`} aria-labelledby={`${base}-tab-${active}`} className="min-h-0 flex-1 pt-3">
          {children(active)}
        </div>
      )}
    </div>
  );
}
