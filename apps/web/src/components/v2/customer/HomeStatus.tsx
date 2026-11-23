import Link from "next/link";
import { getUser } from "@/lib/auth";
import { loadCustomer } from "@/lib/v2/customer";
import { Thumb, hour, relDay } from "./ui";

/** In home, per chi ha fatto l'accesso: noleggio in corso in evidenza e richieste in attesa. */
export async function HomeStatus() {
  if (!(await getUser())) return null;
  const c = await loadCustomer();
  if (!c) return null;
  const active = c.rentals.find((r) => r.bucket === "attivi");
  const next = c.rentals.filter((r) => r.bucket === "futuri").sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))[0];
  const pending = c.rentals.filter((r) => r.bucket === "attesa").length;
  const r = active ?? next;
  if (!r && !pending) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-2 px-4 pt-4 sm:px-6">
      {r && (
        <Link href={`/account/prenotazioni/${r.id}`} className="flex items-center gap-3 rounded-2xl bg-navy-900 p-3 pr-4 text-white shadow-lg transition active:scale-[0.99] sm:max-w-md">
          <Thumb r={r} className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-400">{active ? "In corso" : "Prossimo noleggio"}</p>
            <p className="truncate font-semibold">{r.title}</p>
            <p className="text-sm text-white/75">{active ? `Riconsegna ${relDay(r.returnAt)} ore ${hour(r.returnAt)}` : `Ritiro ${relDay(r.pickupAt)} ore ${hour(r.pickupAt)}`}</p>
          </div>
          <span className="text-sm font-semibold">Vedi ›</span>
        </Link>
      )}
      {pending > 0 && (
        <Link href="/account/noleggi?tab=attesa" className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:max-w-md">
          <span><b>{pending}</b> {pending === 1 ? "richiesta in attesa del noleggiatore" : "richieste in attesa"}</span><span className="font-semibold">Vedi</span>
        </Link>
      )}
    </div>
  );
}
