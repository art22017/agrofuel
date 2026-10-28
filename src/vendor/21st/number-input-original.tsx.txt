import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useContext, useId, useState } from "react";
import { cx } from "../../utils/cx.utils";
import { FormContext } from "../form/form.context";
import { Icon } from "../icons/icon";
import { Label } from "../label/label.component";
import "./number-input.component.css";

function roundStep(value: number, useFloat: boolean): number {
  return useFloat ? Math.round(value * 100) / 100 : Math.round(value);
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Formats a value the way {@link NumberInput} displays it: plain digits when
 * `useFloat` is `false`, otherwise always two decimal places with a comma as
 * the decimal separator (`5,00`, `5,01`) — except `0`, which is shown bare (`0`).
 */
function formatValue(value: number, useFloat: boolean): string {
  if (!useFloat || value === 0) return String(value);
  return value.toFixed(2).replace(".", ",");
}

/** Props accepted by {@link NumberInput}. */
export interface NumberInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Label rendered above the control, via {@link Label.Form}. */
  label: ReactNode;
  /**
   * Field name to bind to the enclosing `<Form>`. When provided, `NumberInput`
   * reads/writes its value through the form context and the
   * `value`/`onChange` props are ignored.
   */
  name?: string;
  /** Current value for standalone use, outside a `<Form>`. */
  value?: number;
  /** Initial value for uncontrolled standalone use. Defaults to `0`. */
  defaultValue?: number;
  /** Called with the next value whenever it changes. Ignored when `name` is set. */
  onChange?: (value: number) => void;
  /** Lower bound. Unbounded when omitted. */
  min?: number;
  /** Upper bound. Unbounded when omitted. */
  max?: number;
  /** Amount added or subtracted per step. Defaults to `0.1` when `useFloat`, otherwise `1`. */
  step?: number;
  /**
   * Treats the value as a float rather than an integer: the display always
   * shows two decimal places with a comma separator (e.g. `5,00`, `5,01`),
   * except `0` which is shown bare. Defaults to `false`.
   */
  useFloat?: boolean;
  /** Disables both step buttons. Defaults to `false`. */
  disabled?: boolean;
}

/**
 * Numeric stepper for e-ink displays: a labeled decrease/increase button pair
 * around a value display, for quantities or other small bounded numbers.
 * Renders as a native `role="spinbutton"` (`aria-valuemin`/`aria-valuemax`/
 * `aria-valuenow`/`aria-valuetext`) flanked by two `<button>`s, so it's
 * keyboard- (arrow keys, plus `Home`/`End` when `min`/`max` are set) and
 * screen-reader-accessible without any extra markup.
 *
 * Pass `name` to bind it to the enclosing `<Form>`; the form's numeric value
 * for that field is stepped in place. Without `name`, use it as a controlled
 * component with `value`/`onChange`, or uncontrolled with `defaultValue`.
 *
 * Pass `useFloat` to step and display a float instead of an integer: the
 * display always shows two decimal places with a comma separator (`5,00`,
 * `5,01`), except `0` which is shown bare. `step` defaults to `0.1` in that
 * case, `1` otherwise.
 *
 * @example
 * ```tsx
 * <NumberInput label="Quantity" min={0} max={10} defaultValue={1} />
 *
 * <NumberInput name="weight" label="Weight (kg)" useFloat min={0} max={5} />
 * ```
 */
export function NumberInput({
  className,
  label,
  name,
  value,
  defaultValue = 0,
  onChange,
  min,
  max,
  step,
  useFloat = false,
  disabled = false,
  ...rest
}: NumberInputProps) {
  const form = useContext(FormContext);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const labelId = useId();
  const stepSize = step ?? (useFloat ? 0.1 : 1);

  const currentValue =
    name && form ? Number(form.getValue(name) ?? defaultValue) : (value ?? internalValue);

  const commit = (next: number) => {
    const clamped = clamp(roundStep(next, useFloat), min, max);
    if (name && form) {
      form.setValue(name, clamped);
    } else {
      if (value === undefined) setInternalValue(clamped);
      onChange?.(clamped);
    }
  };

  const increment = () => {
    if (disabled) return;
    commit(currentValue + stepSize);
  };

  const decrement = () => {
    if (disabled) return;
    commit(currentValue - stepSize);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      increment();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      decrement();
    } else if (event.key === "Home" && min !== undefined) {
      event.preventDefault();
      commit(min);
    } else if (event.key === "End" && max !== undefined) {
      event.preventDefault();
      commit(max);
    }
  };

  const formatted = formatValue(currentValue, useFloat);

  return (
    <div className={cx("eink-number-input", [className ?? "", !!className])} {...rest}>
      <Label.Form id={labelId} className="eink-number-input__label">
        {label}
      </Label.Form>
      <div className="eink-number-input__control">
        <button
          type="button"
          className="eink-number-input__button"
          disabled={disabled || (min !== undefined && currentValue <= min)}
          aria-label="Decrease"
          onClick={decrement}
        >
          <Icon name="minus" size={16} aria-hidden="true" />
        </button>
        <div
          role="spinbutton"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-valuetext={formatted}
          aria-disabled={disabled}
          className="eink-number-input__value"
          onKeyDown={handleKeyDown}
        >
          {formatted}
        </div>
        <button
          type="button"
          className="eink-number-input__button"
          disabled={disabled || (max !== undefined && currentValue >= max)}
          aria-label="Increase"
          onClick={increment}
        >
          <Icon name="plus" size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
