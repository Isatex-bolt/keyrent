import "server-only";
import { expireAll, processRefunds, recoverCaptures, releaseStaleHolds, runPayouts } from "./payments";
import { flushEmails } from "./email";

/**
 * Lavori pianificati (non dipendono dalle visite al sito). Ogni passo è sicuro anche se due esecuzioni si sovrappongono:
 * il database prende in carico le righe una volta sola (skip locked / stati 'processing') e Stripe usa chiavi di idempotenza.
 * Un passo che fallisce non ferma gli altri.
 */
export async function runJobs() {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { out[name] = { error: (e as Error).message }; console.error("job", name, e); }
  };
  await step("expired", async () => (await expireAll()).length);
  await step("captures", recoverCaptures);
  await step("holds_released", releaseStaleHolds);
  await step("refunds", () => processRefunds());
  await step("payouts", runPayouts);
  await step("emails", () => flushEmails(50));
  return out;
}

export function authorizedJob(header: string | null) {
  const secret = process.env.CRON_SECRET;
  return !!secret && header === `Bearer ${secret}`;
}
