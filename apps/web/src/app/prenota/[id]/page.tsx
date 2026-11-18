import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { getListing, getQuote, getCancellationRules } from "@/lib/data";
import { euro, priceUnitLabel, romeToIso, todayRome } from "@/lib/format";
import { listingHref } from "@/lib/urls";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { requestBooking } from "@/app/account/bookingActions";

export const metadata = { title: "Richiedi prenotazione" };

const HOURS = Array.from({ length: 27 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export default function Page({ params, searchParams }: PageProps<"/prenota/[id]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<Skeleton />}><Request params={params} searchParams={searchParams} /></Suspense>
    </div>
  );
}

async function Request({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const dal = typeof sp.dal === "string" ? sp.dal : "";
  const al = typeof sp.al === "string" ? sp.al : "";
  const oraR = typeof sp.ora_ritiro === "string" ? sp.ora_ritiro : "10:00";
  const oraC = typeof sp.ora_riconsegna === "string" ? sp.ora_riconsegna : "10:00";
  const user = await requireUser(`/prenota/${id}?dal=${dal}&al=${al}`);
  const data = await getListing(id);
  if (!data) notFound();
  const { listing: l } = data;
  const pickup = dal ? romeToIso(dal, oraR) : null;
  const ret = al ? romeToIso(al, oraC) : null;
  const db = await userDb();
  const [quote, rules, { data: profile }] = await Promise.all([
    pickup && ret && ret > pickup ? getQuote(id, pickup, ret) : Promise.resolve(null),
    getCancellationRules(l.cancellation_policy_id),
    db.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={listingHref({ id, slug: l.slug })} className="text-sm text-mute hover:text-navy-900">← {l.title}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Richiedi prenotazione</h1>
        <p className="text-sm text-mute">Noleggiatore professionale verificato · {l.city} ({l.province})</p>
      </div>
      <Flash sp={sp} />

      <form method="get" className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto_1fr_auto_auto]">
        <div><label className="label" htmlFor="dal">Ritiro</label><input id="dal" name="dal" type="date" required min={todayRome()} defaultValue={dal} className="field" /></div>
        <div><label className="label" htmlFor="ora_ritiro">Ora</label>
          <select id="ora_ritiro" name="ora_ritiro" defaultValue={oraR} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div><label className="label" htmlFor="al">Riconsegna</label><input id="al" name="al" type="date" required min={todayRome()} defaultValue={al} className="field" /></div>
        <div><label className="label" htmlFor="ora_riconsegna">Ora</label>
          <select id="ora_riconsegna" name="ora_riconsegna" defaultValue={oraC} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="flex items-end"><button className="btn-ghost w-full">Aggiorna prezzo</button></div>
      </form>

      {!quote ? (
        <p className="card p-5 text-sm text-mute">{pickup && ret ? "Per queste date non è possibile calcolare un prezzo: verifica la durata minima o cambia date." : "Scegli le date per vedere il prezzo."}</p>
      ) : (
        <form action={requestBooking} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <input type="hidden" name="listing_id" value={id} />
          <input type="hidden" name="dal" value={dal} /><input type="hidden" name="al" value={al} />
          <input type="hidden" name="ora_ritiro" value={oraR} /><input type="hidden" name="ora_riconsegna" value={oraC} />
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Chi guida</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" required defaultValue={profile?.first_name ?? ""} className="field" /></div>
              <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" required defaultValue={profile?.last_name ?? ""} className="field" /></div>
              <div><label className="label" htmlFor="birth_year">Anno di nascita</label><input id="birth_year" name="birth_year" type="number" min={1920} max={2015} required className="field" /></div>
              <div><label className="label" htmlFor="license_year">Patente dal (anno)</label><input id="license_year" name="license_year" type="number" min={1950} max={2030} className="field" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="notes">Note per il noleggiatore (facoltative)</label>
                <textarea id="notes" name="notes" rows={2} maxLength={500} className="field" placeholder="Es. orario di arrivo, richieste particolari" /></div>
            </div>
            {l.min_driver_age && <p className="text-xs text-mute">Età minima richiesta: {l.min_driver_age} anni{l.min_license_years ? `, patente da almeno ${l.min_license_years} anni` : ""}.</p>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="terms" required className="mt-1" />
              <span>Accetto le condizioni di noleggio e la policy di cancellazione: gratuita prima della conferma
                {rules?.tiers ? `, poi ${rules.tiers.map((t) => `${t.fee_pct}%`).join(" / ")} in base a quanto manca al ritiro` : ""}.</span>
            </label>
          </div>
          <aside className="card h-fit space-y-4 p-5">
            <p className="font-semibold">{l.title}</p>
            <div className="flex justify-between text-sm"><span className="text-mute">{quote.qty} × {priceUnitLabel[quote.unit]}</span><span>{euro(quote.base_cents)}</span></div>
            <div className="flex items-baseline justify-between border-t border-line pt-3"><span className="text-sm text-mute">Totale noleggio</span><span className="text-2xl font-bold">{euro(quote.total_cents)}</span></div>
            {l.deposit_cents > 0 && <p className="text-xs text-mute">Cauzione {euro(l.deposit_cents)} gestita direttamente dal noleggiatore al ritiro.</p>}
            <button className="btn-primary w-full">Invia richiesta</button>
            <p className="rounded-xl bg-teal-50 p-3 text-xs text-navy-900">
              Il noleggiatore ha 24 ore per rispondere. Il pagamento online è in attivazione: in questa fase la richiesta non richiede la carta e non viene addebitato nulla.
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}
