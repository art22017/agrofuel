import type { ReactNode } from "react";
// Visual card shell adapted from the user-provided 21st.dev Finance Bento.
export function BentoFrame({className, children}: {className:string; children:ReactNode}) {
  return <section className={`bento-frame ${className}`}><span className="bento-rim" aria-hidden="true"/>{children}</section>;
}
