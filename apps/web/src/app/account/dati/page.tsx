import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError, FormNotice } from "@/components/AuthCard";
import { updateProfile } from "../actions";

export const metadata = { title: "Dati personali" };

export default function Page({ searchParams }: PageProps<"/account/dati">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Dati searchParams={searchParams} /></Suspense></div>;
}

async function Dati({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/dati");
  const { data: p } = await (await userDb()).from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-4">
      <Link href="/account/profilo" className="text-sm text-mute">← Profilo</Link>
      <h1 className="text-[28px] font-bold tracking-tight">Dati personali</h1>
      <FormNotice message={sp.ok ? "Dati salvati." : undefined} />
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={updateProfile} className="space-y-4 rounded-2xl border border-line bg-white p-4">
        <input type="hidden" name="back" value="/account/dati" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" defaultValue={p?.first_name ?? ""} className="field text-base" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" defaultValue={p?.last_name ?? ""} className="field text-base" /></div>
        </div>
        <div><label className="label" htmlFor="phone">Cellulare</label><input id="phone" name="phone" type="tel" defaultValue={p?.phone ?? ""} className="field text-base" /></div>
        <div><label className="label">Email</label><p className="field bg-navy-50/50 text-mute">{user.email}</p></div>
        <button className="btn-primary w-full py-3.5">Salva</button>
      </form>
    </div>
  );
}
