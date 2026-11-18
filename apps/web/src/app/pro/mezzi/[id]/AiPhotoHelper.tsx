"use client";

import { useState } from "react";
import { PhotoUploader } from "./PhotoUploader";

const SETTINGS: Record<string, { label: string; text: string }[]> = {
  default: [
    { label: "Città", text: "parcheggiato in una via elegante di un centro storico italiano, luce del tardo pomeriggio" },
    { label: "Mare", text: "su una strada costiera italiana con il mare sullo sfondo, giornata di sole" },
    { label: "Montagna", text: "su una strada di montagna nelle Dolomiti, cielo limpido" },
    { label: "Campagna", text: "su una strada di campagna in Toscana tra i cipressi, luce dorata" },
    { label: "Studio", text: "in uno studio fotografico con sfondo grigio chiaro uniforme e luce morbida" },
  ],
  barche: [
    { label: "Mare", text: "ormeggiata in una caletta di acqua turchese in Sardegna, giornata di sole" },
    { label: "Porto", text: "ormeggiata in un piccolo porto italiano con case colorate sullo sfondo" },
    { label: "Lago", text: "sul Lago di Garda con le montagne sullo sfondo, acqua calma" },
  ],
  bici: [
    { label: "Città", text: "appoggiata a un muro in una piazza di un centro storico italiano" },
    { label: "Lungomare", text: "su una pista ciclabile sul lungomare, giornata di sole" },
    { label: "Montagna", text: "su un sentiero di montagna nelle Dolomiti" },
    { label: "Campagna", text: "su una strada bianca in Toscana tra le vigne" },
  ],
};

const NOUN: Record<string, string> = {
  auto: "automobile", moto: "moto", bici: "bicicletta", camper: "camper", barche: "barca", furgoni: "furgone", "quad-motoslitte": "quad",
};

/** Prepara il testo da incollare in ChatGPT con i dati del mezzo; l'immagine caricata viene marcata come indicativa. */
export function AiPhotoHelper({ listingId, category, vehicle, year }: { listingId: string; category: string; vehicle: string; year: number | null }) {
  const options = SETTINGS[category] ?? SETTINGS.default;
  const [color, setColor] = useState("");
  const [y, setY] = useState(year ? String(year) : "");
  const [setting, setSetting] = useState(0);
  const [copied, setCopied] = useState(false);

  const prompt = `Crea una fotografia realistica e professionale di ${NOUN[category] ? `un/una ${NOUN[category]}` : "un veicolo"} ${vehicle}`
    + `${y ? ` del ${y}` : ""}${color ? `, colore ${color}` : ""}, ${options[setting]?.text}. `
    + `Inquadratura di tre quarti anteriore, mezzo intero e ben visibile, aspetto pulito e nuovo. `
    + `Nessuna targa leggibile, nessuna persona, nessun testo o scritta aggiunta. Formato orizzontale 4:3, alta qualità.`;

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Foto ambientata con ChatGPT</h2>
      <p className="mt-1 text-sm text-mute">
        Non hai ancora le foto? Prepariamo il testo con i dati del mezzo: lo incolli in ChatGPT e carichi qui l&apos;immagine.
        Sul sito comparirà con l&apos;etichetta &quot;Immagine indicativa&quot;, finché non aggiungi le foto vere.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ai-col">Colore</label>
          <input id="ai-col" className="field" placeholder="es. bianco perla" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ai-year">Anno</label>
          <input id="ai-year" className="field" inputMode="numeric" placeholder="es. 2023" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
        <div>
          <span className="label">Ambientazione</span>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o, i) => (
              <button key={o.label} type="button" onClick={() => setSetting(i)} className={`chip px-3 py-1.5 ${i === setting ? "chip-on" : ""}`}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-800">{prompt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary"
          onClick={async () => { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
          {copied ? "Copiato ✓ Ora incollalo in ChatGPT" : "1. Copia il testo"}
        </button>
        <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="btn-ghost">2. Apri ChatGPT ↗</a>
        <PhotoUploader listingId={listingId} indicative label="3. Carica l'immagine creata" />
      </div>
    </section>
  );
}
