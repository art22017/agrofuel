// Adapted from https://21st.dev/@kuratlielia/components/segmented-control
// Original: https://github.com/kuratlielia/arc-library — MIT, Copyright (c) 2026 Elia Kuratli.
import { useRef, type KeyboardEvent } from "react";

type Option = {value:string; label:string};
export default function SegmentedControl({label, value, onValueChange, options}: {
  label:string; value:string; onValueChange:(value:string) => void; options:Option[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const selected = Math.max(0,options.findIndex(option => option.value === value));
  const onKeyDown = (event:KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (selected === last ? 0 : selected + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (selected === 0 ? last : selected - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0 || !options[next]) return;
    event.preventDefault(); onValueChange(options[next].value);
    track.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(options[next].value)}"]`)?.focus();
  };
  return <div className="segment-21" role="group" aria-label={label} ref={track}>
    {options.map((option,index) => <button type="button" key={option.value} data-value={option.value}
      aria-pressed={value === option.value} tabIndex={index === selected ? 0 : -1}
      onKeyDown={onKeyDown} onClick={() => onValueChange(option.value)}>{option.label}</button>)}
  </div>;
}
