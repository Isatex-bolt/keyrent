import "server-only";
import { serviceDb } from "./supabase/admin";
import { cancelIntent, getIntent, paymentsEnabled, refundIntent } from "./stripe";

/** Annulla il blocco sulla carta di una prenotazione (rifiutata, scaduta, annullata prima dell'addebito). */
export async function releaseHold(bookingId: string) {
  if (!paymentsEnabled()) return;
  const db = serviceDb();
  const { data: b } = await db.from("bookings").select("stripe_payment_intent_id").eq("id", bookingId).maybeSingle();
  if (!b?.stripe_payment_intent_id) return;
  try {
    const pi = await getIntent(b.stripe_payment_intent_id);
    if (["requires_capture", "requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)) {
      await cancelIntent(pi.id);
    }
    await db.rpc("svc_payment_canceled", { p_pi: pi.id });
  } catch (e) {
    console.error("releaseHold", bookingId, e);
  }
}

/** Scadenze: richieste mai pagate e richieste senza risposta (con rilascio del blocco sulla carta). */
export async function expireAll() {
  const { data, error } = await serviceDb().rpc("svc_expire_all");
  if (error) { await serviceDb().rpc("svc_expire_stale_bookings"); return; }   // migrazione 0017 non ancora installata
  for (const id of (data ?? []) as string[]) await releaseHold(id);
}

/** Verifica su Stripe che la carta sia bloccata per l'importo giusto e la segna sulla prenotazione. */
export async function confirmHold(bookingId: string): Promise<{ ok: true } | { error: string }> {
  const db = serviceDb();
  const { data: b } = await db.from("bookings").select("id, total_cents, stripe_payment_intent_id, payment_ready, status").eq("id", bookingId).maybeSingle();
  if (!b?.stripe_payment_intent_id) return { error: "Pagamento non trovato: riprova." };
  if (b.payment_ready) return { ok: true };
  const pi = await getIntent(b.stripe_payment_intent_id);
  if (pi.status !== "requires_capture") {
    return { error: pi.last_payment_error?.message ? `Carta non accettata: ${pi.last_payment_error.message}` : "Il pagamento non è stato completato: riprova." };
  }
  if (pi.amount_capturable !== b.total_cents) return { error: "Importo non corrispondente: contatta l'assistenza." };
  const { error } = await db.rpc("svc_payment_authorized", { p_booking: b.id, p_pi: pi.id, p_amount: pi.amount_capturable });
  if (error) {
    // le date non sono più bloccate (tempo scaduto): sblocchiamo subito la carta
    await cancelIntent(pi.id).catch(() => undefined);
    return { error: /HOLD_LOST|INVALID_STATE/.test(error.message) ? "Tempo scaduto: le date non sono più bloccate. Rifai la richiesta." : "Non riusciamo a registrare il pagamento: riprova." };
  }
  return { ok: true };
}

/** Rimborso dopo una cancellazione di prenotazione già pagata. */
export async function refundAfterCancel(bookingId: string) {
  if (!paymentsEnabled()) return;
  const db = serviceDb();
  const [{ data: b }, { data: refunds }] = await Promise.all([
    db.from("bookings").select("stripe_payment_intent_id").eq("id", bookingId).maybeSingle(),
    db.from("refunds").select("id, amount_cents").eq("booking_id", bookingId).eq("status", "pending"),
  ]);
  if (!b?.stripe_payment_intent_id) return;
  for (const r of refunds ?? []) {
    try {
      const out = await refundIntent(b.stripe_payment_intent_id, r.amount_cents, r.id);
      await db.rpc("svc_mark_refund_succeeded", { p_refund: r.id, p_stripe_refund: out.id });
    } catch (e) {
      console.error("refund", bookingId, e);
    }
  }
}
