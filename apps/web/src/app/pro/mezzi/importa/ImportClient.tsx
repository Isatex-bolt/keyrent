"use client";

import { useState } from "react";
import Link from "next/link";
import { confirmImport, previewImport } from "../../actions";
import type { PreviewRow } from "@/lib/importSheet";
import { euro } from "@/lib/format";

export function ImportClient() {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  const [done, setDone] = useState<{ created: number; failed: { line: number; error: string }[] } | null>(null);

  const ok = rows?.filter((r) => !r.errors.length) ?? [];
  const bad = rows?.filter((r) => r.errors.length) ?? [];

  async function read(file?: File) {
    if (!file) return;
    setBusy("read"); setError(""); setRows(null); setDone(null);
    const fd = new FormData(); fd.set("file", file);
    const res = await previewImport(fd).catch(() => ({ error: "Caricamento non riuscito, riprova." } as { rows?: PreviewRow[]; error?: string }));
    setBusy("");
    if (res.error) setError(res.error); else setRows(res.rows ?? []);
  }

  if (done) {
    return (
      <div className="card p-6 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-xl font-bold">{done.created} {done.created === 1 ? "annuncio creato" : "annunci creati"} come bozza</p>
        {done.failed.length > 0 && (
          <div className="mx-auto mt-4 max-w-md rounded-xl bg-red-50 p-3 text-left text-sm text-red-800">
            {done.failed.map((f) => <p key={f.line}>Riga {f.line}: {f.error}</p>)}
          </div>
        )}
        <p className="mx-auto mt-3 max-w-md text-sm text-mute">Ora apri ogni annuncio, aggiungi le foto (anche con ✨ l&apos;AI) e invialo in revisione.</p>
        <Link href="/pro/mezzi" className="btn-primary mt-5">Vai ai miei mezzi</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm font-semibold text-teal-600">Passo 1</p>
          <h2 className="mt-1 text-lg font-bold">Scarica il modello</h2>
          <p className="mt-1 text-sm text-mute">Un file Excel con le colonne già pronte, i menu a tendina e una riga di esempio. Una riga = un annuncio.</p>
          <a href="/pro/mezzi/importa/modello" className="btn-ghost mt-4">⬇ Scarica modello Excel</a>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-teal-600">Passo 2</p>
          <h2 className="mt-1 text-lg font-bold">Carica il file compilato</h2>
          <p className="mt-1 text-sm text-mute">Prima di creare qualsiasi annuncio ti mostriamo un&apos;anteprima con eventuali errori.</p>
          <label className={`btn-primary mt-4 cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy === "read" ? "Sto leggendo il file…" : "⬆ Scegli file .xlsx"}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
              onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {rows && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <p className="font-semibold">
              {ok.length} {ok.length === 1 ? "mezzo pronto" : "mezzi pronti"}
              {bad.length > 0 && <span className="text-red-700"> · {bad.length} {bad.length === 1 ? "riga da correggere" : "righe da correggere"}</span>}
            </p>
            <button type="button" className="btn-primary" disabled={!ok.length || !!busy}
              onClick={async () => {
                setBusy("save");
                const res = await confirmImport(rows).catch(() => ({ created: 0, failed: [{ line: 0, error: "Errore di rete, riprova." }] }));
                setBusy(""); setDone(res);
              }}>
              {busy === "save" ? "Creo gli annunci…" : `Crea ${ok.length} ${ok.length === 1 ? "bozza" : "bozze"}`}
            </button>
          </div>
          {bad.length > 0 && <p className="bg-red-50 px-4 py-2 text-xs text-red-800">Le righe con errori non vengono importate: correggile nel file e ricaricalo, oppure prosegui con quelle pronte.</p>}
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.line} className={`flex flex-wrap items-start gap-3 p-4 text-sm ${r.errors.length ? "bg-red-50/40" : ""}`}>
                <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${r.errors.length ? "bg-red-100 text-red-700" : "bg-teal-50 text-teal-600"}`}>
                  {r.errors.length ? "!" : "✓"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.title || `${r.make} ${r.model}`} <span className="font-normal text-mute">· riga {r.line}</span></p>
                  <p className="text-mute">
                    {r.categoryName}{r.subName ? ` · ${r.subName}` : ""}{r.quantity > 1 ? ` · ${r.quantity} mezzi` : ""} · {r.locationName || "—"}
                    {r.prices.day ? ` · ${euro(r.prices.day)}/giorno` : r.prices.week ? ` · ${euro(r.prices.week)}/settimana` : ""}
                  </p>
                  {r.errors.map((e) => <p key={e} className="text-red-700">{e}</p>)}
                  {r.warnings.map((w) => <p key={w} className="text-amber-700">{w}</p>)}
                </div>
                {r.makeSlug && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">a catalogo</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
