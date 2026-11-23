import { Suspense } from "react";
import Link from "next/link";
import { getCapabilities, requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError, FormNotice } from "@/components/AuthCard";
import { updateProfile } from "../actions";

export const metadata = { title: "Profilo privato" };

export default function Page({ searchParams }: PageProps<"/account/dati">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Dati searchParams={searchParams} /></Suspense></div>;
}

async function Dati({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/dati");
  const privato = (await getCapabilities()).privato;
  const { data: p } = await (await userDb()).from("profiles").select("first_name, last_name, phone, birth_date, driving_license_since").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-4">
      <Link href="/account/profilo" className="text-sm text-mute">← Profilo</Link>
      <h1 className="text-[28px] font-bold tracking-tight">{privato ? "Profilo privato" : "Dati account"}</h1>
      <FormNotice message={sp.ok ? "Dati salvati." : undefined} />
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={updateProfile} className="space-y-4 rounded-2xl border border-line bg-white p-4">
        <input type="hidden" name="back" value="/account/dati" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" defaultValue={p?.first_name ?? ""} className="field text-base" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" defaultValue={p?.last_name ?? ""} className="field text-base" /></div>
        </div>
        <div><label className="label" htmlFor="phone">Cellulare</label><input id="phone" name="phone" type="tel" defaultValue={p?.phone ?? ""} className="field text-base" /></div>
        {privato && <><div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="birth_date">Data di nascita</label><input id="birth_date" name="birth_date" type="date" defaultValue={p?.birth_date ?? ""} className="field text-base" /></div>
          <div><label className="label" htmlFor="driving_license_since">Patente dal</label><input id="driving_license_since" name="driving_license_since" type="date" defaultValue={p?.driving_license_since ?? ""} className="field text-base" /></div>
        </div>
        <p className="-mt-2 text-xs text-mute">Data di nascita e patente servono solo per i mezzi a motore.</p></>}
        <div><label className="label">Email di accesso</label><p className="field bg-navy-50/50 text-mute">{user.email}</p></div>
        <button className="btn-primary w-full py-3.5">Salva</button>
      </form>
    </div>
  );
}
