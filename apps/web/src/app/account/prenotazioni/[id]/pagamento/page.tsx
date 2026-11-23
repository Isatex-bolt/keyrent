import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { createHold, getIntent, paymentsEnabled } from "@/lib/stripe";
import { confirmHold, expireAll } from "@/lib/payments";
import { fmtDateTime } from "@/lib/bookings";
import { euro } from "@/lib/format";
import { Skeleton } from "@/components/ProPage";
import { CardPayment } from "./CardPayment";

export const metadata = { title: "Pagamento" };

export default function Page({ params }: PageProps<"/account/prenotazioni/[id]/pagamento">) {
  return <div className="mx-auto max-w-xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Pay params={params} /></Suspense></div>;
}

async function Pay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = `/account/prenotazioni/${id}`;
  const user = await requireUser(`${back}/pagamento`);
  if (!paymentsEnabled()) redirect(back);
  await expireAll();
  const db = serviceDb();
  const { data: b } = await db.from("bookings")
    .select("id, code, customer_id, status, total_cents, deposit_cents, pickup_at, return_at, created_at, payment_required, payment_ready, stripe_payment_intent_id, listings(title)")
    .eq("id", id).maybeSingle();
  if (!b || b.customer_id !== user.id) notFound();
  if (!b.payment_required || b.payment_ready || b.status !== "requested") redirect(back);

  let pi = b.stripe_payment_intent_id ? await getIntent(b.stripe_payment_intent_id) : null;
  if (!pi) {
    pi = await createHold({ bookingId: b.id, code: b.code, amount: b.total_cents, email: user.email ?? undefined });
    await db.rpc("svc_set_payment_intent", { p_booking: b.id, p_customer: user.id, p_pi: pi.id });
  }
  // carta già inserita (es. pagina ricaricata dopo il pagamento)
  if (pi.status === "requires_capture") {
    const r = await confirmHold(b.id);
    if ("ok" in r) redirect(`${back}?ok=richiesta`);
  }
  const listing = (Array.isArray(b.listings) ? b.listings[0] : b.listings) as { title: string } | null;
  const deadline = new Date(new Date(b.created_at).getTime() + 30 * 60_000).toISOString();
  return (
    <div className="space-y-5">
      <div>
        <Link href={back} className="text-sm text-mute hover:text-navy-900">← Prenotazione {b.code}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Inserisci la carta</h1>
        <p className="text-sm text-mute">{listing?.title} · {fmtDateTime(b.pickup_at)} → {fmtDateTime(b.return_at)}</p>
      </div>
      <div className="card space-y-1 p-5">
        <div className="flex items-baseline justify-between"><span className="text-sm text-mute">Totale noleggio</span><span className="text-2xl font-bold">{euro(b.total_cents)}</span></div>
        <p className="text-sm">Ora l&apos;importo viene solo <b>bloccato</b> sulla carta. Lo addebitiamo quando il noleggiatore accetta (entro 24 ore); se rifiuta o non risponde, il blocco si annulla e non paghi nulla.</p>
        {b.deposit_cents > 0 && <p className="text-xs text-mute">Cauzione {euro(b.deposit_cents)} gestita dal noleggiatore al ritiro.</p>}
      </div>
      <CardPayment bookingId={b.id} clientSecret={pi.client_secret} amountLabel={euro(b.total_cents)}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!} deadline={deadline} />
    </div>
  );
}
