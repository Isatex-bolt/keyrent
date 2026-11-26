import { BookingBox } from "@/components/BookingBox";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { euro, romeToIso, todayRome, formatDateIt, defaultTimes, fixTimes } from "@/lib/format";
import { idFromRef } from "@/lib/urls";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { getBookingContext } from "@/lib/auth";
import type { ProviderReviews } from "@/lib/data";
import { isHourlyCategory } from "@/lib/catalog";
import { ListingMap } from "@/components/ListingMap";
import { bookingsOpen } from "@/lib/launch";
import { attributesForCategory, getBusyDays, getCancellationRules, getDelivery, getIsDemo, getListing, getProviderReviews, getOffers, quoteOrError } from "@/lib/data";
import { LongTermConfigurator } from "@/components/LongTermConfigurator";

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
  const def = defaultTimes(dal, al);
  const { oraR, oraC } = dal && al
    ? fixTimes(dal, al, first(sp.ora_ritiro) ?? def.oraR, first(sp.ora_riconsegna) ?? def.oraC)
    : { oraR: first(sp.ora_ritiro) ?? def.oraR, oraC: first(sp.ora_riconsegna) ?? def.oraC };
  const pickup = dal ? romeToIso(dal, oraR) : null;
  const ret = al ? romeToIso(al, oraC) : null;
  const from = todayRome(), to = todayRome(62);
  const [attrs, rules, quote, busy, delivery, offers, ctx, isDemo, reviews] = await Promise.all([
    attributesForCategory(l.category_slug),
    getCancellationRules(l.cancellation_policy_id),
    pickup && ret ? quoteOrError(id, pickup, ret) : Promise.resolve(null),
    getBusyDays(id, from, to),
    getDelivery(id),
    getOffers([id]),
    getBookingContext().catch(() => null),
    getIsDemo(id),
    getProviderReviews(id),
  ]);
  const forCompany = !!ctx?.current;
  const offer = offers.get(id) ?? null;
  const shortTerm = offer ? offer.short_term : true;
  const longTerm = !!offer?.long_term;
  const durata = Number(first(sp.durata)) || undefined;
  const lungo = first(sp.lungo) === "1";

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

  const hourly = isHourlyCategory(l.category_slug);
  const fromPrice = prices.find((p) => p.unit === (hourly ? "hour" : "day") && !p.valid_from)?.price_cents ?? (prices.length ? Math.min(...prices.map((p) => p.price_cents)) : 0);
  const sortedPrices = [...prices].sort((a, b) => ["hour", "half_day", "day", "week"].indexOf(a.unit) - ["hour", "half_day", "day", "week"].indexOf(b.unit));

  return (
    <div className="mx-auto max-w-6xl overflow-x-clip px-4 pb-28 pt-0 sm:px-6 sm:py-8 lg:pb-8">
      <nav className="mb-4 hidden text-sm text-mute sm:block">
        <Link href={`/cerca?cat=${l.category_slug}`} className="hover:text-navy-900">{l.category_name}</Link>
        {l.make_name && <> / <Link href={`/cerca?cat=${l.category_slug}&marca=${l.make_slug ?? ""}`} className="hover:text-navy-900">{l.make_name}</Link></>}
        {l.model_name && <> / {l.model_name}</>}
      </nav>

      <Gallery media={media} title={l.title} category={l.category_slug} indicative={indicative} />

      <div className="mt-5 grid gap-6 sm:mt-8 lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:gap-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
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
        </div>

        {/* prenotazione: subito sotto il titolo su telefono, a destra su computer */}
        <aside id="prenota" className="min-w-0 scroll-mt-20 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {isDemo ? (
            <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Annuncio dimostrativo.</strong> Serve a mostrare come funziona KeyRent: le prenotazioni apriranno al lancio.
            </p>
          ) : !bookingsOpen() && (
            <p className="mb-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-navy-800">
              <strong>KeyRent apre a breve.</strong> Puoi già vedere mezzi, date e prezzi: le prenotazioni saranno attive dal lancio.
            </p>
          )}
          {shortTerm && !(lungo && longTerm) && <div className="card space-y-4 p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-mute">Tariffe</p>
              <p className="text-sm">{sortedPrices.map((p) => `${euro(p.price_cents)} ${priceUnitShort[p.unit] ?? ""}${p.valid_from ? ` (dal ${formatDateIt(p.valid_from)})` : ""}`).join(" · ")}</p>
            </div>
            <BookingBox id={id} from={from} busy={[...busy]} delivery={delivery} forCompany={forCompany} fromPrice={fromPrice} unit={hourly ? "ora" : "giorno"} initial={{ dal, al, oraR, oraC }}
              initialQuote={quote && !("error" in quote) ? { total_cents: quote.total_cents, qty: quote.qty, unit: quote.unit } : quote} />
            <p className="text-center text-xs text-mute">Nessun addebito finché il noleggiatore non conferma.</p>
          </div>}
          {longTerm && offer && (shortTerm && !lungo ? (
            <details className="group card mt-3 overflow-hidden shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-semibold">Disponibile anche a lungo termine</span>
                  {offer.lt_from_cents ? <span className="text-sm text-mute">da {euro(offer.lt_from_cents)} / mese · vedi tariffe</span> : <span className="text-sm text-mute">vedi tariffe</span>}
                </span>
                <span aria-hidden className="text-xl text-mute transition group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-line p-5"><LongTermConfigurator listingId={id} title={l.title} offer={offer} initialMonths={durata} /></div>
            </details>
          ) : (
            <div className="card p-5 shadow-sm"><LongTermConfigurator listingId={id} title={l.title} offer={offer} initialMonths={durata} /></div>
          ))}
          {lungo && longTerm && shortTerm && (
            <Link href={`/mezzo/${ref}`} className="mt-3 block text-center text-sm font-semibold text-teal-700">Ti serve per pochi giorni? Vedi le tariffe a giornata</Link>
          )}
          <Link href={`/messaggi/nuovo?annuncio=${id}`} className="btn-ghost mt-3 w-full">Fai una domanda</Link>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          {l.description && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Descrizione</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink/90">{l.description}</p>
            </section>
          )}

          {reviews.items.length > 0 && <Reviews r={reviews} demo={isDemo} />}

          <ListingMap lat={l.approx_latitude} lng={l.approx_longitude} city={l.city} province={l.province} />

          {/* dettagli: si aprono solo se interessano */}
          <div className="card divide-y divide-line overflow-hidden">
            {specs.length > 0 && (
              <More title="Caratteristiche" hint={specs.slice(0, 3).map((x) => x.value).join(" · ")}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {specs.map((x) => (
                    <div key={x.label}>
                      <dt className="text-xs text-mute">{x.label}</dt>
                      <dd className="mt-0.5 font-medium">{x.value}</dd>
                    </div>
                  ))}
                </dl>
              </More>
            )}
            <More title="Condizioni di noleggio" hint={[l.deposit_cents ? `Cauzione ${euro(l.deposit_cents)}` : "Nessuna cauzione", l.min_driver_age ? `età min. ${l.min_driver_age} anni` : "", delivery ? "consegna disponibile" : ""].filter(Boolean).join(" · ")}>
              <ul className="-mx-4 divide-y divide-line text-sm">
              <Row k="Cauzione" v={l.deposit_cents ? `${euro(l.deposit_cents)} · gestita direttamente dal noleggiatore al momento del ritiro` : "Nessuna"} />
              {l.min_driver_age && <Row k="Età minima" v={`${l.min_driver_age} anni`} />}
              {l.min_license_years && <Row k="Patente da almeno" v={`${l.min_license_years} anni`} />}
              {l.required_license && <Row k="Patente richiesta" v={l.required_license} />}
              {l.included_km_per_day && <Row k="Km inclusi" v={`${l.included_km_per_day} km al giorno${l.extra_km_cents ? `, poi ${euro(l.extra_km_cents, true)}/km` : ""}`} />}
              {l.insurance_excess_cents && <Row k="Franchigia assicurativa" v={euro(l.insurance_excess_cents)} />}
              {l.fuel_policy && <Row k="Carburante" v={l.fuel_policy} />}
              <Row k="Consegna a domicilio" v={delivery
                ? `Sì, entro ${delivery.radius_km} km dalla sede · ${[delivery.fee_cents ? euro(delivery.fee_cents) : "", delivery.per_km_cents ? `${euro(delivery.per_km_cents, true)}/km` : ""].filter(Boolean).join(" + ") || "gratuita"}`
                : "No, ritiro presso la sede"} />
            </ul>
            </More>
            {rules?.tiers && (
              <More title="Cancellazione" hint="Gratuita finché il noleggiatore non conferma">
                <ul className="-mx-4 divide-y divide-line text-sm">
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
              </More>
            )}
          </div>
        </div>
      </div>

      {/* telefono, solo lungo termine: rata sempre visibile in basso (per il breve la barra è nel riquadro prenotazione) */}
      {(!shortTerm || (lungo && longTerm)) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white shadow-[0_-6px_20px_rgba(3,16,38,0.10)] lg:hidden">
          <div aria-hidden className="absolute inset-x-0 top-full h-40 bg-white" />
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{offer?.lt_from_cents ? <>da {euro(offer.lt_from_cents)} <span className="text-sm font-medium text-mute">/ mese</span></> : "Lungo termine"}</p>
              <p className="text-xs text-mute">Scegli durata e servizi</p>
            </div>
            <a href="#prenota" className="btn-primary min-h-12 flex-none px-6">Calcola la rata</a>
          </div>
        </div>
      )}
    </div>
  );
}

const avatarTones = ["bg-amber-400", "bg-navy-700", "bg-teal-600", "bg-rose-500", "bg-indigo-500"];

/** Cosa dicono i clienti del noleggiatore (stile Booking): voto medio e ultimi commenti, scorrevoli su telefono. */
function Reviews({ r, demo }: { r: ProviderReviews; demo: boolean }) {
  const avg = r.avg != null ? Number(r.avg) : null;
  const label = avg == null ? "" : avg >= 4.7 ? "Eccellente" : avg >= 4.3 ? "Ottimo" : avg >= 3.8 ? "Buono" : "Nella media";
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">I clienti di questo noleggiatore dicono</h2>
        {avg != null && (
          <p className="flex items-center gap-2 text-sm">
            <span className="rounded-lg bg-navy-900 px-2 py-1 font-bold text-white">{avg.toLocaleString("it-IT", { minimumFractionDigits: 1 })}</span>
            <span className="font-semibold">{label}</span>
            <span className="text-mute">· {r.count} {r.count === 1 ? "recensione" : "recensioni"}</span>
          </p>
        )}
      </div>
      {demo && <p className="mb-3 text-xs text-mute">Recensioni di esempio, come appariranno sugli annunci reali.</p>}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {r.items.map((x, i) => (
          <figure key={i} className="card w-[85%] flex-none snap-start space-y-3 p-4 sm:w-auto">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-full font-semibold text-white ${avatarTones[x.author.charCodeAt(0) % avatarTones.length]}`}>
                {x.author.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{x.author}</p>
                <p className="truncate text-xs text-mute">{x.title} · {new Date(x.created_at).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "Europe/Rome" })}</p>
              </div>
              <span className="ml-auto flex-none text-sm text-amber-500" aria-label={`${x.rating} su 5`}>{"★".repeat(x.rating)}<span className="text-line">{"★".repeat(5 - x.rating)}</span></span>
            </div>
            <blockquote className="leading-relaxed text-ink/90">&ldquo;{x.body}&rdquo;</blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}

const priceUnitShort: Record<string, string> = { hour: "/ ora", half_day: "/ mezza giornata", day: "/ giorno", week: "/ settimana" };

function More({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          {hint && <span className="block truncate text-sm text-mute">{hint}</span>}
        </span>
        <span aria-hidden className="flex-none text-xl text-mute transition group-open:rotate-45">+</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
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
    <>
    {/* telefono: foto a tutto schermo, si scorrono col dito */}
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:hidden">
      {media.map((m, i) => (
        <div key={i} className="relative aspect-[4/3] w-full flex-none snap-center">
          <Image src={m.url} alt={m.alt ?? title} fill priority={i === 0} sizes="100vw" className="object-cover" />
          <span className="absolute bottom-3 right-3 rounded-full bg-navy-950/70 px-2.5 py-1 text-xs font-semibold text-white">{i + 1} / {media.length}</span>
        </div>
      ))}
    </div>
    <div className="hidden gap-2 overflow-hidden rounded-2xl sm:grid sm:grid-cols-4 sm:grid-rows-2">
      <div className="relative aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[380px]">
        <Image src={main.url} alt={main.alt ?? title} fill priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
      </div>
      {rest.slice(0, 4).map((m, i) => (
        <div key={i} className="relative hidden aspect-[4/3] sm:block">
          <Image src={m.url} alt={m.alt ?? title} fill sizes="25vw" className="object-cover" />
        </div>
      ))}
    </div>
    </>
  );
}
