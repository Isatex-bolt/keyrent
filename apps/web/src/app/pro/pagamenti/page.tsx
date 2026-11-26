import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import { fmtDateTime } from "@/lib/bookings";
import { paymentsEnabled } from "@/lib/stripe";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { SubmitOnce } from "@/components/SubmitOnce";
import { connectStripe, syncStripeAccount } from "./actions";

export const metadata = { title: "Pagamenti e incassi" };

export default function Page({ searchParams }: PageProps<"/pro/pagamenti">) {
  return <Suspense fallback={<Skeleton />}><Payments searchParams={searchParams} /></Suspense>;
}

const PAYOUT: Record<string, [string, string]> = {
  pending_pickup: ["In attesa del ritiro", "bg-navy-50 text-navy-800"],
  scheduled: ["Programmato", "bg-teal-50 text-teal-800"],
  processing: ["In corso", "bg-teal-50 text-teal-800"],
  paid: ["Trasferito sul tuo conto Stripe", "bg-emerald-50 text-emerald-800"],
  on_hold: ["Sospeso: collega il conto", "bg-amber-100 text-amber-900"],
  failed: ["Non riuscito: ti contattiamo", "bg-red-50 text-red-800"],
  reversed: ["Stornato", "bg-red-50 text-red-800"],
  not_scheduled: ["—", "bg-gray-100 text-gray-600"],
};

async function Payments({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/pagamenti");
  if (!membership) redirect("/pro");
  const orgId = membership.organization_id;
  if (sp.stripe === "fatto") await syncStripeAccount(orgId);
  const db = await userDb();
  const [{ data: org }, { data: payouts }] = await Promise.all([
    db.from("organizations").select("is_demo, stripe_account_id, stripe_payouts_enabled, stripe_details_submitted").eq("id", orgId).maybeSingle(),
    db.from("payouts").select("id, amount_cents, status, scheduled_for, failure_reason, updated_at, booking:bookings(code, pickup_at)")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
  ]);
  const o = (org ?? {}) as { is_demo?: boolean; stripe_account_id?: string | null; stripe_payouts_enabled?: boolean; stripe_details_submitted?: boolean };
  const state = o.stripe_payouts_enabled ? "ready" : o.stripe_account_id ? "incomplete" : "none";
  const rows = (payouts ?? []) as unknown as { id: string; amount_cents: number; status: string; scheduled_for: string | null; failure_reason: string | null; updated_at: string; booking: { code: string; pickup_at: string } | null }[];
  const held = rows.filter((r) => r.status === "on_hold");

  return (
    <div className="space-y-5">
      <ProHeader title="Pagamenti e incassi" subtitle="KeyRent incassa dal cliente e ti versa il tuo netto 24 ore dopo il ritiro del mezzo." />
      <Flash sp={sp} ok={{}} />

      <section className={`card space-y-3 p-5 ${state === "ready" ? "" : "border-amber-200 bg-amber-50"}`}>
        <h2 className="font-semibold">Conto per i versamenti</h2>
        {state === "ready" ? (
          <p className="text-sm">✓ Conto collegato: i versamenti partono in automatico.</p>
        ) : (
          <>
            <p className="text-sm">
              {state === "none"
                ? "Per ricevere i versamenti serve un conto Stripe a nome della tua attività (gratuito, lo apri in pochi minuti)."
                : "Hai iniziato a collegare il conto ma Stripe ha ancora bisogno di alcuni dati."}
              {" "}Ti serviranno: dati dell&apos;azienda e del legale rappresentante, un documento d&apos;identità e l&apos;IBAN su cui ricevere i soldi.
            </p>
            {held.length > 0 && <p className="text-sm font-semibold">{held.length} versament{held.length === 1 ? "o" : "i"} in attesa: partono appena il conto è pronto.</p>}
            {o.is_demo ? (
              <p className="text-xs text-mute">Nell&apos;area demo il collegamento non è attivo.</p>
            ) : paymentsEnabled() ? (
              <form action={connectStripe}><SubmitOnce className="btn-primary w-full sm:w-auto">{state === "none" ? "Collega il conto Stripe" : "Completa i dati su Stripe"}</SubmitOnce></form>
            ) : (
              <p className="text-xs text-mute">I pagamenti online non sono ancora attivi: potrai collegare il conto prima del lancio.</p>
            )}
          </>
        )}
        <p className="text-xs text-mute">
          “Trasferito sul tuo conto Stripe” significa che i soldi sono sul tuo conto Stripe; da lì Stripe fa il bonifico sul tuo IBAN
          secondo il suo calendario (di solito entro pochi giorni lavorativi).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Versamenti</h2>
        {rows.length ? rows.map((r) => {
          const [label, tone] = PAYOUT[r.status] ?? [r.status, "bg-gray-100"];
          return (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="min-w-0">
                <b>{euro(r.amount_cents)}</b> · {r.booking?.code ?? ""}
                <span className="block text-mute">
                  {r.status === "paid" ? `Trasferito il ${fmtDateTime(r.updated_at)}` : r.scheduled_for ? `Previsto dal ${fmtDateTime(r.scheduled_for)}` : ""}
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
            </div>
          );
        }) : <p className="text-sm text-mute">Ancora nessun versamento: compariranno qui dopo le prime prenotazioni pagate.</p>}
      </section>
    </div>
  );
}
