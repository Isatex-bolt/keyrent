import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError } from "@/components/AuthCard";
import { signIn, sendMagicLink } from "./actions";

export const metadata = { title: "Accedi" };

export default function Page({ searchParams }: PageProps<"/accedi">) {
  return (
    <AuthCard title="Accedi a KeyRent" subtitle="Un solo account per prenotare e, se sei un noleggiatore, gestire i tuoi mezzi.">
      <Suspense><LoginForm searchParams={searchParams} /></Suspense>
    </AuthCard>
  );
}

async function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/account";
  const errore = typeof sp.errore === "string" ? sp.errore : undefined;
  return (
    <>
      <FormError message={errore} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
          <input name="email" type="email" required placeholder="La tua email" className="field" />
          <button className="btn-ghost shrink-0">Invia link</button>
        </form>
      </details>
      <p className="mt-6 text-center text-sm text-mute">
        Non hai un account? <Link href={`/registrati?next=${encodeURIComponent(next)}`} className="font-semibold text-teal-600">Registrati</Link>
      </p>
    </>
  );
}
