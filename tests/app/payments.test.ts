import { calls, handlers, reset, tables } from "./supabase/admin";
import { processRefunds, runPayouts, settleCapture } from "./payments";

type Reply = { status: number; body?: unknown } | "network";
let routes: [RegExp, string, () => Reply][] = [];
const hits: string[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const path = String(url).replace("https://api.stripe.com/v1/", "");
  const method = init?.method ?? "GET";
  hits.push(`${method} ${path}`);
  const r = routes.find(([re, m]) => m === method && re.test(path));
  if (!r) throw new Error(`rotta non prevista: ${method} ${path}`);
  const rep = r[2]();
  if (rep === "network") throw new Error("ETIMEDOUT");
  return new Response(JSON.stringify(rep.body ?? {}), { status: rep.status });
}) as typeof fetch;

let fails = 0, n = 0;
function ok(cond: boolean, msg: string) { n++; if (cond) console.log(`  ✓ ${msg}`); else { fails++; console.log(`  ✗ ${msg}`); } }
const called = (fn: string) => calls.some((c) => c.fn === fn);
function setup(r: typeof routes) { reset(); routes = r; hits.length = 0; }
const PI = (status: string, extra: Record<string, unknown> = {}) => ({ status: 200, body: { id: "pi_1", status, amount: 5000, amount_received: status === "succeeded" ? 5000 : 0, amount_capturable: 5000, ...extra } });

async function main() {
  tables.bookings = { stripe_payment_intent_id: "pi_1" };

  console.log("Addebito");
  setup([[/capture/, "POST", () => "network"], [/^payment_intents\/pi_1$/, "GET", () => PI("succeeded")]]);
  ok(await settleCapture("b1", "pi_1", "u1", "first") === "confirmed" && called("svc_confirm_paid_booking") && !called("svc_payment_failed"),
    "timeout ma Stripe ha addebitato → confermata, nessun annullamento");
  ok(calls.find((c) => c.fn === "svc_confirm_paid_booking")?.args.p_captured === 5000, "importo preso da Stripe, non dal client");

  setup([[/capture/, "POST", () => "network"], [/^payment_intents\/pi_1$/, "GET", () => "network"]]);
  ok(await settleCapture("b1", "pi_1", "u1", "first") === "pending" && !called("svc_payment_failed") && !called("svc_confirm_paid_booking"),
    "Stripe irraggiungibile → in verifica, prenotazione NON annullata");

  setup([[/capture/, "POST", () => ({ status: 500, body: { error: { type: "api_error" } } })], [/^payment_intents\/pi_1$/, "GET", () => PI("requires_capture")]]);
  ok(await settleCapture("b1", "pi_1", "u1", "first") === "pending" && !called("svc_payment_failed"), "errore 500, addebito non fatto → in verifica (riprova dopo)");

  setup([[/capture/, "POST", () => ({ status: 402, body: { error: { type: "card_error", code: "card_declined" } } })],
         [/^payment_intents\/pi_1$/, "GET", () => PI("requires_payment_method")], [/cancel/, "POST", () => PI("canceled")]]);
  ok(await settleCapture("b1", "pi_1", "u1", "first") === "failed" && called("svc_payment_failed"), "carta rifiutata (verificato su Stripe) → annullata");

  setup([[/capture/, "POST", () => PI("succeeded")]]);
  handlers.svc_confirm_paid_booking = () => ({ error: { message: "connessione persa" } });
  ok(await settleCapture("b1", "pi_1", "u1", "first") === "pending" && !called("svc_payment_failed"), "addebito riuscito ma salvataggio fallito → in verifica");
  setup([[/^payment_intents\/pi_1$/, "GET", () => PI("succeeded")]]);
  ok(await settleCapture("b1", "pi_1", null, "verify") === "confirmed" && !hits.some((h) => h.includes("capture")),
    "recupero: solo verifica, nessun secondo addebito, confermata dal sistema");
  ok(calls.find((c) => c.fn === "svc_confirm_paid_booking")?.args.p_actor === null, "conferma registrata come 'sistema'");

  console.log("Rimborsi");
  setup([[/^refunds\?payment_intent/, "GET", () => ({ status: 200, body: { data: [{ id: "re_9", status: "succeeded", amount: 1000, metadata: { refund_row: "r1" } }] } })],
         [/^refunds$/, "POST", () => ({ status: 200, body: { id: "re_dup", status: "succeeded" } })]]);
  handlers.svc_refunds_open = () => ({ data: [{ refund_id: "r1", booking_id: "b1", amount_cents: 1000, stripe_refund_id: null, payment_intent: "pi_1" }] });
  await processRefunds();
  ok(!hits.includes("POST refunds") && calls.some((c) => c.fn === "svc_refund_update" && c.args.p_stripe_refund === "re_9"),
    "rimborso già fatto (id non salvato) → ritrovato, nessun doppio rimborso");

  setup([[/^refunds\/re_5$/, "GET", () => ({ status: 200, body: { id: "re_5", status: "pending", amount: 1000 } })]]);
  handlers.svc_refunds_open = () => ({ data: [{ refund_id: "r2", booking_id: "b1", amount_cents: 1000, stripe_refund_id: "re_5", payment_intent: "pi_1" }] });
  const rr = await processRefunds();
  ok(rr.pending === 1 && calls.some((c) => c.fn === "svc_refund_update" && c.args.p_status === "pending"), "rimborso in corso resta in corso (non 'riuscito')");

  console.log("Versamenti");
  const due = [{ payout_id: "po1", booking_id: "b1", amount_cents: 4500, stripe_account_id: "acct_1", charge_ref: "pi_1" }];
  setup([[/^transfers\?transfer_group/, "GET", () => ({ status: 200, body: { data: [{ id: "tr_old", amount: 4500, destination: "acct_1", metadata: { payout_id: "po1" } }] } })]]);
  handlers.svc_claim_due_payouts = () => ({ data: due });
  await runPayouts();
  ok(!hits.includes("POST transfers") && calls.some((c) => c.fn === "svc_payout_paid" && c.args.p_transfer === "tr_old"), "trasferimento già fatto → ritrovato, nessun doppione");

  setup([[/^transfers\?transfer_group/, "GET", () => ({ status: 200, body: { data: [] } })], [/^payment_intents\/pi_1$/, "GET", () => PI("succeeded", { latest_charge: "ch_1" })],
         [/^transfers$/, "POST", () => "network"]]);
  handlers.svc_claim_due_payouts = () => ({ data: due });
  const pr = await runPayouts();
  ok(pr.retry === 1 && !called("svc_payout_failed") && !called("svc_payout_paid"), "timeout sul trasferimento → riprova più tardi, non segnato fallito");

  setup([[/^transfers\?transfer_group/, "GET", () => ({ status: 200, body: { data: [] } })], [/^payment_intents\/pi_1$/, "GET", () => PI("succeeded", { latest_charge: "ch_1" })],
         [/^transfers$/, "POST", () => ({ status: 400, body: { error: { type: "invalid_request_error", code: "insufficient_funds" } } })]]);
  handlers.svc_claim_due_payouts = () => ({ data: due });
  await runPayouts();
  ok(called("svc_payout_failed"), "rifiuto definitivo di Stripe → versamento 'non riuscito' (lo vede lo staff)");

  console.log(fails ? `✗ ${fails}/${n} test falliti` : `✔ ${n} test superati`);
  process.exit(fails ? 1 : 0);
}
main();
