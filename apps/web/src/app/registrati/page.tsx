import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError } from "@/components/AuthCard";
import { AuthTabs } from "@/components/AuthTabs";
import { signUp } from "../accedi/actions";

export const metadata = { title: "Registrati" };

export default function Page({ searchParams }: PageProps<"/registrati">) {
  return (
    <Suspense><SignUpForm searchParams={searchParams} /></Suspense>
  );
}

async function SignUpForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const tipo = sp.tipo === "noleggiatore" ? "noleggiatore" : "cliente";
  const pro = tipo === "noleggiatore";
  return (
    <AuthCard title={pro ? "Registra la tua attività" : "Crea il tuo account"}
      subtitle={pro
        ? "Per noleggiatori professionali con P.IVA. Dopo la registrazione inserisci i dati dell'attività: li verifichiamo prima della pubblicazione."
        : "Gratuito. Per prenotare mezzi da noleggiatori professionali verificati."}>
      <AuthTabs base="/registrati" tipo={tipo} />
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={signUp} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="first_name">Nome</label>
            <input id="first_name" name="first_name" required autoComplete="given-name" className="field" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label>
            <input id="last_name" name="last_name" required autoComplete="family-name" className="field" /></div>
        </div>
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
        <div><label className="label" htmlFor="password">Password (almeno 8 caratteri)</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" /></div>
        <label className="flex items-start gap-2 text-sm text-mute">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>Accetto i <Link href="/termini" className="text-teal-600">termini</Link> e l&apos;<Link href="/privacy" className="text-teal-600">informativa privacy</Link>.</span>
        </label>
        {pro && <p className="text-xs text-mute">Nome e cognome sono quelli del referente: la ragione sociale la inserisci al passo successivo.</p>}
        <button className="btn-primary w-full">{pro ? "Crea account noleggiatore" : "Crea account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-mute">
        Hai già un account?{" "}
        <Link href={`/accedi?${pro ? "tipo=noleggiatore&" : ""}${next ? `next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-teal-600">Accedi</Link>
      </p>
    </AuthCard>
  );
}
