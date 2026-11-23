import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCapabilities, requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError } from "@/components/AuthCard";
import { addPrivateProfile } from "../actions";

export const metadata = { title: "Aggiungi profilo privato" };

export default function Page({ searchParams }: PageProps<"/account/privato">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Form searchParams={searchParams} /></Suspense></div>;
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/privato");
  if ((await getCapabilities()).privato) redirect("/account/dati");
  const { data: p } = await (await userDb()).from("profiles").select("first_name, last_name, phone, birth_date").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-4">
      <Link href="/account/profilo" className="text-sm text-mute">← Profilo</Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Privato</p>
        <h1 className="text-[28px] font-bold tracking-tight">Aggiungi profilo privato</h1>
        <p className="mt-1 text-[15px] text-mute">Per noleggiare mezzi per uso personale, con lo stesso account. Al momento della prenotazione scegli se prenotare come privato o come azienda.</p>
      </div>
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={addPrivateProfile} className="space-y-4 rounded-2xl border border-line bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" required autoComplete="given-name" defaultValue={p?.first_name ?? ""} className="field text-base" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" required autoComplete="family-name" defaultValue={p?.last_name ?? ""} className="field text-base" /></div>
        </div>
        <div><label className="label" htmlFor="phone">Cellulare</label><input id="phone" name="phone" type="tel" required autoComplete="tel" defaultValue={p?.phone ?? ""} className="field text-base" /></div>
        <div><label className="label" htmlFor="birth_date">Data di nascita <span className="normal-case tracking-normal text-mute/70">(facoltativa)</span></label>
          <input id="birth_date" name="birth_date" type="date" defaultValue={p?.birth_date ?? ""} className="field text-base" /></div>
        <p className="text-xs text-mute">Email: {user.email} (la stessa del tuo account).</p>
        <button className="btn-primary min-h-12 w-full py-3.5 text-base">Crea profilo privato</button>
      </form>
    </div>
  );
}
