import { Suspense } from "react";
import Link from "next/link";

export const metadata = { title: "Registrazione · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

const Big = ({ href, title, text, tag }: { href: string; title: string; text: string; tag?: string }) => (
  <Link href={href} className="group block rounded-3xl border-2 border-line bg-white p-5 transition active:scale-[0.99] hover:border-teal-500 hover:shadow-lg">
    {tag && <span className="mb-2 inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">{tag}</span>}
    <p className="text-xl font-bold text-navy-900">{title}</p>
    <p className="mt-1 text-[15px] text-mute">{text}</p>
    <p className="mt-4 text-sm font-semibold text-teal-600">Continua →</p>
  </Link>
);
const F = ({ label, type = "text", ph, opt }: { label: string; type?: string; ph?: string; opt?: boolean }) => (
  <div><label className="label">{label}{opt && <span className="ml-1 normal-case tracking-normal text-mute/70">(facoltativo)</span>}</label><input type={type} placeholder={ph} className="field text-base" /></div>
);

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse rounded-3xl bg-white" />}><Onboarding searchParams={searchParams} /></Suspense>;
}

async function Onboarding({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const step = typeof sp.step === "string" ? sp.step : "1";
  const back = (to: string) => <Link href={`?step=${to}`} className="text-sm text-mute">← Indietro</Link>;
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex justify-center gap-1.5">{["1", "2", "3"].map((s, i) => <span key={s} className={`h-1.5 w-8 rounded-full ${Number(step.slice(0, 1)) > i ? "bg-teal-500" : "bg-line"}`} />)}</div>
      {step === "1" && (<>
        <h1 className="text-2xl font-bold tracking-tight">Cosa vuoi fare su KeyRent?</h1>
        <Big href="?step=2" title="Voglio noleggiare" text="Cerca e prenota auto, moto, bici, camper, barche, furgoni e altri mezzi." />
        <Big href="/registrati?tipo=noleggiatore" title="Metto mezzi a noleggio" text="Pubblica e gestisci i tuoi mezzi con KeyRent." tag="Per attività con P.IVA" />
        <p className="text-center text-sm text-mute">Hai già un account? <Link href="/accedi" className="font-semibold text-teal-600">Accedi</Link></p>
      </>)}
      {step === "2" && (<>
        {back("1")}
        <h1 className="text-2xl font-bold tracking-tight">Come vuoi usare KeyRent?</h1>
        <Big href="?step=3p" title="Privato" text="Per me: una vacanza, un weekend, un'uscita." />
        <Big href="?step=3a" title="Azienda" text="Per la mia attività, con fattura intestata all'azienda." />
        <p className="text-center text-xs text-mute">Potrai aggiungere l&apos;altro profilo in seguito, con lo stesso accesso.</p>
      </>)}
      {step === "3p" && (<>
        {back("2")}
        <h1 className="text-2xl font-bold tracking-tight">Crea il tuo account</h1>
        <p className="text-sm text-mute">Bastano 30 secondi. Patente e documenti li chiediamo solo se servono per il mezzo che prenoti.</p>
        <div className="grid grid-cols-2 gap-3"><F label="Nome" /><F label="Cognome" /></div>
        <F label="Email" type="email" /><F label="Cellulare" type="tel" ph="+39" /><F label="Password" type="password" />
        <button disabled className="btn-primary w-full py-4 text-base opacity-90">Crea account</button>
        <p className="text-center text-xs text-mute">Anteprima: il modulo non invia nulla. La registrazione vera è su <Link href="/registrati?tipo=cliente&come=privato" className="underline">/registrati</Link>.</p>
      </>)}
      {step === "3a" && (<>
        {back("2")}
        <h1 className="text-2xl font-bold tracking-tight">Account azienda</h1>
        <p className="text-sm text-mute">Prenoti per l&apos;azienda e ricevi i documenti intestati. Non diventi noleggiatore: per pubblicare mezzi c&apos;è un percorso a parte.</p>
        <p className="pt-1 text-xs font-bold uppercase tracking-[0.12em] text-teal-600">Chi sei</p>
        <div className="grid grid-cols-2 gap-3"><F label="Nome" /><F label="Cognome" /></div>
        <F label="Email" type="email" /><F label="Cellulare" type="tel" /><F label="Password" type="password" />
        <p className="pt-1 text-xs font-bold uppercase tracking-[0.12em] text-teal-600">Dati per la fattura</p>
        <F label="Ragione sociale" /><F label="Partita IVA" ph="IT01234567890" />
        <div className="grid grid-cols-2 gap-3"><F label="Codice SDI" /><F label="PEC" type="email" opt /></div>
        <p className="text-xs text-mute">Indirizzo di fatturazione ed email amministrativa li completi alla prima prenotazione come azienda.</p>
        <button disabled className="btn-primary w-full py-4 text-base opacity-90">Crea account azienda</button>
      </>)}
    </div>
  );
}
