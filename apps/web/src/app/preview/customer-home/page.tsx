import { Suspense } from "react";
import Link from "next/link";
import { loadCustomer } from "@/lib/v2/customer";
import { DemoBar, Thumb, hour, qs, relDay } from "@/components/v2/customer/ui";
import { QuickSearch } from "@/components/v2/customer/QuickSearch";

export const metadata = { title: "Home cliente · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Home searchParams={searchParams} /></Suspense>;
}

async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  const active = c.rentals.find((r) => r.bucket === "attivi");
  const pending = c.rentals.filter((r) => r.bucket === "attesa").length;
  const initials = `${c.first[0] ?? ""}${c.last[0] ?? ""}`.toUpperCase();
  return (
    <div className="mx-auto max-w-md space-y-5">
      <DemoBar c={c} sp={sp} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-mute">Ciao{c.first ? ` ${c.first}` : ""}</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Dove vuoi andare?</h1>
        </div>
        <Link href={`/preview/customer-profile${qs(sp)}`} aria-label="Profilo" className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-sm font-bold text-white">{initials || "?"}</Link>
      </div>

      {active && (
        <Link href={`/preview/customer-rentals/${active.id}${qs(sp)}`} className="block overflow-hidden rounded-3xl bg-navy-900 p-4 text-white shadow-lg transition active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <Thumb r={active} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-400">In corso</p>
              <p className="truncate text-lg font-semibold">{active.title}</p>
              <p className="text-sm text-white/75">Riconsegna {relDay(active.returnAt)} ore {hour(active.returnAt)}</p>
            </div>
          </div>
          <span className="mt-3 block rounded-xl bg-white/10 py-2.5 text-center text-sm font-semibold">Vedi noleggio</span>
        </Link>
      )}
      {pending > 0 && (
        <Link href={`/preview/customer-rentals${qs(sp, { tab: "attesa" })}`} className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span><b>{pending}</b> {pending === 1 ? "richiesta in attesa del noleggiatore" : "richieste in attesa"}</span><span className="font-semibold">Vedi</span>
        </Link>
      )}

      <QuickSearch />

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/preview/customer-rentals${qs(sp)}`} className="rounded-2xl border border-line bg-white p-4 active:scale-[0.99]"><p className="text-sm text-mute">I miei noleggi</p><p className="mt-1 text-2xl font-bold">{c.rentals.filter((r) => ["attivi", "attesa", "futuri"].includes(r.bucket)).length}</p></Link>
        <Link href={`/preview/customer-messages${qs(sp)}`} className="rounded-2xl border border-line bg-white p-4 active:scale-[0.99]"><p className="text-sm text-mute">Messaggi</p><p className="mt-1 text-2xl font-bold">{c.threads.length}</p></Link>
      </div>
      <p className="text-center text-xs text-mute">Sotto restano le sezioni della home di oggi (idee, destinazioni, novità).</p>
    </div>
  );
}
