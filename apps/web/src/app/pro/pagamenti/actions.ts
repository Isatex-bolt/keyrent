"use server";

import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { demoStop } from "@/lib/demo";
import { serviceDb } from "@/lib/supabase/admin";
import { accountLink, createExpressAccount, getAccount, paymentsEnabled } from "@/lib/stripe";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://keyrent.it").replace(/\/$/, "");
const back = (msg: string) => redirect(`/pro/pagamenti?errore=${encodeURIComponent(msg)}`);

/** Crea (una volta) il conto Stripe Express dell'attività e apre la pagina Stripe per completare i dati. */
export async function connectStripe() {
  const { user, membership } = await requireProvider("/pro/pagamenti");
  if (!membership) redirect("/pro");
  await demoStop(user.id);
  if (membership.role !== "owner") back("Solo il titolare dell'attività può collegare il conto per i versamenti.");
  if (!paymentsEnabled()) back("I pagamenti online non sono ancora attivi su KeyRent.");
  const db = serviceDb();
  const { data: org } = await db.from("organizations").select("id, legal_name, business_email, stripe_account_id").eq("id", membership.organization_id).single();
  let url = "";
  try {
    let acct = org?.stripe_account_id as string | null;
    if (!acct) {
      const a = await createExpressAccount({ orgId: membership.organization_id, email: org?.business_email ?? user.email ?? undefined, name: org?.legal_name ?? undefined });
      acct = a.id;
      const { error } = await db.rpc("svc_org_stripe_account", { p_org: membership.organization_id, p_account: acct, p_payouts_enabled: a.payouts_enabled, p_details: a.details_submitted });
      if (error) throw new Error(error.message);
    }
    url = (await accountLink(acct, SITE)).url;
  } catch (e) {
    console.error("connectStripe", e);
    back("Stripe non risponde in questo momento: riprova tra qualche minuto.");
  }
  redirect(url);
}

/** Rilegge lo stato del conto da Stripe (al ritorno dalla pagina Stripe o col pulsante Aggiorna). */
export async function syncStripeAccount(orgId: string) {
  const db = serviceDb();
  const { data: org } = await db.from("organizations").select("stripe_account_id").eq("id", orgId).maybeSingle();
  if (!org?.stripe_account_id || !paymentsEnabled()) return null;
  try {
    const a = await getAccount(org.stripe_account_id);
    await db.rpc("svc_org_stripe_account", { p_org: orgId, p_account: a.id, p_payouts_enabled: a.payouts_enabled, p_details: a.details_submitted });
    return a;
  } catch (e) {
    console.error("syncStripeAccount", e);
    return null;
  }
}
