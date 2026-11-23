import { Suspense } from "react";
import Link from "next/link";
import { inContext, loadCustomer } from "@/lib/v2/customer";
import { ContextSwitch, DemoBar, RentalRow, eur, qs } from "@/components/v2/customer/ui";

export const metadata = { title: "Il mio KeyRent · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Dash searchParams={searchParams} /></Suspense>;
}

async function Dash({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  const list = inContext(c);
  const month = new Date().toISOString().slice(0, 7);
  const spent = list.filter((r) => ["confirmed", "picked_up", "completed"].includes(r.status) && r.pickupAt.slice(0, 7) === month).reduce((s, r) => s + r.totalCents, 0);
  const n = (b: string) => list.filter((r) => r.bucket === b).length;
  const priority = list.find((r) => r.bucket === "attivi") ?? list.find((r) => r.status === "accepted") ?? list.find((r) => r.bucket === "attesa");
  const tile = (label: string, v: string | number, tab?: string) => (
    <Link href={`/preview/customer-rentals${qs(sp, tab ? { tab } : {})}`} className="rounded-2xl border border-line bg-white p-4 active:scale-[0.99]">
      <p className="text-sm text-mute">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{v}</p>
    </Link>
  );
  return (
    <div className="mx-auto max-w-md space-y-5">
      <DemoBar c={c} sp={sp} />
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Ciao {c.first || "!"}</h1>
        {c.context === "azienda" && c.business && <p className="text-sm text-mute">Stai usando KeyRent come <b className="text-navy-900">{c.business.name}</b></p>}
      </div>
      <ContextSwitch c={c} sp={sp} />
      {priority && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-600">{priority.bucket === "attivi" ? "Adesso" : "Da seguire"}</p>
          <RentalRow r={priority} href={`/preview/customer-rentals/${priority.id}${qs(sp)}`} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {tile("Noleggi attivi", n("attivi"), "attivi")}
        {tile("In attesa", n("attesa"), "attesa")}
        {tile("Prossimi noleggi", n("futuri"), "futuri")}
        {tile("Spesa del mese", eur(spent))}
      </div>
      {c.context === "azienda" && <Link href={`/preview/business-renter-dashboard${qs(sp)}`} className="btn-ghost w-full">Riepilogo spese azienda</Link>}
    </div>
  );
}
