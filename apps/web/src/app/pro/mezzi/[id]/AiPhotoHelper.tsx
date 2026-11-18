"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateListingPhoto } from "../../actions";

export type SettingOption = { key: string; label: string };

/** Crea in automatico una foto ambientata dai dati del mezzo; viene salvata come "immagine indicativa". */
export function AiPhotoHelper({ listingId, vehicle, year, settings }: { listingId: string; vehicle: string; year: number | null; settings: SettingOption[] }) {
  const router = useRouter();
  const [color, setColor] = useState("");
  const [y, setY] = useState(year ? String(year) : "");
  const [setting, setSetting] = useState(settings[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create() {
    setBusy(true); setMsg(null);
    const res = await generateListingPhoto(listingId, { color, year: y, setting }).catch(() => ({ error: "Qualcosa è andato storto. Riprova." }));
    setBusy(false);
    if ("error" in res && res.error) setMsg({ ok: false, text: res.error });
    else { setMsg({ ok: true, text: "Foto creata e aggiunta all'annuncio. Se non ti piace, eliminala e creane un'altra." }); router.refresh(); }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Crea foto ambientata con l&apos;AI</h2>
      <p className="mt-1 text-sm text-mute">
        Per <strong>{vehicle}</strong>: scegli colore, anno e ambientazione e la foto si crea da sola.
        Sul sito comparirà con l&apos;etichetta &quot;Immagine indicativa&quot;, finché non aggiungi foto vere.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="label" htmlFor="ai-col">Colore</label>
          <input id="ai-col" className="field" placeholder="es. bianco perla" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ai-year">Anno</label>
          <input id="ai-year" className="field" inputMode="numeric" placeholder="2023" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </div>
      <div className="mt-3">
        <span className="label">Ambientazione</span>
        <div className="flex flex-wrap gap-2">
          {settings.map((o) => (
            <button key={o.key} type="button" onClick={() => setSetting(o.key)} className={`chip ${o.key === setting ? "chip-on" : ""}`}>{o.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={create}>
          {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-950 border-t-transparent" /> Sto creando la foto… (fino a 30 secondi)</> : "✨ Crea foto"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-teal-600" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
