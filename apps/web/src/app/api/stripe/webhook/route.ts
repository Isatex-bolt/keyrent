import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { confirmHold } from "@/lib/payments";
import { serviceDb } from "@/lib/supabase/admin";
import { flushEmails } from "@/lib/email";

/** Notifiche di Stripe: firma verificata, ogni evento elaborato una sola volta. */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = await req.text();
  if (!verifyWebhook(body, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const event = JSON.parse(body) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const db = serviceDb();
  const { data: fresh, error } = await db.rpc("svc_register_stripe_event", { p_event_id: event.id, p_type: event.type, p_payload: event });
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

  const o = event.data.object;
  try {
    if (event.type === "payment_intent.amount_capturable_updated") {
      const bookingId = (o.metadata as Record<string, string> | undefined)?.booking_id;
      if (bookingId) { await confirmHold(bookingId); await flushEmails(20); }
    } else if (event.type === "payment_intent.canceled") {
      await db.rpc("svc_payment_canceled", { p_pi: String(o.id) });
    } else if (event.type === "charge.dispute.created") {
      await db.rpc("svc_mark_payment_disputed", { p_pi: String(o.payment_intent) });
    }
  } catch (e) {
    console.error("stripe webhook", event.type, e);
  }
  return NextResponse.json({ received: true });
}
