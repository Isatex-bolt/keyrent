"use client";

import { useState } from "react";

/** Campo data con testo segnaposto (su iPhone un campo data vuoto appare come una casella bianca). */
export function DateField({ id, name, value, defaultValue, onChange, min, required, placeholder = "Scegli la data", className = "field" }: {
  id: string; name: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; min?: string; required?: boolean; placeholder?: string; className?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const v = value ?? inner;
  return (
    <div className="relative">
      <input id={id} name={name} type="date" min={min} value={v} required={required}
        onChange={(e) => { setInner(e.target.value); onChange?.(e.target.value); }}
        className={`peer ${className} ${v ? "" : "date-empty"}`} />
      {!v && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] text-mute/80 peer-focus:hidden">
          {placeholder}
        </span>
      )}
    </div>
  );
}
