"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORIES } from "@/lib/catalog";

/** Menu "Cosa": campo arrotondato come gli altri, lista a comparsa moderna (niente menu di sistema). */
export function CategoryPicker({ id, name = "cat", value, defaultValue = "", onChange, allLabel = "Tutti i mezzi" }: {
  id: string; name?: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; allLabel?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const v = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ sheet: boolean; left: number; width: number; top?: number; bottom?: number }>({ sheet: false, left: 0, width: 0 });
  const listId = useId();
  const options = [{ slug: "", name: allLabel }, ...CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))];
  const current = options.find((o) => o.slug === v) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = box.current!.getBoundingClientRect();
    const sheet = window.innerWidth < 640;
    const below = window.innerHeight - r.bottom;
    setPos(sheet ? { sheet, left: 0, width: 0 }
      : below > 340 || below > r.top ? { sheet, left: r.left, width: r.width, top: r.bottom + 6 }
      : { sheet, left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 });
    setActive(Math.max(0, options.indexOf(current)));
    setOpen(true);
  }
  // su computer la lista è agganciata al campo: se la pagina scorre, si chiude
  useEffect(() => {
    if (!open || pos.sheet) return;
    const shut = () => setOpen(false);
    window.addEventListener("scroll", shut, true);
    return () => window.removeEventListener("scroll", shut, true);
  }, [open, pos.sheet]);

  function pick(slug: string) {
    setInner(slug); onChange?.(slug); setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); toggle(); return;
    }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(options[active].slug); }
  }

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={v} />
      <button id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        onClick={toggle} onKeyDown={onKey}
        className={`field flex items-center justify-between gap-2 text-left ${open ? "border-teal-500 ring-4 ring-teal-500/15" : ""}`}>
        <span className={v ? "text-ink" : "text-ink/80"}>{current.name}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 flex-none text-mute transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && createPortal(
        <>
          {pos.sheet && <div aria-hidden className="fixed inset-0 z-[70] animate-[kr-fade_.2s_ease-out] bg-navy-950/40" />}
          <ul ref={list} id={listId} role="listbox" aria-labelledby={id}
            style={pos.sheet ? undefined : { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            className={pos.sheet
              ? "fixed inset-x-0 bottom-0 z-[71] max-h-[75dvh] animate-[kr-up_.25s_cubic-bezier(.2,.8,.2,1)] overflow-y-auto rounded-t-3xl bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl"
              : "fixed z-[71] max-h-80 animate-[kr-rise_.15s_ease-out_both] overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_12px_40px_rgba(1,25,56,0.16)]"}>
            {pos.sheet && (
              <li role="presentation" className="sticky top-0 bg-white pb-2 pt-1">
                <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-navy-900/15" />
                <span className="block px-2 text-lg font-semibold">Cosa vuoi noleggiare?</span>
              </li>
            )}
            {options.map((o, i) => {
              const on = o.slug === v;
              return (
                <li key={o.slug || "all"} role="option" aria-selected={on}
                  onMouseEnter={() => setActive(i)} onClick={() => pick(o.slug)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 text-[15px] transition ${pos.sheet ? "py-3.5 text-base" : "py-3"} ${
                    i === active ? "bg-navy-50" : ""} ${on ? "font-semibold text-navy-900" : "text-ink"}`}>
                  {o.name}
                  {on && <span aria-hidden className="h-2 w-2 rounded-full bg-teal-500" />}
                </li>
              );
            })}
          </ul>
        </>,
        document.body,
      )}
    </div>
  );
}
