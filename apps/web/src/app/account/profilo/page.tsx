import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadCustomer } from "@/lib/v2/customer";
import { ContextSwitch } from "@/components/v2/customer/ui";

export const metadata = { title: "Profilo" };

export default function Page() {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Profile /></Suspense></div>;
}

function Group({ title, items }: { title: string; items: [string, string, string?][] }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-mute">{title}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {items.map(([label, href, hint]) => (
          <li key={label}>
            {href ? (
              <Link href={href} className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] active:bg-navy-50 hover:bg-navy-50/50">
                <span>{label}</span><span className="flex items-center gap-2 text-sm text-mute">{hint}<span aria-hidden>›</span></span>
              </Link>
            ) : (
              <span className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] text-mute/70">
                <span>{label}</span><span className="text-xs">{hint ?? "In arrivo"}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Profile() {
  const c = await loadCustomer();
  if (!c) redirect("/accedi?next=/account/profilo");
  const initials = `${c.first[0] ?? ""}${c.last[0] ?? ""}`.toUpperCase();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-xl font-bold text-white">{initials || "?"}</span>
        <div className="min-w-0"><p className="truncate text-xl font-bold">{[c.first, c.last].filter(Boolean).join(" ") || "Il tuo profilo"}</p><p className="truncate text-sm text-mute">{c.email}</p></div>
      </div>
      <ContextSwitch c={c} back="/account/profilo" />
      {c.isProvider && <Link href="/pro" className="flex items-center justify-between rounded-2xl bg-navy-900 px-4 py-4 text-white active:scale-[0.99]"><span className="font-semibold">Passa all&apos;area noleggiatore</span><span>›</span></Link>}
      <Group title="Account" items={[["Dati personali", "/account/dati"], ["Cambia password", "/account/password"], ["Metodi di pagamento", "", "Al pagamento: carta, Apple Pay, Google Pay"], ["Documenti", "", "Richiesti solo se servono"], ["Indirizzi salvati", ""]]} />
      <Group title="Azienda" items={c.orgs.filter((o) => o.kind === "renter").length
        ? [["Riepilogo spese azienda", "/account/azienda"], ["Dati azienda e fatturazione", "/account/azienda/dati"]]
        : [["Aggiungi un profilo azienda", "/account/azienda/dati", "fatture intestate"]]} />
      <Group title="KeyRent" items={[["Assistenza", "/assistenza"], ["Come funziona", "/come-funziona"], ["Cancellazioni e pagamenti", "/termini"], ["Privacy", "/privacy"],
        ...(!c.isProvider ? [["Metti a noleggio i tuoi mezzi", "/diventa-partner"] as [string, string]] : [])]} />
      <form action="/esci" method="post"><button className="w-full rounded-2xl border border-line bg-white py-3.5 font-semibold text-red-700">Esci</button></form>
    </div>
  );
}
