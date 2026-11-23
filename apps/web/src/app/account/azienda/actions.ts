"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CTX_COOKIE, requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";

const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = "/account/azienda/dati";
const fail = (m: string) => redirect(`${back}?errore=${encodeURIComponent(m)}`);
const address = (f: FormData) => ({ street: v(f, "street"), city: v(f, "city"), postal_code: v(f, "postal_code"), province: v(f, "province").toUpperCase(), country: v(f, "country") || "Italia" });

/** Nuova azienda cliente (prenota e riceve fatture; non pubblica mezzi). */
export async function createRenterOrg(f: FormData) {
  await requireUser(back);
  if (!v(f, "legal_name") || !v(f, "vat_number")) fail("Servono ragione sociale e partita IVA.");
  // P.IVA già in anagrafica (come azienda cliente o come attività di noleggio): niente doppioni, si recuperano gli accessi
  const vat = v(f, "vat_number").toUpperCase().replace(/\s+/g, "");
  const { data: found } = await serviceDb().from("organizations").select("id").eq("vat_number", vat).limit(1);
  if (found?.length) redirect(`${back}?esistente=1`);
  const db = await userDb();
  const { data, error } = await db.rpc("create_renter_organization", {
    p_legal_name: v(f, "legal_name"), p_vat: v(f, "vat_number"), p_sdi: v(f, "sdi_code").toUpperCase() || null, p_pec: v(f, "pec") || null,
    p_email: v(f, "business_email") || null, p_phone: v(f, "business_phone") || null, p_address: address(f),
  });
  if (error) /duplicate|unique/i.test(error.message) ? redirect(`${back}?esistente=1`) : fail("Non riusciamo a creare il profilo azienda. Riprova.");
  (await cookies()).set(CTX_COOKIE, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/account", "layout");
  redirect("/account/azienda?ok=1");
}

/** Dati di fatturazione (ragione sociale e P.IVA restano quelli registrati). */
export async function updateBilling(f: FormData) {
  await requireUser(back);
  const db = await userDb();
  const { error } = await db.from("organizations").update({
    sdi_code: v(f, "sdi_code").toUpperCase() || null, pec: v(f, "pec") || null, tax_code: v(f, "tax_code") || null,
    business_email: v(f, "business_email") || null, business_phone: v(f, "business_phone") || null, legal_address: address(f),
  }).eq("id", v(f, "id"));
  if (error) fail("Salvataggio non riuscito.");
  revalidatePath(back);
  redirect(`${back}?ok=1`);
}
