import { Suspense } from "react";
import Link from "next/link";
import { loadCustomer } from "@/lib/v2/customer";
import { ContextSwitch, DemoBar, qs } from "@/components/v2/customer/ui";

export const metadata = { title: "Profilo · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Profile searchParams={searchParams} /></Suspense>;
}

function Group({ title, items }: { title: string; items: [string, string, string?][] }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-mute">{title}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {items.map(([label, href, hint]) => (
          <li key={label}>
            <Link href={href} className="flex min-h-[52px] items-center justify-between px-4 text-[15px] active:bg-navy-50">
              <span>{label}</span><span className="flex items-center gap-2 text-sm text-mute">{hint}<span aria-hidden>›</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Profile({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  const initials = `${c.first[0] ?? ""}${c.last[0] ?? ""}`.toUpperCase();
  return (
    <div className="mx-auto max-w-md space-y-5">
      <DemoBar c={c} sp={sp} />
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-xl font-bold text-white">{initials || "?"}</span>
        <div className="min-w-0"><p className="truncate text-xl font-bold">{[c.first, c.last].filter(Boolean).join(" ") || "Il tuo profilo"}</p><p className="truncate text-sm text-mute">{c.email}</p></div>
      </div>
      <ContextSwitch c={c} sp={sp} />
      {c.isProvider && <Link href="/pro" className="flex items-center justify-between rounded-2xl bg-navy-900 px-4 py-4 text-white active:scale-[0.99]"><span className="font-semibold">Passa all&apos;area noleggiatore</span><span>›</span></Link>}
      <Group title="Account" items={[["Dati personali", "/account"], ["Metodi di pagamento", "#", "Apple Pay, carte"], ["Documenti", "#", "Patente: non caricata"], ["Indirizzi salvati", "#", "Casa, Lavoro"], ["Preferiti", "#"]]} />
      {c.business
        ? <Group title={`Azienda · ${c.business.name}`} items={[["Dati azienda e fatturazione", `/preview/business-billing${qs(sp, { contesto: "azienda" })}`], ["Spese e noleggi azienda", `/preview/business-renter-dashboard${qs(sp, { contesto: "azienda" })}`]]} />
        : <Group title="Azienda" items={[["Aggiungi un profilo azienda", "#", "fatture intestate"]]} />}
      <Group title="Preferenze" items={[["Notifiche", "#"], ["Privacy", "/privacy"]]} />
      <Group title="KeyRent" items={[["Assistenza", "/assistenza"], ["Come funziona", "/come-funziona"], ["Cancellazioni", "/termini"], ["Sicurezza e pagamenti", "/termini"], ...(!c.isProvider ? [["Metti a noleggio i tuoi mezzi", "/diventa-partner"] as [string, string]] : [])]} />
      <form action="/esci" method="post"><button className="w-full rounded-2xl border border-line bg-white py-3.5 font-semibold text-red-700">Esci</button></form>
      <p className="text-center text-xs text-mute">Le voci con “›” senza pagina sono la struttura proposta: Pagamenti, Documenti, Indirizzi e Notifiche richiedono lavoro sul database.</p>
    </div>
  );
}
