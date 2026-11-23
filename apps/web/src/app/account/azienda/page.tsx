import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadCustomer, inContext } from "@/lib/v2/customer";
import { ContextSwitch, RentalRow, eur } from "@/components/v2/customer/ui";
import { FormNotice } from "@/components/AuthCard";

export const metadata = { title: "Azienda" };

export default function Page({ searchParams }: PageProps<"/account/azienda">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Biz searchParams={searchParams} /></Suspense></div>;
}

async function Biz({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const c = await loadCustomer();
  if (!c) redirect("/accedi?next=/account/azienda");
  if (!c.orgs.length) redirect("/account/azienda/dati");
  if (!c.business) {
    return (
      <div className="space-y-4">
        <h1 className="text-[28px] font-bold tracking-tight">Azienda</h1>
        <p className="text-sm text-mute">Scegli l&apos;azienda per vedere spese e noleggi.</p>
        <ContextSwitch c={c} back="/account/azienda" />
      </div>
    );
  }
  const list = inContext(c);
  const paid = list.filter((r) => ["confirmed", "picked_up", "completed"].includes(r.status));
  const month = new Date().toISOString().slice(0, 7), year = month.slice(0, 4);
  const sm = paid.filter((r) => r.pickupAt.slice(0, 7) === month).reduce((s, r) => s + r.totalCents, 0);
  const sy = paid.filter((r) => r.pickupAt.slice(0, 4) === year).reduce((s, r) => s + r.totalCents, 0);
  const n = (b: string) => list.filter((r) => r.bucket === b).length;
  const byCat = Object.entries(paid.filter((r) => r.pickupAt.slice(0, 4) === year).reduce((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + r.totalCents; return acc; }, {} as Record<string, number>)).sort((x, y) => y[1] - x[1]);
  const max = Math.max(1, ...byCat.map(([, v]) => v));
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date());
  return (
    <div className="space-y-5">
      <FormNotice message={sp.ok ? "Profilo azienda creato: ora puoi prenotare per l'azienda." : undefined} />
      <div><p className="text-sm text-mute">Stai usando KeyRent come</p><h1 className="text-[28px] font-bold tracking-tight">{c.business.name}</h1></div>
      <ContextSwitch c={c} back="/account/azienda" />
      <div className="rounded-3xl bg-navy-900 p-5 text-white">
        <p className="text-sm capitalize text-white/70">Spesa noleggi · {monthName}</p>
        <p className="text-4xl font-bold tracking-tight">{eur(sm)}</p>
        <p className="mt-1 text-sm text-white/70">{eur(sy)} da inizio anno</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([["Attivi", n("attivi"), "attivi"], ["Futuri", n("futuri"), "futuri"], ["In attesa", n("attesa"), "attesa"]] as const).map(([l, v, t]) => (
          <Link key={l} href={`/account/noleggi?tab=${t}`} className="rounded-2xl border border-line bg-white p-3 text-center active:scale-[0.99]">
            <p className="text-2xl font-bold">{v}</p><p className="text-xs text-mute">{l}</p>
          </Link>
        ))}
      </div>
      {byCat.length > 0 && (
        <div className="card space-y-3 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-mute">Spesa per tipo di mezzo · {year}</p>
          {byCat.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm"><span>{k}</span><b>{eur(v)}</b></div>
              <div className="mt-1 h-2 rounded-full bg-navy-50"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${(v / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {list.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-mute">Ultimi noleggi</p>
          {list.slice(0, 4).map((r) => <RentalRow key={r.id} r={r} href={`/account/prenotazioni/${r.id}`} />)}
        </div>
      )}
      <Link href="/account/azienda/dati" className="btn-ghost w-full">Dati di fatturazione</Link>
    </div>
  );
}
