import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError, FormNotice } from "@/components/AuthCard";
import { requestPasswordReset } from "../accedi/actions";

export const metadata = { title: "Password dimenticata" };

export default function Page({ searchParams }: PageProps<"/password-dimenticata">) {
  return (
    <AuthCard title="Password dimenticata" subtitle="Scrivi l'email del tuo account: ti mandiamo un link per sceglierne una nuova.">
      <Suspense><Form searchParams={searchParams} /></Suspense>
    </AuthCard>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (sp.inviata) {
    return (
      <>
        <FormNotice message="Se l'email è registrata, ti abbiamo mandato il link. Controlla la posta (anche lo spam): il link vale 1 ora." />
        <p className="mt-4 text-center text-sm"><Link href="/accedi" className="font-semibold text-teal-600">Torna all&apos;accesso</Link></p>
      </>
    );
  }
  return (
    <form action={requestPasswordReset} className="space-y-4">
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <div><label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={typeof sp.email === "string" ? sp.email : ""} className="field" /></div>
      <button className="btn-primary w-full">Inviami il link</button>
      <p className="text-center text-sm"><Link href="/accedi" className="text-teal-600">Torna all&apos;accesso</Link></p>
    </form>
  );
}
