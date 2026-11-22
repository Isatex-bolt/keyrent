"use client";

import { useRef, useState } from "react";
import { createListing } from "../../actions";
import { searchCatalog, type CatalogEntry } from "@/data/catalog";
import { CategoryIcon } from "@/components/CategoryIcon";

type Cat = { slug: string; name: string; subs: { slug: string; name: string }[] };
type Attr = { category: string; key: string; label: string; type: string; unit: string | null; options: string[] | null };
type Loc = { id: string; name: string; city: string };

const STEPS = ["Il mezzo", "Caratteristiche", "Prezzi e condizioni", "Sede e descrizione", "Riepilogo"];

export function Wizard({ cats, attrs, locations }: { cats: Cat[]; attrs: Attr[]; locations: Loc[] }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [manual, setManual] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [year, setYear] = useState("");
  const [kw, setKw] = useState("");
  const [qty, setQty] = useState("1");
  const [loc, setLoc] = useState(locations[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [descTouched, setDescTouched] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const results = q.trim().length >= 2 ? searchCatalog(q, undefined, 8) : [];
  const catObj = cats.find((c) => c.slug === cat);
  const catAttrs = attrs.filter((a) => a.category === cat);
  const autoTitle = picked ? `${picked.make} ${picked.model}` : [customMake, customModel].filter(Boolean).join(" ");
  const shownTitle = titleTouched ? title : `${autoTitle}${year && autoTitle ? ` ${year}` : ""}`.trim();
  const city = locations.find((l) => l.id === loc)?.city ?? "";
  const subName = catObj?.subs.find((s) => s.slug === sub)?.name;
  const autoDesc = shownTitle
    ? `${shownTitle}${subName ? ` (${subName.toLowerCase()})` : ""} disponibile a noleggio${city ? ` a ${city}` : ""}. `
      + "Mezzo curato e controllato prima di ogni consegna. Scrivi qui cosa è incluso (accessori, assicurazione, chilometri) e i consigli per il cliente."
    : "";
  const shownDesc = descTouched ? desc : autoDesc;

  function choose(e: CatalogEntry) {
    setPicked(e); setCat(e.category); setSub(e.sub); setManual(false); setOpen(false); setQ(""); setError("");
  }

  function validate(s: number) {
    const f = formRef.current!;
    const scope = f.querySelector<HTMLElement>(`[data-step="${s}"]`);
    const invalid = scope?.querySelector<HTMLInputElement>(":invalid");
    if (invalid) { invalid.reportValidity(); return false; }
    if (s === 0 && !cat) { setError(manual ? "Scegli il tipo di mezzo." : "Cerca il modello oppure inseriscilo a mano."); return false; }
    if (s === 0 && !shownTitle.trim()) { setError("Indica marca e modello."); return false; }
    if (s === 2) {
      const any = ["hour", "half_day", "day", "week"].some((u) => Number((f.elements.namedItem(`price_${u}`) as HTMLInputElement)?.value) > 0);
      if (!any) { setError("Inserisci almeno un prezzo."); return false; }
    }
    if (s === 3 && shownDesc.trim().length < 40) { setError("La descrizione deve avere almeno 40 caratteri."); return false; }
    setError("");
    return true;
  }
  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const cv = kw && Number(kw) > 0 ? Math.round(Number(kw) / 0.73549875) : "";

  return (
    <form ref={formRef} action={createListing} className="card overflow-visible p-5 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-semibold text-mute">
          <span>Passo {step + 1} di {STEPS.length}</span><span>{STEPS[step]}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-50">
          <div className="h-full rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <input type="hidden" name="category" value={cat} />
      <input type="hidden" name="subcategory" value={sub} />
      {picked && <><input type="hidden" name="make" value={picked.makeSlug} /><input type="hidden" name="model" value={picked.modelSlug} /></>}
      {!picked && manual && <><input type="hidden" name="custom_make" value={customMake} /><input type="hidden" name="custom_model" value={customModel} /></>}
      <input type="hidden" name="title" value={shownTitle} />
      <input type="hidden" name="description" value={shownDesc} />

      {/* 1 · Il mezzo */}
      <section data-step="0" hidden={step !== 0} className="space-y-5">
        <h2 className="text-lg font-bold">Che mezzo vuoi pubblicare?</h2>

        {picked ? (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-teal-500 bg-teal-50 p-4">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-white text-teal-600"><CategoryIcon slug={picked.category} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{picked.make} {picked.model}</p>
              <p className="text-sm text-mute">{cats.find((c) => c.slug === picked.category)?.name}{subName ? ` · ${subName}` : ""}</p>
            </div>
            <button type="button" className="text-sm font-semibold text-teal-600 hover:underline" onClick={() => { setPicked(null); setCat(""); setSub(""); }}>Cambia</button>
          </div>
        ) : !manual ? (
          <div className="relative">
            <label htmlFor="cat-search" className="label">Cerca marca e modello</label>
            <input id="cat-search" autoFocus autoComplete="off" className="field py-4 text-lg" placeholder="Es. Ducato, Golf, Kosmo, Turbo Levo…"
              value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (!results.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
                else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
              }} />
            {open && results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                {results.map((r, i) => (
                  <li key={`${r.category}-${r.makeSlug}-${r.modelSlug}`}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-navy-50" : "hover:bg-navy-50"}`}>
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-teal-50 text-teal-600"><CategoryIcon slug={r.category} className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.make} {r.model}</span>
                        <span className="block text-xs text-mute">{cats.find((c) => c.slug === r.category)?.name} · {cats.find((c) => c.slug === r.category)?.subs.find((s) => s.slug === r.sub)?.name ?? r.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim().length >= 2 && results.length === 0 && (
              <p className="mt-2 text-sm text-mute">Nessun modello trovato con &quot;{q}&quot;.</p>
            )}
            <button type="button" className="mt-3 text-sm font-semibold text-teal-600 hover:underline"
              onClick={() => { setManual(true); setCustomModel(q); }}>
              Non lo trovi? Inseriscilo a mano →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="label">Tipo di mezzo</span>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button type="button" key={c.slug} onClick={() => { setCat(c.slug); setSub(""); }} className={`chip ${cat === c.slug ? "chip-on" : ""}`}>
                    <CategoryIcon slug={c.slug} className="h-4 w-4" />{c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="cm">Marca</label><input id="cm" required className="field" value={customMake} onChange={(e) => setCustomMake(e.target.value)} /></div>
              <div><label className="label" htmlFor="cmo">Modello</label><input id="cmo" required className="field" value={customModel} onChange={(e) => setCustomModel(e.target.value)} /></div>
            </div>
            <button type="button" className="text-sm font-semibold text-teal-600 hover:underline" onClick={() => { setManual(false); setCat(""); }}>← Torna alla ricerca</button>
          </div>
        )}

        {cat && (
          <div className="grid gap-4 sm:grid-cols-3">
            {(catObj?.subs.length ?? 0) > 0 && (
              <div><label className="label" htmlFor="sub">Tipologia</label>
                <select id="sub" className="field" value={sub} onChange={(e) => setSub(e.target.value)}>
                  <option value="">—</option>
                  {catObj!.subs.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select></div>
            )}
            <div><label className="label" htmlFor="year">Anno</label>
              <input id="year" name="year" type="number" inputMode="numeric" min={1950} max={2100} className="field" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Es. 2023" /></div>
            <div><label className="label" htmlFor="plate">Targa (facoltativa)</label><input id="plate" name="plate" className="field uppercase" /></div>
            <div className="sm:col-span-3"><label className="label" htmlFor="title-in">Titolo dell&apos;annuncio</label>
              <input id="title-in" required maxLength={120} className="field" value={shownTitle}
                onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} /></div>
          </div>
        )}
      </section>

      {/* 2 · Caratteristiche (precompilate dal catalogo quando certe) */}
      <section data-step="1" hidden={step !== 1} className="space-y-4" key={`attrs-${cat}-${picked?.modelSlug ?? "x"}`}>
        <div>
          <h2 className="text-lg font-bold">Caratteristiche</h2>
          <p className="text-sm text-mute">Facoltative, ma aiutano i clienti a trovarti con i filtri. {picked && Object.keys(picked.specs).length > 0 && "Alcune le abbiamo già compilate per te."}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {catAttrs.map((a) => {
            const pre = picked?.specs[a.key];
            const def = pre === undefined ? "" : String(pre);
            return a.key === "power_kw" ? (
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
                  <select id={`attr_${a.key}`} name={`attr_${a.key}`} className="field" defaultValue={def}>
                    <option value="">—</option>{a.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : a.type === "boolean" ? (
                  <select id={`attr_${a.key}`} name={`attr_${a.key}`} className="field" defaultValue={def}><option value="">—</option><option value="true">Sì</option><option value="false">No</option></select>
                ) : (
                  <input id={`attr_${a.key}`} name={`attr_${a.key}`} type={a.type === "number" ? "number" : "text"} min={0} className="field" defaultValue={def} />
                )}
              </div>
            );
          })}
          {!catAttrs.length && <p className="text-sm text-mute">Nessuna caratteristica specifica per questo tipo di mezzo: puoi andare avanti.</p>}
        </div>
      </section>

      {/* 3 · Prezzi e condizioni principali */}
      <section data-step="2" hidden={step !== 2} className="space-y-5">
        <div>
          <h2 className="text-lg font-bold">Prezzi</h2>
          <p className="text-sm text-mute">Compila solo le tariffe che offri: al cliente proponiamo sempre la combinazione più conveniente.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["price_day", "Al giorno"], ["price_week", "A settimana"], ["price_half_day", "Mezza giornata"], ["price_hour", "All'ora"]].map(([n, l], i) => (
            <div key={n}><label className="label" htmlFor={n}>{l} (€)</label>
              <input id={n} name={n} type="number" inputMode="decimal" min={0} step="0.01" className={`field ${i === 0 ? "border-teal-500" : ""}`} /></div>
          ))}
        </div>
        <div>
          <h3 className="font-semibold">Condizioni principali</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="deposit">Cauzione (€)</label><input id="deposit" name="deposit" type="number" min={0} className="field" placeholder="Es. 500" /></div>
            <div><label className="label" htmlFor="min_driver_age">Età minima</label><input id="min_driver_age" name="min_driver_age" type="number" min={14} max={99} className="field" placeholder="Es. 21" /></div>
            <div><label className="label" htmlFor="included_km_per_day">Km inclusi al giorno</label><input id="included_km_per_day" name="included_km_per_day" type="number" min={0} className="field" placeholder="Vuoto = illimitati" /></div>
          </div>
        </div>
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-600">Altre condizioni (facoltative)</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="required_license">Patente richiesta</label><input id="required_license" name="required_license" className="field" placeholder="Es. B, A2, nautica" /></div>
            <div><label className="label" htmlFor="min_license_years">Patente da almeno (anni)</label><input id="min_license_years" name="min_license_years" type="number" min={0} className="field" /></div>
            <div><label className="label" htmlFor="extra_km">Costo km extra (€)</label><input id="extra_km" name="extra_km" type="number" min={0} step="0.01" className="field" /></div>
            <div><label className="label" htmlFor="insurance_excess">Franchigia assicurativa (€)</label><input id="insurance_excess" name="insurance_excess" type="number" min={0} className="field" /></div>
            <div><label className="label" htmlFor="fuel_policy">Carburante</label><input id="fuel_policy" name="fuel_policy" className="field" placeholder="Es. pieno/pieno" /></div>
            <div><label className="label" htmlFor="min_duration_minutes">Durata minima</label>
              <select id="min_duration_minutes" name="min_duration_minutes" className="field" defaultValue="1440">
                <option value="60">1 ora</option><option value="240">Mezza giornata</option><option value="1440">1 giorno</option><option value="2880">2 giorni</option><option value="10080">1 settimana</option>
              </select></div>
            <div><label className="label" htmlFor="buffer_minutes">Preparazione tra due noleggi</label>
              <select id="buffer_minutes" name="buffer_minutes" className="field" defaultValue="60">
                <option value="0">Nessuna</option><option value="60">1 ora</option><option value="120">2 ore</option><option value="240">4 ore</option><option value="1440">1 giorno</option>
              </select></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="terms_notes">Note</label><textarea id="terms_notes" name="terms_notes" rows={2} className="field" /></div>
          </div>
        </details>
      </section>

      {/* 4 · Sede, quantità, descrizione */}
      <section data-step="3" hidden={step !== 3} className="space-y-4">
        <h2 className="text-lg font-bold">Dove si ritira e com&apos;è</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="location_id">Sede di ritiro</label>
            <select id="location_id" name="location_id" required className="field" value={loc} onChange={(e) => setLoc(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
            </select></div>
          <div><label className="label" htmlFor="quantity">Quanti mezzi identici hai?</label>
            <input id="quantity" name="quantity" type="number" min={1} max={200} className="field" value={qty} onChange={(e) => setQty(e.target.value)} />
            {Number(qty) > 1 && <p className="mt-1 text-xs text-mute">Un solo annuncio: la disponibilità scende a ogni prenotazione.</p>}
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="desc">Descrizione</label>
            <textarea id="desc" rows={5} className="field" value={shownDesc}
              onChange={(e) => { setDescTouched(true); setDesc(e.target.value); }} />
            <p className="mt-1 text-xs text-mute">Te l&apos;abbiamo preparata noi: personalizzala. Niente telefono, email o link: il cliente ti scrive in chat.</p>
          </div>
        </div>
      </section>

      {/* 5 · Riepilogo */}
      <section data-step="4" hidden={step !== 4} className="space-y-3 text-sm">
        <h2 className="text-lg font-bold">Tutto pronto</h2>
        <div className="rounded-2xl bg-canvas p-4">
          <p className="text-base font-bold">{shownTitle || "—"}</p>
          <p className="text-mute">{catObj?.name}{subName ? ` · ${subName}` : ""} · {Number(qty) > 1 ? `${qty} mezzi` : "1 mezzo"} · {city}</p>
        </div>
        <p className="rounded-xl bg-teal-50 p-3">Creiamo una <strong>bozza</strong>. Poi aggiungi le foto (almeno 4, oppure creale con l&apos;AI) e invia l&apos;annuncio in revisione.</p>
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
