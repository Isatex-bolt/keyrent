"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

export type CheckItem = { key: string; label: string; done: boolean; href: string; cta: string; doneOnClick?: boolean };

/** "Inizia con KeyRent": checklist per i noleggiatori nuovi. Si chiude quando vuoi e sparisce quando è completa. */
export function ProChecklist({ orgId, items }: { orgId: string; items: CheckItem[] }) {
  const key = `kr-checklist-${orgId}`;
  const [state, setState] = useState<{ hidden: boolean; clicked: string[] } | null>(null);
  useEffect(() => {
    let v = { hidden: false, clicked: [] as string[] };
    try { v = { ...v, ...JSON.parse(localStorage.getItem(key) ?? "{}") }; } catch { /* niente */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferenza salvata nel browser, letta dopo il montaggio
    setState(v);
  }, [key]);
  if (!state || state.hidden) return null;
  const save = (v: typeof state) => { setState(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* niente */ } };
  const list = items.map((i) => ({ ...i, done: i.done || (!!i.doneOnClick && state.clicked.includes(i.key)) }));
  const done = list.filter((i) => i.done).length;
  if (done === list.length) return null;
  const next = list.find((i) => !i.done)?.key;
  return (
    <section className="card p-5" aria-labelledby="kr-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="kr-start" className="text-lg font-semibold">Inizia con KeyRent</h2>
          <p className="text-sm text-mute">{done}/{list.length} completati</p>
        </div>
        <button type="button" onClick={() => save({ ...state, hidden: true })} className="rounded-lg px-2 py-1 text-sm text-mute hover:bg-navy-50" aria-label="Nascondi la checklist">Nascondi</button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy-50"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${(done / list.length) * 100}%` }} /></div>
      <ul className="mt-4 divide-y divide-line">
        {list.map((i) => (
          <li key={i.key} className="flex items-center gap-3 py-3">
            <span aria-hidden className={`grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-bold ${i.done ? "bg-teal-500 text-navy-950" : "border-2 border-navy-100"}`}>{i.done ? "✓" : ""}</span>
            <span className={`min-w-0 flex-1 text-[15px] ${i.done ? "text-mute line-through decoration-navy-100" : "font-medium"}`}>{i.label}</span>
            {!i.done && (
              <Link href={i.href} onClick={() => { track("checklist_cta_clicked", { item: i.key }); if (i.doneOnClick) save({ ...state, clicked: [...state.clicked, i.key] }); }}
                className={`${i.key === next ? "btn-primary" : "btn-ghost"} h-10 whitespace-nowrap px-4 py-0 text-sm`}>{i.cta}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
