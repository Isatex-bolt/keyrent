import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError, FormNotice } from "@/components/AuthCard";
import { signIn, requestPasswordReset } from "./actions";

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
  const email = typeof sp.email === "string" ? sp.email : "";
  const esistente = sp.esistente === "1" && email;
  return (
    <AuthCard backHome title="Accedi al tuo account KeyRent" subtitle="Un solo accesso per clienti e noleggiatori.">
      <FormNotice message={typeof sp.ok === "string" ? sp.ok : undefined} />
      <FormError message={errore} />
      {esistente && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-navy-900">
          <p className="font-semibold">Hai già un account con {email}</p>
          <p className="mt-1">Accedi qui sotto con la tua password. Non la ricordi? Ti mandiamo un link per sceglierne una nuova.</p>
          <form action={requestPasswordReset} className="mt-3">
            <input type="hidden" name="email" value={email} />
            <button className="btn-ghost w-full bg-white">Inviami il link per cambiare password</button>
          </form>
        </div>
      )}
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="field" /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" autoFocus={!!email} className="field" /></div>
        <button className="btn-primary w-full">Accedi</button>
        <p className="text-right text-sm">
          <Link href={email ? `/password-dimenticata?email=${encodeURIComponent(email)}` : "/password-dimenticata"} className="text-teal-600 hover:underline">Password dimenticata?</Link>
        </p>
      </form>
      <div className="mt-6 rounded-xl bg-teal-50 px-4 py-3 text-center text-sm text-navy-900">
        Non sei registrato?{" "}
        <Link href={`/registrati${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-teal-600 hover:underline">Registrati</Link>
      </div>
    </AuthCard>
  );
}
