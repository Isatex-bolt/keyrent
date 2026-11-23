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

async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, string | number | boolean | undefined>, idem?: string): Promise<T> {
  if (!KEY) throw new Error("STRIPE_NOT_CONFIGURED");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: body ? form(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`STRIPE: ${json?.error?.code ?? res.status} ${json?.error?.message ?? ""}`.trim());
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
export const captureIntent = (id: string) => call<PaymentIntent>("POST", `payment_intents/${id}/capture`, {}, `capture-${id}`);
export const cancelIntent = (id: string) => call<PaymentIntent>("POST", `payment_intents/${id}/cancel`, {}, `cancel-${id}`);
export const refundIntent = (id: string, amount: number, refundRowId: string) =>
  call<{ id: string; status: string }>("POST", "refunds", { payment_intent: id, amount }, `refund-${refundRowId}`);

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
