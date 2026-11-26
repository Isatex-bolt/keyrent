import "server-only";
import { serviceDb } from "./supabase/admin";
import {
  StripeError, cancelIntent, captureIntent, createTransfer, getCharge, getIntent, getRefund, listRefunds, listTransfers,
  paymentsEnabled, refundIntent, type PaymentIntent,
} from "./stripe";

/** Esegue una funzione del database e LANCIA se fallisce (mai ignorare un errore su pagamenti). */
async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Annulla il blocco sulla carta di una prenotazione (rifiutata, scaduta, annullata prima dell'addebito). */
export async function releaseHold(bookingId: string) {
  const db = serviceDb();
  const { data: b } = await db.from("bookings").select("stripe_payment_intent_id").eq("id", bookingId).maybeSingle();
  if (!b?.stripe_payment_intent_id) return;
  // noleggio finto dell'account di prova: nessuna carta vera da sbloccare
  if (b.stripe_payment_intent_id.startsWith("pi_demo_")) { await db.rpc("svc_payment_canceled", { p_pi: b.stripe_payment_intent_id }); return; }
  if (!paymentsEnabled()) return;
  try {
    const pi = await getIntent(b.stripe_payment_intent_id);
    if (["requires_capture", "requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)) {
      await cancelIntent(pi.id);
    }
    if (pi.status !== "succeeded") await rpc("svc_payment_canceled", { p_pi: pi.id });
  } catch (e) {
    // resta "authorized": il processo pianificato (svc_holds_to_release) riprova
    console.error("releaseHold", bookingId, e);
  }
}

/** Scadenze: richieste mai pagate e richieste senza risposta (con rilascio del blocco sulla carta). */
export async function expireAll() {
  const { data, error } = await serviceDb().rpc("svc_expire_all");
  if (error) { console.error("svc_expire_all", error.message); return []; }
  for (const id of (data ?? []) as string[]) await releaseHold(id);
  return (data ?? []) as string[];
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

// ---------------------------------------------------------------------------------------------------------------
// ADDEBITO: tre esiti possibili. "confirmed" e "failed" sono certi; "pending" = non sappiamo ancora, il mezzo resta
// bloccato e il recupero automatico (job + webhook) chiude la pratica appena Stripe dà una risposta certa.
// ---------------------------------------------------------------------------------------------------------------
export type CaptureOutcome = "confirmed" | "failed" | "pending";

/**
 * Porta a termine l'addebito di una prenotazione già accettata.
 * mode "first" = prima prova dal pulsante Accetta · "retry" = nuovo tentativo del recupero · "verify" = solo controllo.
 * actor nullo = sistema (recupero/webhook).
 */
export async function settleCapture(bookingId: string, piId: string, actor: string | null, mode: "first" | "retry" | "verify"): Promise<CaptureOutcome> {
  let pi: PaymentIntent | null = null;
  if (mode !== "verify") {
    try {
      pi = await captureIntent(piId, mode === "retry" ? String(Math.floor(Date.now() / 600_000)) : "");
    } catch (e) {
      console.error("capture", bookingId, (e as Error).message);   // qualunque errore: controlliamo lo stato reale su Stripe
    }
  }
  if (!pi || pi.status !== "succeeded") {
    try { pi = await getIntent(piId); } catch (e) { console.error("capture verify", bookingId, (e as Error).message); return "pending"; }
  }
  if (pi.status === "succeeded") {
    const { error } = await serviceDb().rpc("svc_confirm_paid_booking", {
      p_booking: bookingId, p_actor: actor, p_pi: pi.id, p_captured: pi.amount_received,
    });
    if (error) { console.error("confirm after capture", bookingId, error.message); return "pending"; }
    return "confirmed";
  }
  if (pi.status === "canceled" || pi.status === "requires_payment_method") {
    // esito DEFINITIVO verificato su Stripe: la carta non verrà più addebitata
    await rpc("svc_payment_failed", { p_booking: bookingId });
    await releaseHold(bookingId);
    return "failed";
  }
  return "pending";   // requires_capture (addebito non ancora fatto) o processing: si riprova più tardi
}

/** Recupero: prenotazioni rimaste con "addebito in corso". */
export async function recoverCaptures() {
  const out = { confirmed: 0, failed: 0, pending: 0 };
  if (!paymentsEnabled()) return out;
  const rows = await rpc<{ booking_id: string; payment_intent: string; pending_since: string }[]>("svc_pending_captures");
  for (const r of rows ?? []) {
    const age = Date.now() - new Date(r.pending_since).getTime();
    if (age < 2 * 60_000) continue;   // il pulsante Accetta potrebbe essere ancora al lavoro
    const res = await settleCapture(r.booking_id, r.payment_intent, null, age > 5 * 60_000 ? "retry" : "verify");
    out[res]++;
  }
  return out;
}

/** Carte rimaste bloccate su prenotazioni chiuse. */
export async function releaseStaleHolds() {
  const rows = await rpc<{ booking_id: string }[]>("svc_holds_to_release");
  for (const r of rows ?? []) await releaseHold(r.booking_id);
  return (rows ?? []).length;
}

// ---------------------------------------------------------------------------------------------------------------
// RIMBORSI: il rimborso è "riuscito" solo quando Stripe lo dice. Ripetere non crea doppi rimborsi
// (stessa chiave + ricerca dei rimborsi già fatti con il nostro id nei metadati).
// ---------------------------------------------------------------------------------------------------------------
export async function processRefunds(bookingId?: string) {
  const out = { succeeded: 0, pending: 0, failed: 0, errors: 0 };
  if (!paymentsEnabled()) return out;
  const rows = await rpc<{ refund_id: string; booking_id: string; amount_cents: number; stripe_refund_id: string | null; payment_intent: string }[]>("svc_refunds_open");
  for (const r of (rows ?? []).filter((x) => !bookingId || x.booking_id === bookingId)) {
    if (r.payment_intent.startsWith("pi_demo_")) continue;
    try {
      let ref = r.stripe_refund_id ? await getRefund(r.stripe_refund_id) : null;
      if (!ref) ref = (await listRefunds(r.payment_intent)).data.find((x) => x.metadata?.refund_row === r.refund_id) ?? null;
      if (!ref) ref = await refundIntent(r.payment_intent, r.amount_cents, r.refund_id);
      await rpc("svc_refund_update", { p_refund: r.refund_id, p_stripe_refund: ref.id, p_status: ref.status, p_reason: ref.failure_reason ?? null });
      if (ref.status === "succeeded") out.succeeded++; else if (ref.status === "failed" || ref.status === "canceled") out.failed++; else out.pending++;
    } catch (e) {
      out.errors++;
      console.error("refund", r.refund_id, (e as Error).message);
    }
  }
  return out;
}

/** Rimborso dopo una cancellazione di prenotazione già pagata. */
export async function refundAfterCancel(bookingId: string) {
  await processRefunds(bookingId);
}

// ---------------------------------------------------------------------------------------------------------------
// ACCREDITI AL NOLEGGIATORE: trasferimento sul suo conto Stripe Connect (il bonifico in banca lo fa poi Stripe).
// ---------------------------------------------------------------------------------------------------------------
export async function runPayouts() {
  const out = { paid: 0, failed: 0, retry: 0, requeued: 0 };
  out.requeued = (await rpc<number>("svc_payouts_unstick")) ?? 0;
  const rows = await rpc<{ payout_id: string; booking_id: string; amount_cents: number; stripe_account_id: string | null; charge_ref: string }[]>("svc_claim_due_payouts", { p_limit: 20 });
  for (const p of rows ?? []) {
    if (p.charge_ref.startsWith("pi_demo_")) { await rpc("svc_payout_paid", { p_payout: p.payout_id, p_transfer: `tr_demo_${p.payout_id}` }); out.paid++; continue; }
    if (!paymentsEnabled() || !p.stripe_account_id) { out.retry++; continue; }   // resta 'processing': torna in coda dopo 15 minuti
    try {
      const existing = (await listTransfers(p.booking_id)).data.find((t) => t.metadata?.payout_id === p.payout_id);
      const tr = existing ?? await createTransfer({
        payoutId: p.payout_id, amount: p.amount_cents, destination: p.stripe_account_id, bookingId: p.booking_id,
        sourceCharge: await getCharge(p.charge_ref),
      });
      await rpc("svc_payout_paid", { p_payout: p.payout_id, p_transfer: tr.id });
      out.paid++;
    } catch (e) {
      if (e instanceof StripeError && e.definitive) {
        await rpc("svc_payout_failed", { p_payout: p.payout_id, p_reason: e.message });
        out.failed++;
      } else {
        out.retry++;   // esito sconosciuto: stessa chiave di idempotenza al prossimo giro, nessun doppio trasferimento
        console.error("payout", p.payout_id, (e as Error).message);
      }
    }
  }
  return out;
}
