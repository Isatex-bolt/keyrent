import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe via API REST (niente libreria): solo dal server, con la chiave segreta delle variabili d'ambiente. */
const KEY = process.env.STRIPE_SECRET_KEY;
export const paymentsEnabled = () => !!KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export type PaymentIntent = {
  id: string; status: string; amount: number; amount_capturable: number; amount_received: number;
  client_secret: string; metadata: Record<string, string>;
  last_payment_error?: { message?: string } | null;
};

function form(data: Record<string, string | number | boolean | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) p.append(k, String(v));
  return p;
}

/**
 * Errore di Stripe. `definitive` = Stripe ha risposto e ha detto NO (carta rifiutata, richiesta non valida):
 * ripetere non cambia l'esito. Tutto il resto (rete, timeout, 5xx, 429) = esito SCONOSCIUTO: si verifica dopo.
 */
export class StripeError extends Error {
  constructor(message: string, readonly httpStatus: number | null, readonly type: string | null, readonly code: string | null) {
    super(message);
  }
  get definitive() { return this.httpStatus !== null && this.httpStatus >= 400 && this.httpStatus < 500 && this.httpStatus !== 429 && this.httpStatus !== 409; }
}

async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, string | number | boolean | undefined>, idem?: string): Promise<T> {
  if (!KEY) throw new StripeError("STRIPE_NOT_CONFIGURED", null, null, null);
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idem ? { "Idempotency-Key": idem } : {}),
      },
      body: body ? form(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new StripeError(`STRIPE: rete/timeout ${(e as Error).message}`, null, null, null);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new StripeError(`STRIPE: ${json?.error?.code ?? res.status} ${json?.error?.message ?? ""}`.trim(),
      json ? res.status : null, json?.error?.type ?? null, json?.error?.code ?? null);
  }
  return json as T;
}

/** Blocco sulla carta (addebito solo quando il noleggiatore accetta). */
export function createHold(a: { bookingId: string; code: string; amount: number; email?: string }) {
  return call<PaymentIntent>("POST", "payment_intents", {
    amount: a.amount, currency: "eur", capture_method: "manual",
    "automatic_payment_methods[enabled]": true, "automatic_payment_methods[allow_redirects]": "never",
    description: `KeyRent ${a.code}`, receipt_email: a.email,
    "metadata[booking_id]": a.bookingId, "metadata[code]": a.code,
  }, `hold-${a.bookingId}`);
}
export const getIntent = (id: string) => call<PaymentIntent>("GET", `payment_intents/${id}`);
/** `attempt` cambia la chiave solo nei nuovi tentativi del recupero (Stripe ricorda anche le risposte d'errore per 24 h). */
export const captureIntent = (id: string, attempt = "") =>
  call<PaymentIntent>("POST", `payment_intents/${id}/capture`, {}, `capture-${id}${attempt ? `-${attempt}` : ""}`);
export const cancelIntent = (id: string) => call<PaymentIntent>("POST", `payment_intents/${id}/cancel`, {}, `cancel-${id}`);

export type StripeRefund = { id: string; status: string; amount: number; failure_reason?: string | null; metadata?: Record<string, string> };
export const refundIntent = (id: string, amount: number, refundRowId: string) =>
  call<StripeRefund>("POST", "refunds", { payment_intent: id, amount, "metadata[refund_row]": refundRowId }, `refund-${refundRowId}`);
export const getRefund = (id: string) => call<StripeRefund>("GET", `refunds/${id}`);
export const listRefunds = (pi: string) => call<{ data: StripeRefund[] }>("GET", `refunds?payment_intent=${encodeURIComponent(pi)}&limit=100`);

/** Trasferimento al conto Stripe del noleggiatore (NON è ancora il bonifico in banca: quello lo fa Stripe col suo calendario). */
export type StripeTransfer = { id: string; amount: number; destination: string; metadata?: Record<string, string> };
export const createTransfer = (a: { payoutId: string; amount: number; destination: string; bookingId: string; sourceCharge?: string | null }) =>
  call<StripeTransfer>("POST", "transfers", {
    amount: a.amount, currency: "eur", destination: a.destination, transfer_group: a.bookingId,
    source_transaction: a.sourceCharge ?? undefined, "metadata[payout_id]": a.payoutId, "metadata[booking_id]": a.bookingId,
  }, `transfer-${a.payoutId}`);
export const listTransfers = (bookingId: string) =>
  call<{ data: StripeTransfer[] }>("GET", `transfers?transfer_group=${encodeURIComponent(bookingId)}&limit=100`);
export const getCharge = (pi: string) => getIntent(pi).then((x) => (x as PaymentIntent & { latest_charge?: string | null }).latest_charge ?? null);

/** Stripe Connect Express: conto del noleggiatore e link per completare i dati (modalità test). */
export type StripeAccount = { id: string; payouts_enabled: boolean; details_submitted: boolean; charges_enabled: boolean;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null } };
export const createExpressAccount = (a: { orgId: string; email?: string; name?: string }) =>
  call<StripeAccount>("POST", "accounts", {
    type: "express", country: "IT", email: a.email, "business_type": "company", "company[name]": a.name,
    "capabilities[transfers][requested]": true, "metadata[organization_id]": a.orgId,
  }, `account-${a.orgId}`);
export const getAccount = (id: string) => call<StripeAccount>("GET", `accounts/${id}`);
export const accountLink = (account: string, base: string) =>
  call<{ url: string }>("POST", "account_links", {
    account, type: "account_onboarding", refresh_url: `${base}/pro/pagamenti?stripe=riprova`, return_url: `${base}/pro/pagamenti?stripe=fatto`,
  });

/** Firma dei webhook (header Stripe-Signature: t=…,v1=…), tolleranza 5 minuti. */
export function verifyWebhook(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((x) => x.length === 2));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
