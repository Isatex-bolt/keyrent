import { Suspense } from "react";
import Link from "next/link";
import { getBookingContext, requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { FormError, FormNotice } from "@/components/AuthCard";
import { createRenterOrg, updateBilling } from "../actions";

export const metadata = { title: "Dati di fatturazione" };

export default function Page({ searchParams }: PageProps<"/account/azienda/dati">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Billing searchParams={searchParams} /></Suspense></div>;
}

type Org = { id: string; legal_name: string; vat_number: string; tax_code: string | null; sdi_code: string | null; pec: string | null;
  business_email: string | null; business_phone: string | null; legal_address: Record<string, string> | null; kind?: string };

async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/azienda/dati");
  const { orgs, current } = await getBookingContext();
  const wanted = typeof sp.id === "string" ? orgs.find((o) => o.id === sp.id) : undefined;
  const renter = sp.nuova ? null : wanted ?? current ?? orgs[0] ?? null;
  let org: Org | null = null;
  if (renter) {
    const { data } = await (await userDb()).from("organizations")
      .select("id, legal_name, vat_number, tax_code, sdi_code, pec, business_email, business_phone, legal_address").eq("id", renter.id).maybeSingle();
    org = data as Org | null;
  }
  const a = org?.legal_address ?? {};
  const F = ({ n, l, d, opt, half, ro, t }: { n: string; l: string; d?: string | null; opt?: boolean; half?: boolean; ro?: boolean; t?: string }) => (
    <div className={half ? "" : "col-span-2"}>
      <label className="label" htmlFor={n}>{l}{opt && <span className="ml-1 normal-case tracking-normal text-mute/70">(facoltativo)</span>}</label>
      {ro ? <p className="field bg-navy-50/50 text-mute">{d}</p> : <input id={n} name={n} type={t} defaultValue={d ?? ""} className="field text-base" />}
    </div>
  );
  return (
    <div className="space-y-4">
      <Link href="/account/profilo" className="text-sm text-mute">← Profilo</Link>
      <h1 className="text-[28px] font-bold tracking-tight">{org ? "Profilo azienda" : "Aggiungi profilo azienda"}</h1>
      <p className="text-sm text-mute">{org ? `Usati quando prenoti come ${org.legal_name}.` : "Noleggi mezzi per la tua azienda e ricevi fatture e documenti intestati. È diverso dall'attività di noleggio: per pubblicare mezzi c'è un percorso a parte."}</p>
      <FormNotice message={sp.ok ? "Dati salvati." : undefined} />
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      {sp.esistente && (
        <div role="alert" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">Azienda già esistente</p>
          <p className="text-sm text-amber-950/80">Questa partita IVA è già registrata su KeyRent. Contatta il team KeyRent per recuperare gli accessi aziendali.</p>
          <Link href="/assistenza" className="btn-primary inline-flex min-h-11">Contatta il team KeyRent</Link>
        </div>
      )}
      <form action={org ? updateBilling : createRenterOrg} className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4">
        {org && <input type="hidden" name="id" value={org.id} />}
        {org ? <F n="legal_name" l="Ragione sociale" d={org.legal_name} ro /> : <F n="legal_name" l="Ragione sociale" />}
        {org ? <F n="vat_number" l="Partita IVA" d={org.vat_number} half ro /> : <F n="vat_number" l="Partita IVA" half />}
        <F n="tax_code" l="Codice fiscale" d={org?.tax_code} opt half />
        <F n="sdi_code" l="Codice SDI" d={org?.sdi_code} half /><F n="pec" l="PEC" d={org?.pec} opt half t="email" />
        <F n="street" l="Indirizzo di fatturazione" d={a.street} />
        <F n="city" l="Comune" d={a.city} half /><F n="postal_code" l="CAP" d={a.postal_code} half />
        <F n="province" l="Provincia" d={a.province} half /><F n="country" l="Paese" d={a.country ?? "Italia"} half />
        <F n="business_email" l="Email amministrativa" d={org?.business_email ?? user.email} t="email" />
        <F n="business_phone" l="Telefono" d={org?.business_phone} t="tel" />
        <button className="btn-primary col-span-2 w-full py-3.5">{org ? "Salva" : "Crea profilo azienda"}</button>
      </form>
    </div>
  );
}
