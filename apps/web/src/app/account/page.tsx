import { Suspense } from "react";
import Link from "next/link";
import { requireUser, getMemberships, getStaffRole } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError, FormNotice } from "@/components/AuthCard";
import { updateProfile } from "./actions";
import { getBadges } from "@/lib/badges";
import { Count } from "@/components/Count";
import { Badge } from "@/lib/status";
import { bookingStatus, fmtDateTime } from "@/lib/bookings";

export const metadata = { title: "Il mio account" };

export default function Page({ searchParams }: PageProps<"/account">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}><Account searchParams={searchParams} /></Suspense>
    </div>
  );
}

async function Account({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const db = await userDb();
  const [{ data: profile }, memberships, staff, badges, { data: bookings }] = await Promise.all([
    db.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    getMemberships(), getStaffRole(), getBadges(),
    db.rpc("my_bookings"),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ciao{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
          <p className="text-sm text-mute">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/password" className="btn-ghost">Cambia password</Link>
          <form action="/esci" method="post"><button className="btn-ghost">Esci</button></form>
        </div>
      </div>
      {sp.errore === "non-autorizzato" ? <FormError message="Non hai accesso a quella sezione." /> : <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />}
      {sp.ok && <FormNotice message="Profilo aggiornato." />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/messaggi" className="card p-5 transition hover:border-teal-500/60">
          <p className="font-semibold">Messaggi<Count n={badges.messages} /></p>
          <p className="mt-1 text-sm text-mute">Le conversazioni con i noleggiatori e con i tuoi clienti</p>
        </Link>
        <Link href="/pro" className="card p-5 transition hover:border-teal-500/60">
          <p className="font-semibold">{memberships.length ? "Area noleggiatore" : "Sei un noleggiatore?"}</p>
          <p className="mt-1 text-sm text-mute">{memberships.length ? `${memberships[0].org.trade_name ?? memberships[0].org.legal_name}: mezzi, sedi, richieste` : "Registra la tua attività e pubblica i tuoi mezzi."}</p>
        </Link>
        {staff && (
          <Link href="/admin" className="card p-5 transition hover:border-teal-500/60">
            <p className="font-semibold">Area KeyRent</p>
            <p className="mt-1 text-sm text-mute">Revisione annunci e anagrafiche</p>
          </Link>
        )}
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Le mie prenotazioni<Count n={badges.customer_bookings} /></h2>
        {bookings?.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">{(bookings as { id: string; code: string; status: string; listing_title: string; pickup_at: string }[]).map((b) => (
            <li key={b.id}><Link href={`/account/prenotazioni/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-navy-700">
              <span><span className="font-medium">{b.listing_title}</span> <span className="text-mute">· {fmtDateTime(b.pickup_at)}</span></span><Badge map={bookingStatus} value={b.status} />
            </Link></li>))}</ul>
        ) : <p className="mt-2 text-sm text-mute">Nessuna prenotazione per ora.</p>}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Profilo personale</h2>
        <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" defaultValue={profile?.first_name ?? ""} className="field" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" defaultValue={profile?.last_name ?? ""} className="field" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="phone">Telefono</label><input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} className="field" /></div>
          <div className="sm:col-span-2"><button className="btn-primary">Salva</button></div>
        </form>
      </section>
    </div>
  );
}
