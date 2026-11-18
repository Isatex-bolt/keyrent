import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError } from "@/components/AuthCard";
import { signUp } from "../accedi/actions";

export const metadata = { title: "Registrati" };

export default function Page({ searchParams }: PageProps<"/registrati">) {
  return (
    <AuthCard title="Crea il tuo account" subtitle="Gratuito. Con lo stesso account potrai anche pubblicare i mezzi della tua attività.">
      <Suspense><SignUpForm searchParams={searchParams} /></Suspense>
    </AuthCard>
  );
}

async function SignUpForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/account";
  return (
    <>
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={signUp} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
        <button className="btn-primary w-full">Crea account</button>
      </form>
      <p className="mt-6 text-center text-sm text-mute">
        Hai già un account? <Link href={`/accedi?next=${encodeURIComponent(next)}`} className="font-semibold text-teal-600">Accedi</Link>
      </p>
    </>
  );
}
