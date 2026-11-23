import { Suspense } from "react";
import Link from "next/link";
import { loadCustomer } from "@/lib/v2/customer";
import { ContextSwitch, DemoBar, RentalRow, eur, qs } from "@/components/v2/customer/ui";

export const metadata = { title: "Dashboard azienda · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Biz searchParams={searchParams} /></Suspense>;
}

async function Biz({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer({ ...sp, contesto: "azienda" });
  if (!c.business) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Profilo azienda</h1>
        <p className="text-mute">Questo account non ha ancora un profilo azienda. Apri la versione con dati di esempio per vederla.</p>
        <Link href="?demo=1&contesto=azienda" className="btn-primary">Vedi con dati di esempio</Link>
      </div>
    );
  }
  const list = c.rentals.filter((r) => r.forBusiness);
  const paid = list.filter((r) => ["confirmed", "picked_up", "completed"].includes(r.status));
  const month = new Date().toISOString().slice(0, 7), year = month.slice(0, 4);
  const sm = paid.filter((r) => r.pickupAt.slice(0, 7) === month).reduce((s, r) => s + r.totalCents, 0);
  const sy = paid.filter((r) => r.pickupAt.slice(0, 4) === year).reduce((s, r) => s + r.totalCents, 0);
  const n = (b: string) => list.filter((r) => r.bucket === b).length;
  const byCat = Object.entries(paid.reduce((a, r) => { a[r.category] = (a[r.category] ?? 0) + r.totalCents; return a; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byCat.map(([, v]) => v));
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date());
  return (
    <div className="mx-auto max-w-md space-y-5 lg:max-w-3xl">
      <DemoBar c={c} sp={sp} />
      <div>
        <p className="text-sm text-mute">Stai usando KeyRent come</p>
        <h1 className="text-[28px] font-bold tracking-tight">{c.business.name}</h1>
      </div>
      <div className="lg:max-w-md"><ContextSwitch c={c} sp={{ ...sp, contesto: "azienda" }} /></div>
      <div className="rounded-3xl bg-navy-900 p-5 text-white">
        <p className="text-sm capitalize text-white/70">Spesa noleggi · {monthName}</p>
        <p className="text-4xl font-bold tracking-tight">{eur(sm)}</p>
        <p className="mt-1 text-sm text-white/70">{eur(sy)} da inizio anno</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["Attivi", n("attivi"), "attivi"], ["Futuri", n("futuri"), "futuri"], ["In attesa", n("attesa"), "attesa"]].map(([l, v, t]) => (
          <Link key={l as string} href={`/preview/customer-rentals${qs(sp, { contesto: "azienda", tab: t as string })}`} className="rounded-2xl border border-line bg-white p-3 text-center active:scale-[0.99]">
            <p className="text-2xl font-bold">{v}</p><p className="text-xs text-mute">{l}</p>
          </Link>
        ))}
      </div>
      {byCat.length > 0 && (
        <div className="card space-y-3 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-mute">Spesa per tipo di mezzo</p>
          {byCat.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm"><span>{k}</span><b>{eur(v)}</b></div>
              <div className="mt-1 h-2 rounded-full bg-navy-50"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${(v / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-mute">Ultimi noleggi azienda</p>
        {list.slice(0, 4).map((r) => <RentalRow key={r.id} r={r} href={`/preview/customer-rentals/${r.id}${qs(sp, { contesto: "azienda" })}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/preview/business-billing${qs(sp, { contesto: "azienda" })}`} className="btn-ghost">Dati di fatturazione</Link>
        <span className="btn-ghost text-mute">Team · in arrivo</span>
      </div>
    </div>
  );
}
