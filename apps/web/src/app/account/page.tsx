import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { inContext, loadCustomer } from "@/lib/v2/customer";
import { ContextSwitch, RentalRow, eur } from "@/components/v2/customer/ui";
import { FormNotice } from "@/components/AuthCard";

export const metadata = { title: "Il mio KeyRent" };

export default function Page({ searchParams }: PageProps<"/account">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Dash searchParams={searchParams} /></Suspense></div>;
}

async function Dash({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const c = await loadCustomer();
  if (!c) redirect("/accedi?next=/account");
  const list = inContext(c);
  const month = new Date().toISOString().slice(0, 7), year = month.slice(0, 4);
  const paid = list.filter((r) => ["confirmed", "picked_up", "completed"].includes(r.status));
  const spentM = paid.filter((r) => r.pickupAt.slice(0, 7) === month).reduce((s, r) => s + r.totalCents, 0);
  const spentY = paid.filter((r) => r.pickupAt.slice(0, 4) === year).reduce((s, r) => s + r.totalCents, 0);
  const n = (b: string) => list.filter((r) => r.bucket === b).length;
  const priority = list.find((r) => r.bucket === "attivi") ?? list.find((r) => r.status === "accepted") ?? list.find((r) => r.bucket === "attesa") ?? list.find((r) => r.bucket === "futuri");
  const tile = (label: string, v: string | number, tab?: string) => (
    <Link href={tab ? `/account/noleggi?tab=${tab}` : "/account/noleggi"} className="rounded-2xl border border-line bg-white p-4 transition active:scale-[0.99] hover:shadow-md">
      <p className="text-sm text-mute">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{v}</p>
    </Link>
  );
  return (
    <div className="space-y-5">
      <FormNotice message={typeof sp.ok === "string" ? sp.ok : undefined} />
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Ciao{c.first ? ` ${c.first}` : ""}</h1>
        {c.business ? <p className="text-sm text-mute">Stai usando KeyRent come <b className="text-navy-900">{c.business.name}</b></p>
          : <p className="text-sm text-mute">I tuoi noleggi in un colpo d&apos;occhio.</p>}
      </div>
      <ContextSwitch c={c} back="/account" />
      {priority && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-600">{priority.bucket === "attivi" ? "Adesso" : priority.bucket === "futuri" ? "Prossimo noleggio" : "Da seguire"}</p>
          <RentalRow r={priority} href={`/account/prenotazioni/${priority.id}`} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {tile("Noleggi attivi", n("attivi"), "attivi")}
        {tile("In attesa", n("attesa"), "attesa")}
        {tile("Prossimi noleggi", n("futuri"), "futuri")}
        {tile(c.business ? "Spesa del mese" : "Spesa questo mese", eur(spentM))}
      </div>
      {c.business && (
        <Link href="/account/azienda" className="flex items-center justify-between rounded-2xl bg-navy-900 px-4 py-4 text-white">
          <span><span className="block text-sm text-white/70">Spesa da inizio anno</span><span className="text-xl font-bold">{eur(spentY)}</span></span><span>Riepilogo azienda ›</span>
        </Link>
      )}
      {!list.length && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-sm text-mute">Nessun noleggio ancora{c.business ? " per questa azienda" : ""}.</p>
          <Link href="/cerca/rapida" className="btn-primary mt-4">Cerca un mezzo</Link>
        </div>
      )}
    </div>
  );
}
