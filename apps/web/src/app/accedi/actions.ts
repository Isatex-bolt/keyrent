"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { userDb } from "@/lib/supabase/server";

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
}
const tipoOf = (f: FormData) => (f.get("tipo") === "noleggiatore" ? "noleggiatore" : "cliente");
const q = (tipo: string) => (tipo === "noleggiatore" ? "tipo=noleggiatore&" : "");

const authErrors: Record<string, string> = {
  "Invalid login credentials": "Email o password non corretti.",
  "Email not confirmed": "Devi prima confermare l'email: controlla la posta (anche lo spam).",
  "User already registered": "Esiste già un account con questa email. Accedi.",
};
const it = (m: string) => authErrors[m] ?? (m.includes("rate limit") ? "Troppi tentativi: riprova tra qualche minuto." : m);

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const tipo = tipoOf(formData);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const db = await userDb();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect(`/accedi?${q(tipo)}next=${encodeURIComponent(next)}&errore=${encodeURIComponent(it(error.message))}`);
  if (next) redirect(next);
  // senza destinazione: noleggiatori nella loro area, clienti nel loro account
  const { count } = await db.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("status", "active");
  const isProvider = (count ?? 0) > 0 || data.user?.user_metadata?.account_type === "provider";
  redirect(isProvider ? "/pro" : "/account");
}

export async function signUp(formData: FormData) {
  const tipo = tipoOf(formData);
  const next = safeNext(formData.get("next")) || (tipo === "noleggiatore" ? "/pro" : "/account");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const back = (msg: string) => redirect(`/registrati?${q(tipo)}next=${encodeURIComponent(next)}&errore=${encodeURIComponent(msg)}`);
  if (!formData.get("terms")) back("Per registrarti devi accettare termini e privacy.");
  if (password.length < 8) back("La password deve avere almeno 8 caratteri.");

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const db = await userDb();
  const { data, error } = await db.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { first_name: firstName, last_name: lastName, account_type: tipo === "noleggiatore" ? "provider" : "customer" },
    },
  });
  if (error) back(it(error.message));
  if (data.session) redirect(next); // conferma email disattivata
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

/** Un cliente che vuole anche pubblicare mezzi: diventa account noleggiatore. */
export async function becomeProvider() {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/accedi?tipo=noleggiatore&next=/pro");
  await db.auth.updateUser({ data: { account_type: "provider" } });
  redirect("/pro");
}
