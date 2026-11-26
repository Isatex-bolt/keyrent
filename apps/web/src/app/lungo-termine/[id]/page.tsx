import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { getIsDemo, getListing, getOffers } from "@/lib/data";
import { bookingsOpen } from "@/lib/launch";
import { LT_SERVICES, kmFor, monthlyRate } from "@/lib/longTerm";
import { euro } from "@/lib/format";
import { FormError } from "@/components/AuthCard";
import { SubmitOnce } from "@/components/SubmitOnce";
import { Skeleton, type SP } from "@/components/ProPage";
import { requestLongTerm } from "../actions";

export const metadata = { title: "Richiesta noleggio a lungo termine" };

export default function Page({ params, searchParams }: PageProps<"/lungo-termine/[id]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Suspense fallback={<Skeleton />}><Request params={params} searchParams={searchParams} /></Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Request({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const [data, offers, isDemo, user] = await Promise.all([getListing(id), getOffers([id]), getIsDemo(id), getUser()]);
  if (!data) notFound();
  const l = data.listing;
  const offer = offers.get(id);
  if (!offer?.long_term) notFound();

  if (one(sp.inviata) === "1") {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-3 text-2xl font-bold">Richiesta inviata</h1>
        <p className="mt-2 text-mute">Il noleggiatore ha ricevuto la tua richiesta per <strong className="text-ink">{l.title}</strong> e ti contatterà
          a breve per il preventivo definitivo e i documenti necessari.</p>
        <Link href={`/mezzo/${id}`} className="btn-ghost mt-6 inline-flex">← Torna al mezzo</Link>
      </div>
    );
  }

  const baseKm = offer.lt_km_per_year;
  const months = Number(one(sp.mesi)) || 36;
  const kms = kmFor(offer.lt_prices, months, baseKm);
  const km = kms.includes(Number(one(sp.km))) ? Number(one(sp.km)) : kms[0];
  const chosen = (Array.isArray(sp.servizi) ? sp.servizi : sp.servizi ? [sp.servizi] : []).filter((k) => offer.lt_services[k]?.offered);
  const rate = km ? monthlyRate(offer.lt_prices, offer.lt_services, months, chosen, km, baseKm) : 0;
  if (!rate) notFound();

  const recap = (
    <div className="rounded-2xl bg-navy-950 p-5 text-white">
      <p className="text-sm text-white/70">Noleggio a lungo termine</p>
      <p className="mt-1 text-lg font-semibold">{l.title}</p>
      <p className="mt-1 text-sm text-white/80">{months} mesi · {km.toLocaleString("it-IT")} km/anno{chosen.length ? ` · ${chosen.map((k) => LT_SERVICES.find((x) => x.key === k)?.label).join(", ")}` : ""}</p>
      <p className="mt-3 text-3xl font-bold">{euro(rate)}<span className="text-base font-medium text-white/70"> /mese</span></p>
      <p className="text-xs text-white/60">IVA inclusa · rata indicativa, il noleggiatore conferma il preventivo definitivo</p>
    </div>
  );

  if (isDemo || !bookingsOpen()) {
    return (
      <div className="space-y-5">
        {recap}
        <div className="card p-6 text-center">
          <h1 className="text-xl font-bold">{isDemo ? "Annuncio dimostrativo" : "Le richieste non sono ancora attive"}</h1>
          <p className="mt-2 text-mute">{isDemo ? "Questo annuncio serve a mostrare come funziona KeyRent: le richieste vere apriranno al lancio." : "KeyRent apre a breve: da quel momento potrai inviare la richiesta e il noleggiatore ti ricontatterà."}</p>
          <Link href={`/mezzo/${id}`} className="btn-ghost mt-5 inline-flex">← Torna al mezzo</Link>
        </div>
      </div>
    );
  }

  const profile = user ? (await (await userDb()).from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle()).data : null;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return (
    <div className="space-y-5">
      <Link href={`/mezzo/${id}`} className="text-sm font-semibold text-navy-700">← Torna al mezzo</Link>
      {recap}
      <form action={requestLongTerm} className="card space-y-4 p-5 sm:p-6">
        <h1 className="text-xl font-bold">I tuoi contatti</h1>
        <p className="-mt-2 text-sm text-mute">Li riceve solo questo noleggiatore, per prepararti il preventivo e chiederti i documenti.</p>
        <FormError message={one(sp.errore) || undefined} />
        <input type="hidden" name="listing" value={id} />
        <input type="hidden" name="mesi" value={months} />
        <input type="hidden" name="km" value={km} />
        {chosen.map((k) => <input key={k} type="hidden" name="servizi" value={k} />)}
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">Intestato a</legend>
          {[["privato", "Me (privato)"], ["azienda", "La mia azienda"]].map(([v, t], i) => (
            <label key={v} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line text-sm font-semibold has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white">
              <input type="radio" name="tipo" value={v} defaultChecked={i === 0} className="sr-only peer" />{t}
            </label>
          ))}
        </fieldset>
        <div><label className="label" htmlFor="lt-nome">Nome e cognome</label>
          <input id="lt-nome" name="nome" required defaultValue={name} autoComplete="name" className="field" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="lt-tel">Telefono</label>
            <input id="lt-tel" name="telefono" type="tel" required defaultValue={profile?.phone ?? ""} autoComplete="tel" className="field" /></div>
          <div><label className="label" htmlFor="lt-email">Email</label>
            {user ? <input id="lt-email" value={user.email ?? ""} readOnly className="field bg-navy-50/50" />
              : <input id="lt-email" name="email" type="email" required autoComplete="email" className="field" />}</div>
        </div>
        <details className="rounded-xl border border-line p-3 [&[open]]:pb-4">
          <summary className="cursor-pointer text-sm font-semibold">Dati azienda (solo se intestato all&apos;azienda)</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="lt-rs">Ragione sociale</label><input id="lt-rs" name="ragione_sociale" className="field" /></div>
            <div><label className="label" htmlFor="lt-piva">Partita IVA</label><input id="lt-piva" name="piva" inputMode="numeric" className="field" /></div>
          </div>
        </details>
        <div><label className="label" htmlFor="lt-note">Note per il noleggiatore (facoltative)</label>
          <textarea id="lt-note" name="note" rows={3} maxLength={1000} className="field" placeholder="Es. consegna desiderata, colore, domande…" /></div>
        <SubmitOnce className="btn-primary w-full py-3.5 text-base" pendingText="Invio…">{user ? "Invia la richiesta" : "Accedi e invia la richiesta"}</SubmitOnce>
        <p className="text-center text-xs text-mute">Nessun pagamento: è una richiesta di preventivo. I documenti (reddito, identità…) te li chiede direttamente il noleggiatore.</p>
      </form>
    </div>
  );
}
