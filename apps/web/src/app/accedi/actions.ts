"use server";

import { redirect } from "next/navigation";
import { getMemberships } from "@/lib/auth";
import { DEMO_EMAIL, DEMO_PASSWORD, isDemoUser } from "@/lib/demo";
import { headers } from "next/headers";
import { userDb } from "@/lib/supabase/server";
import { completePendingOrg } from "@/lib/pendingOrg";

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
}
const tipoOf = (f: FormData) => (f.get("tipo") === "noleggiatore" ? "noleggiatore" : "cliente");

const authErrors: Record<string, string> = {
  "Invalid login credentials": "Email o password non corretti.",
  "Email not confirmed": "Devi prima confermare l'email: controlla la posta (anche lo spam).",
  "User already registered": "Esiste già un account con questa email. Accedi.",
};
const it = (m: string) => authErrors[m] ?? (m.includes("rate limit") ? "Troppi tentativi: riprova tra qualche minuto." : m);

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const db = await userDb();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect(`/accedi?${next ? `next=${encodeURIComponent(next)}&` : ""}email=${encodeURIComponent(email)}&errore=${encodeURIComponent(it(error.message))}`);
  // noleggiatore appena confermato: crea l'attività con i dati della registrazione
  await completePendingOrg();
  if (next) redirect(next);
  // staff KeyRent: direttamente nell'area admin
  const { data: staff } = await db.from("staff_members").select("active").eq("user_id", data.user!.id).maybeSingle();
  if (staff?.active) redirect("/admin");
  // senza destinazione: noleggiatori nella loro area, clienti nel loro account
  // solo le attività di noleggio contano: un'azienda cliente (kind 'renter') resta nell'esperienza cliente
  const memberships = await getMemberships();
  const isProvider = memberships.length > 0 || !!data.user?.user_metadata?.pending_org;
  // senza destinazione: noleggiatori nella loro area, clienti restano sulla home
  redirect(isProvider ? "/pro" : "/");
}

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function signUp(formData: FormData) {
  const tipo = tipoOf(formData);
  const come = field(formData, "come") === "azienda" ? "azienda" : "privato";
  const next = safeNext(formData.get("next")) || (tipo === "noleggiatore" ? "/pro" : "/");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  const phone = field(formData, "phone");
  const step = tipo === "noleggiatore" ? "tipo=noleggiatore" : `tipo=cliente&come=${come}`;
  const back = (msg: string) => redirect(`/registrati?${step}&next=${encodeURIComponent(next)}&errore=${encodeURIComponent(msg)}`);
  if (!formData.get("terms")) back("Per registrarti devi accettare termini e privacy.");
  if (password.length < 8) back("La password deve avere almeno 8 caratteri.");

  const meta: Record<string, unknown> = {
    first_name: firstName, last_name: lastName, phone: phone || null,
    account_type: tipo === "noleggiatore" ? "provider" : "customer",
  };
  const vat = field(formData, "vat_number").toUpperCase().replace(/\s+/g, "");
  if (tipo === "noleggiatore") {
    if (!field(formData, "legal_name") || !vat) back("Inserisci ragione sociale e partita IVA della tua attività.");
    meta.pending_org = {
      legal_name: field(formData, "legal_name"), vat_number: vat, trade_name: field(formData, "trade_name"),
      street: field(formData, "street"), city: field(formData, "city"), postal_code: field(formData, "postal_code"),
      province: field(formData, "province").toUpperCase(), business_email: field(formData, "business_email"),
      business_phone: field(formData, "business_phone"), pec: field(formData, "pec"), sdi_code: field(formData, "sdi_code"),
    };
  } else {
    meta.customer_kind = come;
    if (come === "azienda") {
      if (!field(formData, "company_name") || !vat) back("Inserisci ragione sociale e partita IVA dell'azienda.");
      meta.company_name = field(formData, "company_name");
      meta.vat_number = vat;
      meta.pending_renter_org = { name: field(formData, "company_name"), vat, sdi: field(formData, "sdi_code").toUpperCase(), pec: field(formData, "pec") };
    }
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const db = await userDb();
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, data: meta },
  });
  // email già registrata: Supabase risponde con errore oppure con un utente senza identità
  const exists = error?.message === "User already registered" || (!error && data.user && (data.user.identities?.length ?? 0) === 0);
  if (exists) redirect(`/accedi?${next ? `next=${encodeURIComponent(next)}&` : ""}esistente=1&email=${encodeURIComponent(email)}`);
  if (error) back(it(error.message));
  if (data.session) { await completePendingOrg(); redirect(next); } // conferma email disattivata
  redirect(`/registrati/controlla-email?email=${encodeURIComponent(email)}`);
}

export async function sendMagicLink(formData: FormData) {
  const next = safeNext(formData.get("next")) || (tipoOf(formData) === "noleggiatore" ? "/pro" : "/account");
  const email = String(formData.get("email") ?? "").trim();
  const origin = (await headers()).get("origin") ?? "";
  const db = await userDb();
  const { error } = await db.auth.signInWithOtp({
    email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/accedi?next=${encodeURIComponent(next)}&errore=${encodeURIComponent(it(error.message))}`);
  redirect(`/registrati/controlla-email?email=${encodeURIComponent(email)}&tipo=link`);
}

/** Password dimenticata: email con il link per impostarne una nuova (risposta uguale anche se l'email non esiste). */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const db = await userDb();
    await db.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/account/password` });
  }
  redirect(`/password-dimenticata?inviata=1`);
}

/** Nuova password per l'utente collegato (anche arrivando dal link "password dimenticata"). */
export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (m: string) => redirect(`/account/password?errore=${encodeURIComponent(m)}`);
  if (password.length < 8) back("La password deve avere almeno 8 caratteri.");
  if (password !== confirm) back("Le due password non coincidono.");
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/accedi?next=/account/password");
  if (await isDemoUser(data.user.id)) back("Nell'account di prova la password non si può cambiare: serve a tutti quelli che provano KeyRent.");
  const { error } = await db.auth.updateUser({ password });
  if (error) back(error.message.includes("different from the old") ? "La nuova password deve essere diversa da quella attuale." : it(error.message));
  redirect("/account/password?ok=1");
}

/** Link /demo: entra nell'account di prova del concessionario con un tocco. */
export async function enterDemo() {
  const db = await userDb();
  await db.auth.signOut();
  const { error } = await db.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error) redirect(`/demo?errore=${encodeURIComponent("La demo non è disponibile in questo momento. Riprova tra poco.")}`);
  redirect("/pro");
}

/** Dalla demo alla registrazione vera: esce dall'account di prova e apre la registrazione da noleggiatore. */
export async function leaveDemoAndRegister() {
  const db = await userDb();
  await db.auth.signOut();
  redirect("/registrati?tipo=noleggiatore");
}
