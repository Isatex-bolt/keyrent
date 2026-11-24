import { expireAll } from "@/lib/payments";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { BookingSummary, type ProBooking } from "@/components/BookingRow";
import { Flash, ProHeader, Skeleton } from "@/components/ProPage";
import { SubmitOnce } from "@/components/SubmitOnce";
import { rentalStep } from "../actions";

export const metadata = { title: "Prenotazioni" };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Skeleton />}><Bookings searchParams={searchParams} /></Suspense>;
}

const OK = { consegnato: "Consegna registrata: il noleggio è in corso.", rientrato: "Rientro registrato: noleggio concluso.", assente: "Registrato: il cliente non si è presentato." };

/** Pulsanti del giorno del noleggio: compaiono solo quando servono (3 h prima del ritiro, 2 h dopo per l'assenza). */
function Steps({ b, now }: { b: ProBooking; now: number }) {
  const at = Date.parse(b.pickup_at);
  const steps: [string, string, boolean][] = [];
  if (b.status === "confirmed" && now >= at - 3 * 3600_000) steps.push(["consegnato", "Consegnato al cliente", true]);
  if (b.status === "confirmed" && now >= at + 2 * 3600_000) steps.push(["assente", "Il cliente non si è presentato", false]);
  if (b.status === "picked_up") steps.push(["rientrato", "Mezzo rientrato", true]);
  if (!steps.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
      {steps.map(([step, label, main]) => (
        <form key={step} action={rentalStep}>
          <input type="hidden" name="id" value={b.id} /><input type="hidden" name="step" value={step} />
          <SubmitOnce className={main ? "btn-primary px-4 py-2 text-sm" : "btn-ghost px-4 py-2 text-sm"} pendingText="Salvo…">{label}</SubmitOnce>
        </form>
      ))}
    </div>
  );
}

async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/prenotazioni");
  if (!membership) redirect("/pro");
  await expireAll();
  const db = await userDb();
  const { data } = await db.from("bookings")
    .select("id, code, status, pickup_at, return_at, total_cents, provider_net_cents, provider_response_due_at, driver, listings(title), locations(name)")
    .neq("status", "requested").eq("organization_id", membership.organization_id).order("pickup_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as ProBooking[];
  await db.rpc("mark_booking_updates_seen", { p_booking: null, p_as: "provider" });
  const nowMs = new Date().getTime();
  const now = new Date(nowMs).toISOString();
  const upcoming = rows.filter((b) => ["accepted", "confirmed", "picked_up"].includes(b.status) || (b.pickup_at > now && !["cancelled", "declined", "expired"].includes(b.status)));
  const past = rows.filter((b) => !upcoming.includes(b));
  return (
    <div className="space-y-6">
      <ProHeader title="Prenotazioni" subtitle="Le nuove richieste sono in “Richieste”." />
      <Flash sp={sp} ok={OK} />
      <section className="space-y-3">
        <h2 className="font-semibold">In corso e future</h2>
        {upcoming.map((b) => <div key={b.id} className="card p-5"><BookingSummary b={b} /><Steps b={b} now={nowMs} /></div>)}
        {!upcoming.length && <p className="card p-6 text-sm text-mute">Nessuna prenotazione attiva.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Archivio</h2>
        {past.map((b) => <div key={b.id} className="card p-5 opacity-80"><BookingSummary b={b} /></div>)}
        {!past.length && <p className="text-sm text-mute">Ancora niente in archivio.</p>}
      </section>
    </div>
  );
}
