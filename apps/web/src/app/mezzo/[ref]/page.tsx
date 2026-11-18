import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { euro, priceUnitLabel, romeToIso, todayRome, formatDateIt } from "@/lib/format";
import { idFromRef } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { attributesForCategory, getBusyDays, getCancellationRules, getListing, getQuote } from "@/lib/data";

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default function ListingPage({ params, searchParams }: PageProps<"/mezzo/[ref]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-6xl animate-pulse px-4 py-8 sm:px-6"><div className="h-full rounded-2xl bg-white" /></div>}>
      <Listing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Listing({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Raw> }) {
  const { ref } = await params;
  const sp = await searchParams;
  const id = idFromRef(ref);
  if (!id || !isSupabaseConfigured()) notFound();
  const data = await getListing(id);
  if (!data) notFound();
  const { listing: l, media, prices, extras, indicative } = data;

  const dal = first(sp.dal), al = first(sp.al);
  const pickup = dal ? romeToIso(dal, first(sp.ora_ritiro) ?? "10:00") : null;
  const ret = al ? romeToIso(al, first(sp.ora_riconsegna) ?? "10:00") : null;
  const from = todayRome(), to = todayRome(62);
  const [attrs, rules, quote, busy] = await Promise.all([
    attributesForCategory(l.category_slug),
    getCancellationRules(l.cancellation_policy_id),
    pickup && ret && ret > pickup ? getQuote(id, pickup, ret) : Promise.resolve(null),
    getBusyDays(id, from, to),
  ]);

  const specs = attrs
    .map((a) => {
      const v = l.attributes?.[a.key];
      if (v === undefined || v === null || v === "") return null;
      let shown = typeof v === "boolean" ? (v ? "Sì" : "No") : String(v);
      if (a.key === "power_kw" && typeof v === "number") shown = `${v} kW (${Math.round(v / 0.73549875)} CV)`;
      else if (a.unit) shown = `${shown} ${a.unit}`;
      return { label: a.label_it, value: shown[0].toUpperCase() + shown.slice(1) };
    })
    .filter(Boolean) as { label: string; value: string }[];

  const sortedPrices = [...prices].sort((a, b) => ["hour", "half_day", "day", "week"].indexOf(a.unit) - ["hour", "half_day", "day", "week"].indexOf(b.unit));
  const requestHref = `/prenota/${id}?${new URLSearchParams({ ...(dal ? { dal } : {}), ...(al ? { al } : {}), ...(first(sp.ora_ritiro) ? { ora_ritiro: first(sp.ora_ritiro)! } : {}), ...(first(sp.ora_riconsegna) ? { ora_riconsegna: first(sp.ora_riconsegna)! } : {}) })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav className="mb-4 text-sm text-mute">
        <Link href={`/cerca?cat=${l.category_slug}`} className="hover:text-navy-900">{l.category_name}</Link>
        {l.make_name && <> / <Link href={`/cerca?cat=${l.category_slug}&marca=${l.make_slug ?? ""}`} className="hover:text-navy-900">{l.make_name}</Link></>}
        {l.model_name && <> / {l.model_name}</>}
      </nav>

      <Gallery media={media} title={l.title} category={l.category_slug} indicative={indicative} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <header>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{l.title}</h1>
            <p className="mt-2 text-mute">{[l.make_name, l.model_name, l.version_name].filter(Boolean).join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 font-medium text-navy-900">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-teal-600" fill="currentColor" aria-hidden><path d="M10 1l2.4 1.8 3 .1.9 2.9L18.8 8 18 10.9l.8 2.9-2.5 1.7-.9 2.9-3 .1L10 20l-2.4-1.8-3-.1-.9-2.9L1.2 13.5 2 10.6 1.2 7.7l2.5-1.7.9-2.9 3-.1z" opacity=".25"/><path d="M8.6 13.2L5.8 10.4l1.1-1.1 1.7 1.7 4.5-4.5 1.1 1.1z"/></svg>
                Noleggiatore professionale verificato
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-mute ring-1 ring-line">{l.city} ({l.province})</span>
              {l.units_count > 1 && <span className="rounded-full bg-white px-3 py-1.5 text-mute ring-1 ring-line">{l.units_count} mezzi identici</span>}
            </div>
          </header>

          {specs.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Caratteristiche</h2>
              <dl className="card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.label} className="bg-white p-4">
                    <dt className="text-xs text-mute">{s.label}</dt>
                    <dd className="mt-0.5 font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {l.description && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Descrizione</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink/90">{l.description}</p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Condizioni di noleggio</h2>
            <ul className="card divide-y divide-line text-sm">
              <Row k="Cauzione" v={l.deposit_cents ? `${euro(l.deposit_cents)} · gestita direttamente dal noleggiatore al momento del ritiro` : "Nessuna"} />
              {l.min_driver_age && <Row k="Età minima" v={`${l.min_driver_age} anni`} />}
              {l.min_license_years && <Row k="Patente da almeno" v={`${l.min_license_years} anni`} />}
              {l.required_license && <Row k="Patente richiesta" v={l.required_license} />}
              {l.included_km_per_day && <Row k="Km inclusi" v={`${l.included_km_per_day} km al giorno${l.extra_km_cents ? `, poi ${euro(l.extra_km_cents, true)}/km` : ""}`} />}
              {l.insurance_excess_cents && <Row k="Franchigia assicurativa" v={euro(l.insurance_excess_cents)} />}
              {l.fuel_policy && <Row k="Carburante" v={l.fuel_policy} />}
            </ul>
          </section>

          {rules?.tiers && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Cancellazione</h2>
              <ul className="card divide-y divide-line text-sm">
                <Row k="Prima della conferma" v="Gratuita" />
                {rules.tiers.map((t, i) => {
                  const prev = rules.tiers![i - 1];
                  const label = i === 0 ? `Oltre ${t.min_hours_before / 24} giorni dal ritiro`
                    : t.min_hours_before === 0 ? `Meno di ${prev.min_hours_before} ore dal ritiro`
                    : `Da ${prev.min_hours_before / 24} giorni a ${t.min_hours_before} ore`;
                  return <Row key={i} k={label} v={`Penale ${t.fee_pct}%`} />;
                })}
                <Row k="Se cancella il noleggiatore" v="Rimborso completo" />
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Disponibilità nei prossimi due mesi</h2>
            <Calendar from={from} busy={busy} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-5 p-5 shadow-sm">
            <div>
              <p className="text-sm text-mute">Tariffe</p>
              <ul className="mt-1 space-y-1">
                {sortedPrices.map((p) => (
                  <li key={`${p.unit}-${p.valid_from}`} className="flex justify-between text-sm">
                    <span>{priceUnitLabel[p.unit]}{p.valid_from ? ` (dal ${formatDateIt(p.valid_from)})` : ""}</span>
                    <span className="font-semibold">{euro(p.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <form method="get" className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="q-dal">Ritiro</label>
                <input id="q-dal" name="dal" type="date" className="field" defaultValue={dal} min={from} />
              </div>
              <div>
                <label className="label" htmlFor="q-al">Riconsegna</label>
                <input id="q-al" name="al" type="date" className="field" defaultValue={al} min={from} />
              </div>
              <button className="btn-ghost col-span-2" type="submit">Calcola prezzo</button>
            </form>
            {quote ? (
              <div className="rounded-xl bg-navy-50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-mute">Totale noleggio</span>
                  <span className="text-2xl font-bold">{euro(quote.total_cents)}</span>
                </div>
                <p className="mt-1 text-xs text-mute">{quote.qty} × {priceUnitLabel[quote.unit]} · cauzione esclusa</p>
              </div>
            ) : pickup && ret ? (
              <p className="rounded-xl bg-teal-50 p-3 text-sm">Non è possibile calcolare il prezzo per queste date.</p>
            ) : null}
            <Link href={requestHref} className="btn-primary w-full">Richiedi prenotazione</Link>
            <p className="text-center text-xs text-mute">Nessun addebito finché il noleggiatore non conferma.</p>
            <Link href={`/messaggi/nuovo?annuncio=${id}`} className="btn-ghost w-full">Fai una domanda</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <li className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-6"><span className="text-mute">{k}</span><span className="font-medium sm:text-right">{v}</span></li>;
}

function Gallery({ media, title, category, indicative }: { media: { url: string; alt: string | null }[]; title: string; category: string; indicative: boolean }) {
  if (indicative && media[0]) {
    return (
      <figure className="card relative aspect-[16/8] overflow-hidden bg-navy-50">
        <Image src={media[0].url} alt={`Immagine indicativa: ${title}`} fill priority sizes="100vw" className="object-contain" />
        <figcaption className="absolute bottom-3 left-3 rounded-full bg-navy-950/75 px-3 py-1 text-xs font-medium text-white">
          Immagine indicativa del modello: il mezzo reale può differire per colore e allestimento
        </figcaption>
      </figure>
    );
  }
  if (media.length === 0) {
    return <div className="card grid aspect-[16/7] place-items-center bg-navy-50 text-navy-700/40"><CategoryIcon slug={category} className="h-20 w-20" /></div>;
  }
  const [main, ...rest] = media;
  return (
    <div className="grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:grid-rows-2">
      <div className="relative aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[380px]">
        <Image src={main.url} alt={main.alt ?? title} fill priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
      </div>
      {rest.slice(0, 4).map((m, i) => (
        <div key={i} className="relative hidden aspect-[4/3] sm:block">
          <Image src={m.url} alt={m.alt ?? title} fill sizes="25vw" className="object-cover" />
        </div>
      ))}
    </div>
  );
}

function Calendar({ from, busy }: { from: string; busy: Set<string> }) {
  const [y, m] = from.split("-").map(Number);
  const months = [0, 1].map((k) => {
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const fmt = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {months.map(({ year, month }) => {
        const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
        const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return (
          <div key={`${year}-${month}`} className="card p-4">
            <p className="mb-3 text-sm font-semibold capitalize">{fmt.format(new Date(Date.UTC(year, month, 1)))}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => <span key={i} className="pb-1 text-mute">{d}</span>)}
              {Array.from({ length: firstDow }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: days }).map((_, i) => {
                const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const past = iso < from, taken = busy.has(iso);
                return (
                  <span key={iso} title={taken ? "Non disponibile" : undefined}
                    className={`rounded-md py-1.5 ${past ? "text-mute/40" : taken ? "bg-navy-100 text-mute line-through" : "bg-teal-50 text-navy-900"}`}>
                    {i + 1}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-mute sm:col-span-2">
        <span className="mr-1 inline-block h-3 w-3 rounded bg-teal-50 align-middle ring-1 ring-teal-500/30" /> libero
        <span className="ml-4 mr-1 inline-block h-3 w-3 rounded bg-navy-100 align-middle" /> occupato
      </p>
    </div>
  );
}
