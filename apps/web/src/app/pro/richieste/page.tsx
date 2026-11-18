import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/bookings";
import { BookingSummary, type ProBooking } from "@/components/BookingRow";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { respondBooking } from "../actions";

export const metadata = { title: "Richieste" };

export default function Page({ searchParams }: PageProps<"/pro/richieste">) {
  return <Suspense fallback={<Skeleton />}><Requests searchParams={searchParams} /></Suspense>;
}

const COLS = "id, code, status, pickup_at, return_at, total_cents, provider_net_cents, provider_response_due_at, driver, listings(title), locations(name)";

async function Requests({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/richieste");
  if (!membership) redirect("/pro");
  await serviceDb().rpc("svc_expire_stale_bookings");
  const db = await userDb();
  const { data } = await db.from("bookings").select(COLS).eq("status", "requested").eq("organization_id", membership.organization_id).order("provider_response_due_at");
  const rows = (data ?? []) as unknown as ProBooking[];
  return (
    <div className="space-y-4">
      <ProHeader title="Richieste" subtitle="Rispondi entro il tempo indicato: le richieste senza risposta scadono e le date tornano libere." />
      <Flash sp={sp} ok={{ accettata: "Richiesta accettata: il cliente ora vede i tuoi dati legali e può confermare.", rifiutata: "Richiesta rifiutata." }} />
      {rows.map((b) => (
        <div key={b.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <BookingSummary b={b} />
          <div className="w-full space-y-2 sm:w-64">
            {b.provider_response_due_at && <p className="text-xs text-amber-800">Rispondi entro {fmtDateTime(b.provider_response_due_at)}</p>}
            <form action={respondBooking}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="decision" value="accept" />
              <button className="btn-primary w-full">Accetta</button></form>
            <form action={respondBooking} className="space-y-2"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="decision" value="decline" />
              <input name="reason" className="field" placeholder="Motivo del rifiuto (facoltativo)" />
              <button className="btn-ghost w-full">Rifiuta</button></form>
          </div>
        </div>
      ))}
      {!rows.length && <p className="card p-6 text-sm text-mute">Nessuna richiesta in attesa.</p>}
    </div>
  );
}
