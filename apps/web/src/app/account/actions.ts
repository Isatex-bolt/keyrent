"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userDb } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const db = await userDb();
  const get = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const patch: Record<string, string | null> = { first_name: get("first_name"), last_name: get("last_name"), phone: get("phone") };
  // data di nascita e patente: solo se il modulo le contiene (il profilo del noleggiatore non le ha)
  for (const k of ["birth_date", "driving_license_since"]) if (formData.has(k)) patch[k] = get(k);
  const { error } = await db.from("profiles").update(patch).eq("id", user.id);
  const back = ["/pro/profilo", "/account/dati"].includes(String(formData.get("back"))) ? String(formData.get("back")) : "/account/dati";
  revalidatePath(back);
  redirect(error ? `${back}?errore=${encodeURIComponent("Salvataggio non riuscito")}` : `${back}?ok=1`);
}

/** "Aggiungi profilo privato": attiva il noleggio come persona, per scelta esplicita dell'utente. */
export async function addPrivateProfile(formData: FormData) {
  await requireUser("/account/privato");
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const { error } = await (await userDb()).rpc("enable_personal_renting", {
    p_first: get("first_name"), p_last: get("last_name"), p_phone: get("phone"), p_birth: get("birth_date") || null,
  });
  if (error) redirect(`/account/privato?errore=${encodeURIComponent(error.message.includes("EMPTY") ? "Inserisci nome, cognome e cellulare." : "Non riusciamo a salvare. Riprova.")}`);
  revalidatePath("/account/profilo");
  redirect("/account/profilo");
}
