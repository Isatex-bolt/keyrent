import { Suspense } from "react";
import Link from "next/link";
import { inContext, loadCustomer, type Bucket } from "@/lib/v2/customer";
import { ContextSwitch, DemoBar, RentalRow, qs } from "@/components/v2/customer/ui";

export const metadata = { title: "I miei noleggi · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS: [Bucket, string][] = [["attivi", "Attivi"], ["attesa", "In attesa"], ["futuri", "Futuri"], ["completati", "Completati"], ["cancellati", "Cancellati"]];
const EMPTY: Record<Bucket, string> = {
  attivi: "Nessun noleggio in corso.", attesa: "Nessuna richiesta in attesa.", futuri: "Nessun noleggio in programma.",
  completati: "Qui trovi i noleggi conclusi.", cancellati: "Nessuna prenotazione cancellata.",
};

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Rentals searchParams={searchParams} /></Suspense>;
}

async function Rentals({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  const list = inContext(c);
  const first = TABS.find(([b]) => list.some((r) => r.bucket === b))?.[0] ?? "attivi";
  const tab = (TABS.find(([b]) => b === sp.tab)?.[0] ?? first) as Bucket;
  const rows = list.filter((r) => r.bucket === tab);
  return (
    <div className="mx-auto max-w-md space-y-4">
      <DemoBar c={c} sp={sp} />
      <div className="flex items-end justify-between">
        <h1 className="text-[28px] font-bold tracking-tight">I miei noleggi</h1>
        <Link href={`/preview/customer-dashboard${qs(sp)}`} className="text-sm font-semibold text-teal-600">Riepilogo</Link>
      </div>
      <ContextSwitch c={c} sp={sp} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([b, l]) => {
          const count = list.filter((r) => r.bucket === b).length;
          return (
            <Link key={b} href={qs(sp, { tab: b }) || "?"} scroll={false}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === b ? "bg-navy-900 text-white" : "border border-line bg-white text-mute"}`}>
              {l}{count > 0 && <span className={`ml-1.5 ${tab === b ? "text-white/70" : "text-mute/70"}`}>{count}</span>}
            </Link>
          );
        })}
      </div>
      <div key={tab} className="space-y-3 animate-[riseIn_.2s_ease-out]">
        {rows.map((r) => <RentalRow key={r.id} r={r} href={`/preview/customer-rentals/${r.id}${qs(sp)}`} />)}
        {!rows.length && (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="text-sm text-mute">{EMPTY[tab]}</p>
            <Link href={`/preview/customer-search${qs(sp)}`} className="btn-primary mt-4">Cerca un mezzo</Link>
          </div>
        )}
      </div>
    </div>
  );
}
