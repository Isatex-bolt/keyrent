import { Suspense } from "react";
import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { updateProfile } from "@/app/account/actions";

export const metadata = { title: "Il mio profilo" };

export default function Page({ searchParams }: PageProps<"/pro/profilo">) {
  return <Suspense fallback={<Skeleton />}><Profilo searchParams={searchParams} /></Suspense>;
}

async function Profilo({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { user } = await requireProvider("/pro/profilo");
  const db = await userDb();
  const { data: profile } = await db.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Il mio profilo</h1>
        <p className="text-mute">I tuoi dati personali come referente dell&apos;attività.</p>
      </header>
      <Flash sp={sp} ok={{ "1": "Dati salvati." }} />
      <section className="card p-5">
        <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="back" value="/pro/profilo" />
          <div><label className="label" htmlFor="first_name">Nome</label><input id="first_name" name="first_name" defaultValue={profile?.first_name ?? ""} className="field" /></div>
          <div><label className="label" htmlFor="last_name">Cognome</label><input id="last_name" name="last_name" defaultValue={profile?.last_name ?? ""} className="field" /></div>
          <div><label className="label" htmlFor="phone">Telefono</label><input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} className="field" /></div>
          <div><label className="label">Email di accesso</label><p className="field bg-navy-50/50 text-mute">{user.email}</p></div>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="btn-primary">Salva</button>
            <Link href="/account/password" className="btn-ghost">Cambia password</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
