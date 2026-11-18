import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError } from "@/components/AuthCard";
import { AuthTabs } from "@/components/AuthTabs";
import { signIn, sendMagicLink } from "./actions";

export const metadata = { title: "Accedi" };

export default function Page({ searchParams }: PageProps<"/accedi">) {
  return (
    <Suspense><LoginForm searchParams={searchParams} /></Suspense>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const errore = typeof sp.errore === "string" ? sp.errore : undefined;
  const tipo = sp.tipo === "noleggiatore" ? "noleggiatore" : "cliente";
  const pro = tipo === "noleggiatore";
  return (
    <AuthCard title={pro ? "Accesso noleggiatori" : "Accedi a KeyRent"}
      subtitle={pro ? "Gestisci mezzi, richieste, prenotazioni e messaggi della tua attività." : "Prenota mezzi, segui le tue prenotazioni e scrivi ai noleggiatori."}>
      <AuthTabs base="/accedi" tipo={tipo} />
      <FormError message={errore} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="tipo" value={tipo} />
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
        <button className="btn-primary w-full">Accedi</button>
      </form>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-teal-600">Preferisci un link via email?</summary>
        <form action={sendMagicLink} className="mt-3 flex gap-2">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="tipo" value={tipo} />
          <input name="email" type="email" required placeholder="La tua email" className="field" />
          <button className="btn-ghost shrink-0">Invia link</button>
        </form>
      </details>
      <p className="mt-6 text-center text-sm text-mute">
        Non hai un account?{" "}
        <Link href={`/registrati?${pro ? "tipo=noleggiatore&" : ""}${next ? `next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-teal-600">
          {pro ? "Registra la tua attività" : "Registrati"}
        </Link>
      </p>
    </AuthCard>
  );
}
