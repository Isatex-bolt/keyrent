import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ProPage";
import { KEYRENT_COMPANY } from "@/lib/company";

export const metadata = { title: "Il mio profilo · Admin" };

export default function Page() {
  return <div className="max-w-2xl"><Suspense fallback={<Skeleton />}><Profile /></Suspense></div>;
}

const roleLabel: Record<string, string> = { admin: "Amministratore", operations: "Operazioni", customer_care: "Assistenza clienti", marketing: "Marketing", accounting: "Amministrazione" };

async function Profile() {
  const { user, role } = await requireStaff(["admin", "operations", "customer_care", "marketing", "accounting"]);
  const { data: p } = await (await userDb()).from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle();
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const rows = (r: [string, string][]) => (
    <dl className="divide-y divide-line px-5">
      {r.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]"><dt className="text-mute">{k}</dt><dd className="text-right">{v}</dd></div>)}
    </dl>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Il mio profilo</h1>
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Account</p>
          <span className="rounded-full bg-gradient-to-r from-navy-900 to-teal-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">Admin</span>
        </div>
        {rows([["Nome", name || "—"], ["Email di accesso", user.email ?? "—"], ["Telefono", p?.phone || "—"], ["Ruolo", roleLabel[role] ?? role]])}
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          <Link href="/account/password" className="flex min-h-12 items-center justify-center rounded-2xl bg-navy-900 px-4 font-semibold text-white">Cambia password</Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-navy-900 bg-navy-900 text-white">
        <div className="space-y-1 px-5 pb-3 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-400">Azienda che gestisce KeyRent</p>
          <p className="text-xl font-bold tracking-tight">{KEYRENT_COMPANY.legalName}</p>
        </div>
        <dl className="divide-y divide-white/10 px-5 pb-4">
          {[["Ragione sociale", KEYRENT_COMPANY.legalName], ["Partita IVA", KEYRENT_COMPANY.vat], ["Sede", KEYRENT_COMPANY.address], ["Email", KEYRENT_COMPANY.email]].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]"><dt className="text-white/60">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
      </div>
      <p className="text-xs text-mute">L&apos;account admin non pubblica mezzi: gli annunci dei noleggiatori si gestiscono da Anagrafiche.</p>
    </div>
  );
}
