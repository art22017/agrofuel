// Adapted from https://21st.dev/@redrob-labs/components/switch
// Original: https://github.com/redrob-labs/redrob-ui — MIT, Copyright (c) 2026 Janghoon Lee and contributors.
export function Switch({label, checked, onChange}: {label:string; checked:boolean; onChange:(value:boolean) => void}) {
  return <label className="switch-21">
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span className="switch-21-track" aria-hidden="true"><span /></span>
    <span>{label}</span>
  </label>;
}
