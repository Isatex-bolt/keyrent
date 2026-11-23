import { Suspense } from "react";
import Link from "next/link";
import { loadCustomer } from "@/lib/v2/customer";
import { DemoBar, qs } from "@/components/v2/customer/ui";

export const metadata = { title: "Fatturazione azienda · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Billing searchParams={searchParams} /></Suspense>;
}

async function Billing({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer({ ...sp, contesto: "azienda" });
  const b = c.business ?? { name: "", vat: "", sdi: "", pec: "", email: "", street: "", city: "", province: "", cap: "" };
  const F = ({ l, v, opt, half }: { l: string; v: string; opt?: boolean; half?: boolean }) => (
    <div className={half ? "" : "col-span-2"}><label className="label">{l}{opt && <span className="ml-1 normal-case tracking-normal text-mute/70">(facoltativo)</span>}</label><input defaultValue={v} className="field text-base" /></div>
  );
  return (
    <div className="mx-auto max-w-md space-y-4">
      <DemoBar c={c} sp={sp} />
      <Link href={`/preview/customer-profile${qs(sp)}`} className="text-sm text-mute">← Profilo</Link>
      <h1 className="text-[28px] font-bold tracking-tight">Dati di fatturazione</h1>
      <p className="text-sm text-mute">Usati quando prenoti come azienda: nel riepilogo vedi “Prenotazione per {b.name || "la tua azienda"}”.</p>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4">
        <F l="Ragione sociale" v={b.name} />
        <F l="Partita IVA" v={b.vat} half /><F l="Codice fiscale" v="" opt half />
        <F l="Codice SDI" v={b.sdi} half /><F l="PEC" v={b.pec} opt half />
        <F l="Indirizzo" v={b.street} />
        <F l="Comune" v={b.city} half /><F l="CAP" v={b.cap} half />
        <F l="Provincia" v={b.province} half /><F l="Paese" v="Italia" half />
        <F l="Email amministrativa" v={b.email} /><F l="Telefono" v={c.phone} />
      </div>
      <button disabled className="btn-primary w-full py-4 text-base opacity-90">Salva</button>
      <p className="text-center text-xs text-mute">Anteprima: non salva. Servono le tabelle per i profili di fatturazione (vedi proposta).</p>
    </div>
  );
}
