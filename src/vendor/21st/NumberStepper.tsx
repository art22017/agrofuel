// Adapted from Number Stepper by Alexis Roe: https://21st.dev/@alexisroe/components/number-input
// https://github.com/AlexisRoe/e-ink-ui-lib — MIT, Copyright (c) 2026 Alexis Roe.
import { useId } from "react";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Controlled stepper with the author's bounded increment/decrement behavior.
 *  The middle remains an editable input so large fuel quantities can be typed. */
export function NumberStepper({label, value, onChange, min = 0, max = 100000000, step = 100, unit = "л"}: {
  label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  const labelId = useId();
  const commit = (next: number) => onChange(clamp(Math.round(next), min, max));
  return <div className="number-stepper">
    <label id={labelId} htmlFor={labelId + "-input"}>{label}</label>
    <div className="number-stepper-control">
      <button type="button" aria-label="Уменьшить объём" disabled={value <= min} onClick={() => commit(value-step)}>−</button>
      <input id={labelId + "-input"} aria-labelledby={labelId} inputMode="numeric" type="number" min={min} max={max} value={value || ""} onChange={e => commit(Number(e.currentTarget.value))} />
      <span>{unit}</span>
      <button type="button" aria-label="Увеличить объём" disabled={value >= max} onClick={() => commit(value+step)}>+</button>
    </div>
  </div>;
}
