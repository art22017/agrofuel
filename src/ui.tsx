import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { regionNames } from "./data";

export function Icon({
  name,
  size = 20,
}: {
  name: "search" | "close" | "arrow" | "down" | "plus" | "check" | "back";
  size?: number;
}) {
  const icons = {search: MagnifyingGlass, close: X, arrow: ArrowRight, down: CaretDown, plus: Plus, check: Check, back: ArrowLeft};
  const Glyph=icons[name];
  return <Glyph size={size} weight="regular" aria-hidden="true"/>;
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    id = useId();
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const controls = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            'button,input,select,a,summary,[tabindex="0"]',
          ) || [],
        ).filter(
          (e) => !e.hasAttribute("disabled") && e.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = previous;
      before?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={"dialog-shade " + (drawer ? "drawer-shade" : "")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={"dialog " + (wide ? "wide " : "") + (drawer ? "drawer" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        ref={root}
      >
        <header className="dialog-header">
          <h2 id={id}>{title}</h2>
          <button
            className="square-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
export function RegionField({
  value,
  onChange,
  label = "Регион",
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  onEnter?: (region: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    id = useId();
  const results = regionNames
    .filter((n) =>
      n.toLocaleLowerCase("ru").includes(value.toLocaleLowerCase("ru")),
    )
    .slice(0, 7);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function choose(s: string) {
    onChange(s);
    setOpen(false);
    input.current?.focus();
  }
  return (
    <div className="region-field" ref={root}>
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={
          open && results[active] ? `${id}-${active}` : undefined
        }
        value={value}
        placeholder="Введите регион"
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          }
          if (e.key === "Enter" && results.length) {
            const exact = regionNames.find(
              (n) => n.toLowerCase() === value.toLowerCase(),
            );
            const selected = exact || results[active] || results[0];
            e.preventDefault();
            choose(selected);
            onEnter?.(selected);
          }
        }}
      />
      <span className="field-chevron">
        <Icon name="down" size={18} />
      </span>
      {open && (
        <div
          className="region-options"
          role="listbox"
          id={id}
          aria-label="Регионы"
        >
          {results.map((r, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              id={`${id}-${i}`}
              key={r}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
            >
              {r}
            </button>
          ))}
          {!results.length && (
            <div className="option-empty">Регион не найден</div>
          )}
        </div>
      )}
    </div>
  );
}
export function useLocal<T>(key: string, initial: T) {
  const [value, set] = useState<T>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("agrofuel.v1." + key) || "null") ??
        initial
      );
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("agrofuel.v1." + key, JSON.stringify(value));
    } catch {
      /* Local persistence can be disabled by browser policy. */
    }
  }, [key, value]);
  return [value, set] as const;
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice-text">{children}</div>;
}
