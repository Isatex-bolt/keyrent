import { Suspense } from "react";
import Link from "next/link";
import { requireUser, getMemberships, getStaffRole } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError, FormNotice } from "@/components/AuthCard";
import { updateProfile } from "./actions";

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
  const [{ data: profile }, memberships, staff, { data: bookings }] = await Promise.all([
    db.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    getMemberships(), getStaffRole(),
    db.from("bookings").select("id, code, status, pickup_at").eq("customer_id", user.id).order("pickup_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ciao{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
          <p className="text-sm text-mute">{user.email}</p>
        </div>
        <form action="/esci" method="post"><button className="btn-ghost">Esci</button></form>
      </div>
      {sp.errore === "non-autorizzato" ? <FormError message="Non hai accesso a quella sezione." /> : <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />}
      {sp.ok && <FormNotice message="Profilo aggiornato." />}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <h2 className="font-semibold">Le mie prenotazioni</h2>
        {bookings?.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">{bookings.map((b) => <li key={b.id} className="flex justify-between py-2"><span>{b.code}</span><span className="text-mute">{b.status}</span></li>)}</ul>
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
