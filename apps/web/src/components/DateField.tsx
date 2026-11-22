"use client";

import { useState } from "react";

/** Campo data con testo segnaposto (su iPhone un campo data vuoto appare come una casella bianca). */
export function DateField({ id, name, value, defaultValue, onChange, min, required, placeholder = "Scegli la data" }: {
  id: string; name: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; min?: string; required?: boolean; placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const v = value ?? inner;
  return (
    <div className="relative">
      <input id={id} name={name} type="date" min={min} value={v} required={required}
        onChange={(e) => { setInner(e.target.value); onChange?.(e.target.value); }}
        className={`field ${v ? "" : "date-empty"}`} />
      {!v && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center gap-2 text-[15px] text-mute/80">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          {placeholder}
        </span>
      )}
    </div>
  );
}
