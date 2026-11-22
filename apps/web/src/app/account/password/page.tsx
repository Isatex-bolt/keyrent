import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AuthCard, FormError, FormNotice } from "@/components/AuthCard";
import { changePassword } from "../../accedi/actions";

export const metadata = { title: "Cambia password" };

export default function Page({ searchParams }: PageProps<"/account/password">) {
  return (
    <AuthCard title="Cambia password" subtitle="Scegli una nuova password per il tuo account KeyRent.">
      <Suspense><Form searchParams={searchParams} /></Suspense>
    </AuthCard>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/password");
  if (sp.ok) {
    return (
      <>
        <FormNotice message="Password aggiornata ✓ Da ora accedi con la nuova password." />
        <p className="mt-4 text-center text-sm"><Link href="/" className="font-semibold text-teal-600">Torna a KeyRent</Link></p>
      </>
    );
  }
  return (
    <>
      <p className="mb-4 rounded-xl bg-navy-50 px-4 py-3 text-sm">Account: <strong>{user.email}</strong></p>
      <FormError message={typeof sp.errore === "string" ? sp.errore : undefined} />
      <form action={changePassword} className="space-y-4">
        <input type="email" name="username" autoComplete="username" value={user.email ?? ""} readOnly hidden />
        <div><label className="label" htmlFor="password">Nuova password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" /></div>
        <div><label className="label" htmlFor="confirm">Ripeti la nuova password</label>
          <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" /></div>
        <p className="text-xs text-mute">Almeno 8 caratteri.</p>
        <button className="btn-primary w-full">Salva la nuova password</button>
      </form>
    </>
  );
}
