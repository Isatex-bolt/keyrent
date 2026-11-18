"use client";

import { useMemo, useRef, useState } from "react";
import { createListing } from "../../actions";

type Cat = { slug: string; name: string; subs: { slug: string; name: string }[] };
type Make = { slug: string; name: string; category: string; models: { slug: string; name: string }[] };
type Attr = { category: string; key: string; label: string; type: string; unit: string | null; options: string[] | null };
type Loc = { id: string; name: string; city: string };

const STEPS = ["Categoria", "Marca e modello", "Caratteristiche", "Condizioni", "Prezzi", "Sede e quantità", "Riepilogo"];

export function Wizard({ cats, makes, attrs, locations }: { cats: Cat[]; makes: Make[]; attrs: Attr[]; locations: Loc[] }) {
  const [step, setStep] = useState(0);
  const [cat, setCat] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [kw, setKw] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const catMakes = useMemo(() => makes.filter((m) => m.category === cat), [makes, cat]);
  const selMake = catMakes.find((m) => m.slug === make);
  const catAttrs = attrs.filter((a) => a.category === cat);
  const autoTitle = [selMake?.name ?? customMake, selMake?.models.find((m) => m.slug === model)?.name ?? customModel].filter(Boolean).join(" ");
  const shownTitle = titleTouched ? title : autoTitle;

  function validate(s: number) {
    const f = formRef.current!;
    const scope = f.querySelector<HTMLElement>(`[data-step="${s}"]`);
    const invalid = scope?.querySelector<HTMLInputElement>(":invalid");
    if (invalid) { invalid.reportValidity(); return false; }
    if (s === 0 && !cat) { setError("Scegli una categoria."); return false; }
    if (s === 1 && !shownTitle.trim()) { setError("Indica marca e modello o un titolo."); return false; }
    if (s === 4) {
      const any = ["hour", "half_day", "day", "week"].some((u) => Number((f.elements.namedItem(`price_${u}`) as HTMLInputElement)?.value) > 0);
      if (!any) { setError("Inserisci almeno un prezzo."); return false; }
    }
    setError("");
    return true;
  }
  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const cv = kw && Number(kw) > 0 ? Math.round(Number(kw) / 0.73549875) : "";

  return (
    <form ref={formRef} action={createListing} className="card p-5 sm:p-6" noValidate={false}>
      <ol className="mb-6 flex gap-1 overflow-x-auto pb-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium ${i === step ? "bg-navy-900 text-white" : i < step ? "bg-teal-50 text-teal-700" : "bg-canvas text-mute"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <input type="hidden" name="category" value={cat} />

      <section data-step="0" hidden={step !== 0} className="space-y-4">
        <h2 className="font-semibold">Che tipo di mezzo è?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cats.map((c) => (
            <button type="button" key={c.slug} onClick={() => { setCat(c.slug); setMake(""); setModel(""); }}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${cat === c.slug ? "border-teal-500 bg-teal-50" : "border-line bg-white"}`}>
              {c.name}
            </button>
          ))}
        </div>
        {cat && (cats.find((c) => c.slug === cat)?.subs.length ?? 0) > 0 && (
          <div><label className="label" htmlFor="subcategory">Tipologia</label>
            <select id="subcategory" name="subcategory" className="field" defaultValue="">
              <option value="">—</option>
              {cats.find((c) => c.slug === cat)!.subs.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select></div>
        )}
      </section>

      <section data-step="1" hidden={step !== 1} className="space-y-4">
        <h2 className="font-semibold">Marca e modello</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="make">Marca</label>
            <select id="make" name="make" className="field" value={make} onChange={(e) => { setMake(e.target.value); setModel(""); }}>
              <option value="">{catMakes.length ? "Scegli…" : "Nessuna a catalogo"}</option>
              {catMakes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              <option value="__altra">Altra marca…</option>
            </select></div>
          {selMake ? (
            <div><label className="label" htmlFor="model">Modello</label>
              <select id="model" name="model" className="field" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Scegli…</option>
                {selMake.models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              </select></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="custom_make">Marca</label>
                <input id="custom_make" name="custom_make" className="field" value={customMake} onChange={(e) => setCustomMake(e.target.value)} /></div>
              <div><label className="label" htmlFor="custom_model">Modello</label>
                <input id="custom_model" name="custom_model" className="field" value={customModel} onChange={(e) => setCustomModel(e.target.value)} /></div>
            </div>
          )}
          <div className="sm:col-span-2"><label className="label" htmlFor="title">Titolo dell&apos;annuncio</label>
            <input id="title" name="title" required maxLength={120} className="field" value={shownTitle}
              onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} placeholder="Es. Laika Kosmo 6 posti" /></div>
          <div><label className="label" htmlFor="year">Anno</label><input id="year" name="year" type="number" min={1950} max={2100} className="field" /></div>
          <div><label className="label" htmlFor="plate">Targa / matricola (facoltativa)</label><input id="plate" name="plate" className="field uppercase" /></div>
        </div>
        <p className="text-xs text-mute">Non troviamo il modello? Inseriscilo a mano: lo aggiungeremo al catalogo. Le caratteristiche tecniche non vengono mai inventate.</p>
      </section>

      <section data-step="2" hidden={step !== 2} className="space-y-4">
        <h2 className="font-semibold">Caratteristiche</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {catAttrs.map((a) => a.key === "power_kw" ? (
            <div key={a.key}><label className="label" htmlFor="attr_power_kw">Potenza</label>
              <div className="flex items-center gap-2">
                <input id="attr_power_kw" name="attr_power_kw" type="number" min={1} className="field" placeholder="kW" value={kw} onChange={(e) => setKw(e.target.value)} />
                <span className="text-sm text-mute">kW</span>
                <input aria-label="CV" type="number" min={1} className="field" placeholder="CV" value={cv}
                  onChange={(e) => setKw(e.target.value ? String(Math.round(Number(e.target.value) * 0.73549875)) : "")} />
                <span className="text-sm text-mute">CV</span>
              </div></div>
          ) : (
            <div key={a.key}><label className="label" htmlFor={`attr_${a.key}`}>{a.label}{a.unit ? ` (${a.unit})` : ""}</label>
              {a.type === "enum" ? (
                <select id={`attr_${a.key}`} name={`attr_${a.key}`} className="field" defaultValue="">
                  <option value="">—</option>{a.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : a.type === "boolean" ? (
                <select id={`attr_${a.key}`} name={`attr_${a.key}`} className="field" defaultValue=""><option value="">—</option><option value="true">Sì</option><option value="false">No</option></select>
              ) : (
                <input id={`attr_${a.key}`} name={`attr_${a.key}`} type={a.type === "number" ? "number" : "text"} min={0} className="field" />
              )}
            </div>
          ))}
          {!catAttrs.length && <p className="text-sm text-mute">Nessuna caratteristica specifica per questa categoria.</p>}
        </div>
      </section>

      <section data-step="3" hidden={step !== 3} className="space-y-4">
        <h2 className="font-semibold">Condizioni di noleggio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="deposit">Cauzione (€)</label><input id="deposit" name="deposit" type="number" min={0} className="field" placeholder="Es. 1000" /></div>
          <div><label className="label" htmlFor="min_driver_age">Età minima</label><input id="min_driver_age" name="min_driver_age" type="number" min={14} max={99} className="field" /></div>
          <div><label className="label" htmlFor="min_license_years">Patente da almeno (anni)</label><input id="min_license_years" name="min_license_years" type="number" min={0} className="field" /></div>
          <div><label className="label" htmlFor="required_license">Patente richiesta</label><input id="required_license" name="required_license" className="field" placeholder="Es. B, A2, nautica" /></div>
          <div><label className="label" htmlFor="included_km_per_day">Km inclusi al giorno</label><input id="included_km_per_day" name="included_km_per_day" type="number" min={0} className="field" placeholder="Vuoto = illimitati" /></div>
          <div><label className="label" htmlFor="extra_km">Costo km extra (€)</label><input id="extra_km" name="extra_km" type="number" min={0} step="0.01" className="field" /></div>
          <div><label className="label" htmlFor="insurance_excess">Franchigia assicurativa (€)</label><input id="insurance_excess" name="insurance_excess" type="number" min={0} className="field" /></div>
          <div><label className="label" htmlFor="fuel_policy">Carburante</label><input id="fuel_policy" name="fuel_policy" className="field" placeholder="Es. pieno/pieno" /></div>
          <div><label className="label" htmlFor="min_duration_minutes">Durata minima</label>
            <select id="min_duration_minutes" name="min_duration_minutes" className="field" defaultValue="1440">
              <option value="60">1 ora</option><option value="240">Mezza giornata</option><option value="1440">1 giorno</option><option value="2880">2 giorni</option><option value="10080">1 settimana</option>
            </select></div>
          <div><label className="label" htmlFor="buffer_minutes">Tempo di preparazione tra un noleggio e l&apos;altro</label>
            <select id="buffer_minutes" name="buffer_minutes" className="field" defaultValue="60">
              <option value="0">Nessuno</option><option value="60">1 ora</option><option value="120">2 ore</option><option value="240">4 ore</option><option value="1440">1 giorno</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="terms_notes">Altre condizioni</label><textarea id="terms_notes" name="terms_notes" rows={2} className="field" /></div>
        </div>
        <p className="text-xs text-mute">La cauzione viene mostrata come “gestita direttamente dal noleggiatore al momento del ritiro”.</p>
      </section>

      <section data-step="4" hidden={step !== 4} className="space-y-4">
        <h2 className="font-semibold">Prezzi</h2>
        <p className="text-sm text-mute">Compila solo le tariffe che offri. Al cliente proponiamo sempre la combinazione più conveniente. Le offerte stagionali si aggiungono dopo, nella scheda del mezzo.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {[["price_hour", "All'ora"], ["price_half_day", "Mezza giornata (4 h)"], ["price_day", "Al giorno"], ["price_week", "A settimana"]].map(([n, l]) => (
            <div key={n}><label className="label" htmlFor={n}>{l} (€)</label><input id={n} name={n} type="number" min={0} step="0.01" className="field" /></div>
          ))}
        </div>
      </section>

      <section data-step="5" hidden={step !== 5} className="space-y-4">
        <h2 className="font-semibold">Sede, quantità e descrizione</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="location_id">Sede di ritiro</label>
            <select id="location_id" name="location_id" required className="field" defaultValue={locations[0]?.id}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
            </select></div>
          <div><label className="label" htmlFor="quantity">Quanti mezzi identici hai?</label>
            <input id="quantity" name="quantity" type="number" min={1} max={200} className="field" value={qty} onChange={(e) => setQty(e.target.value)} />
            {Number(qty) > 1 && <p className="mt-1 text-xs text-mute">Un solo annuncio: la disponibilità scende a ogni prenotazione e si esaurisce solo quando sono tutti fuori.</p>}
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Descrizione</label>
            <textarea id="description" name="description" rows={5} minLength={40} required className="field" placeholder="Cosa rende speciale questo mezzo, dotazioni incluse, consigli per il cliente (almeno 40 caratteri)." /></div>
        </div>
        <p className="text-xs text-mute">Non inserire telefono, email o link: il cliente ti contatta tramite la chat di KeyRent.</p>
      </section>

      <section data-step="6" hidden={step !== 6} className="space-y-3 text-sm">
        <h2 className="font-semibold">Riepilogo</h2>
        <p><span className="text-mute">Categoria:</span> {cats.find((c) => c.slug === cat)?.name ?? "—"}</p>
        <p><span className="text-mute">Titolo:</span> {shownTitle || "—"}</p>
        <p><span className="text-mute">Unità:</span> {qty}</p>
        <p className="rounded-xl bg-teal-50 p-3">Creeremo una <strong>bozza</strong>. Nel passo successivo aggiungi le foto (almeno 4) e invia l&apos;annuncio in revisione a KeyRent.</p>
      </section>

      <div className="mt-6 flex justify-between gap-3">
        <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Indietro</button>
        {step < STEPS.length - 1
          ? <button type="button" className="btn-primary" onClick={next}>Avanti →</button>
          : <button type="submit" className="btn-primary">Crea bozza</button>}
      </div>
    </form>
  );
}
