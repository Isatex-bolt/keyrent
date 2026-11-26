import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { confirmHold, settleCapture } from "@/lib/payments";
import { serviceDb } from "@/lib/supabase/admin";
import { flushEmails } from "@/lib/email";

export const maxDuration = 60;

type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };

async function must(p: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** Elabora un evento. Lancia se qualcosa non è andato: Stripe lo rimanderà. */
async function handle(event: StripeEvent) {
  const db = serviceDb();
  const o = event.data.object;
  const metaBooking = (o.metadata as Record<string, string> | undefined)?.booking_id;

  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
      if (metaBooking) { await confirmHold(metaBooking); await flushEmails(20); }
      return;
    case "payment_intent.succeeded":
    case "payment_intent.canceled": {
      const pi = String(o.id);
      const { data: b, error } = await db.from("bookings").select("id, capture_pending_since").eq("stripe_payment_intent_id", pi).maybeSingle();
      if (error) throw new Error(error.message);
      if (b?.capture_pending_since) {
        // addebito rimasto in sospeso: ora Stripe ci dà l'esito certo
        const res = await settleCapture(b.id, pi, null, "verify");
        if (res === "pending" && event.type === "payment_intent.succeeded") throw new Error("conferma non registrata, riprovare");
        await flushEmails(20);
      }
      if (event.type === "payment_intent.canceled") await must(db.rpc("svc_payment_canceled", { p_pi: pi }), "svc_payment_canceled");
      return;
    }
    case "refund.created":
    case "refund.updated":
    case "charge.refund.updated": {
      const rowId = (o.metadata as Record<string, string> | undefined)?.refund_row;
      let id = rowId ?? null;
      if (!id) {
        const { data, error } = await db.rpc("svc_refund_by_stripe_id", { p_stripe_refund: String(o.id) });
        if (error) throw new Error(error.message);
        id = (data as string | null) ?? null;
      }
      if (!id) return;   // rimborso fatto fuori da KeyRent (dashboard Stripe): niente da aggiornare
      await must(db.rpc("svc_refund_update", {
        p_refund: id, p_stripe_refund: String(o.id), p_status: String(o.status), p_reason: (o.failure_reason as string | null) ?? null,
      }), "svc_refund_update");
      return;
    }
    case "charge.dispute.created":
      await must(db.rpc("svc_mark_payment_disputed", { p_pi: String(o.payment_intent) }), "svc_mark_payment_disputed");
      return;
    case "account.updated": {
      const acct = String(o.id);
      const { data: org, error } = await db.from("organizations").select("id").eq("stripe_account_id", acct).maybeSingle();
      if (error) throw new Error(error.message);
      if (!org) return;
      await must(db.rpc("svc_org_stripe_account", {
        p_org: org.id, p_account: acct, p_payouts_enabled: !!o.payouts_enabled, p_details: !!o.details_submitted,
      }), "svc_org_stripe_account");
      return;
    }
    default:
      return;   // eventi che non ci interessano: completati senza fare nulla
  }
}

/**
 * Notifiche di Stripe. Firma verificata; un evento è "completato" solo DOPO l'elaborazione riuscita.
 * Duplicato già completato → 200. In elaborazione altrove → 409 (Stripe riprova). Errore → 500 (Stripe riprova).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = await req.text();
  const sigOk = verifyWebhook(body, req.headers.get("stripe-signature"), secret)
    || (!!process.env.STRIPE_CONNECT_WEBHOOK_SECRET && verifyWebhook(body, req.headers.get("stripe-signature"), process.env.STRIPE_CONNECT_WEBHOOK_SECRET));
  if (!sigOk) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(body) as StripeEvent;
  const db = serviceDb();
  const { data: claim, error } = await db.rpc("svc_stripe_event_claim", { p_event_id: event.id, p_type: event.type, p_payload: event });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  if (claim === "done") return NextResponse.json({ received: true, duplicate: true });
  if (claim === "busy") return NextResponse.json({ error: "in elaborazione" }, { status: 409 });

  try {
    await handle(event);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("stripe webhook", event.type, event.id, msg);
    await db.rpc("svc_stripe_event_failed", { p_event_id: event.id, p_error: msg });
    return NextResponse.json({ error: "elaborazione non riuscita" }, { status: 500 });
  }
  const { error: dErr } = await db.rpc("svc_stripe_event_done", { p_event_id: event.id });
  if (dErr) return NextResponse.json({ error: "db" }, { status: 500 });   // rielaborare è sicuro: ogni passo è idempotente
  return NextResponse.json({ received: true });
}
