"use client";

import { useEffect, useMemo, useState } from "react";

export type EditableVehicle = { title: string; description: string; dayPriceEuro: string; depositEuro: string; instantBook: boolean };
const FIELDS: { key: keyof EditableVehicle; label: string; type?: "textarea" | "number" | "check" }[] = [
  { key: "title", label: "Titolo" },
  { key: "description", label: "Descrizione", type: "textarea" },
  { key: "dayPriceEuro", label: "Prezzo al giorno (€)", type: "number" },
  { key: "depositEuro", label: "Cauzione (€)", type: "number" },
  { key: "instantBook", label: "Prenotazione immediata", type: "check" },
];

/**
 * Scheda in sola lettura → "Modifica annuncio". Modifiche vere solo se qualcosa cambia (dirty-state):
 * senza modifiche non parte nessun salvataggio; "Annulla" ripristina i valori originali.
 * ANTEPRIMA: il salvataggio è disattivato, nessun dato viene scritto.
 */
export function VehicleEditor({ initial, startEditing = false }: { initial: EditableVehicle; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing);
  const [v, setV] = useState(initial);
  const [notice, setNotice] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const changed = useMemo(() => FIELDS.filter((f) => v[f.key] !== initial[f.key]).map((f) => f.label), [v, initial]);
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const exit = () => { setV(initial); setEditing(false); setConfirmExit(false); };
  const set = (k: keyof EditableVehicle, val: string | boolean) => { setV((x) => ({ ...x, [k]: val })); setNotice(""); };

  if (!editing) {
    return (
      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Annuncio</h2>
          <button onClick={() => setEditing(true)} className="btn-primary px-4 py-2 text-sm">Modifica annuncio</button>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <dt className="text-xs text-mute">{f.label}</dt>
              <dd className="whitespace-pre-line font-medium">{f.type === "check" ? (v[f.key] ? "Sì" : "No") : String(v[f.key] || "—")}</dd>
            </div>
          ))}
        </dl>
        {notice && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-navy-900">{notice}</p>}
      </div>
    );
  }
  return (
    <div className="card space-y-4 border-teal-500/40 p-5 ring-4 ring-teal-500/10 animate-[riseIn_.2s_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Modifica annuncio</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dirty ? "bg-amber-100 text-amber-900" : "bg-navy-50 text-mute"}`}>
          {dirty ? `Modificato: ${changed.join(", ")}` : "Nessuna modifica"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "check" ? (
              <label className="flex items-center gap-2 pt-6 text-sm font-medium">
                <input type="checkbox" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            ) : (
              <>
                <label className="label" htmlFor={`e-${f.key}`}>{f.label}</label>
                {f.type === "textarea"
                  ? <textarea id={`e-${f.key}`} rows={4} value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value)} className="field" />
                  : <input id={`e-${f.key}`} type={f.type === "number" ? "number" : "text"} value={String(v[f.key])} onChange={(e) => set(f.key, e.target.value)} className="field" />}
              </>
            )}
          </div>
        ))}
      </div>
      {confirmExit ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm">
          <span className="mr-auto">Hai modifiche non salvate. Uscire e perderle?</span>
          <button onClick={exit} className="btn-ghost text-red-700">Esci senza salvare</button>
          <button onClick={() => setConfirmExit(false)} className="btn-ghost">Continua a modificare</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button disabled={!dirty} onClick={() => { setNotice("Anteprima: con la V2 attiva le modifiche verrebbero salvate (e l'annuncio tornerebbe in approvazione solo se cambiano dati da revisionare). Qui non è stato salvato nulla."); setEditing(false); }}
            className="btn-primary disabled:opacity-40">Salva modifiche</button>
          <button disabled={!dirty} onClick={() => setV(initial)} className="btn-ghost disabled:opacity-40">Annulla modifiche</button>
          <button onClick={() => (dirty ? setConfirmExit(true) : exit())} className="btn-ghost ml-auto">Esci</button>
        </div>
      )}
    </div>
  );
}
