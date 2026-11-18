import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { BookingSummary, type ProBooking } from "@/components/BookingRow";
import { ProHeader, Skeleton } from "@/components/ProPage";

export const metadata = { title: "Prenotazioni" };

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Bookings /></Suspense>;
}

async function Bookings() {
  const { membership } = await requireProvider("/pro/prenotazioni");
  if (!membership) redirect("/pro");
  await serviceDb().rpc("svc_expire_stale_bookings");
  const db = await userDb();
  const { data } = await db.from("bookings")
    .select("id, code, status, pickup_at, return_at, total_cents, provider_net_cents, provider_response_due_at, driver, listings(title), locations(name)")
    .neq("status", "requested").order("pickup_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as ProBooking[];
  const now = new Date().toISOString();
  const upcoming = rows.filter((b) => ["accepted", "confirmed", "picked_up"].includes(b.status) || (b.pickup_at > now && !["cancelled", "declined", "expired"].includes(b.status)));
  const past = rows.filter((b) => !upcoming.includes(b));
  return (
    <div className="space-y-6">
      <ProHeader title="Prenotazioni" subtitle="Le nuove richieste sono in “Richieste”." />
      <section className="space-y-3">
        <h2 className="font-semibold">In corso e future</h2>
        {upcoming.map((b) => <div key={b.id} className="card p-5"><BookingSummary b={b} /></div>)}
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
