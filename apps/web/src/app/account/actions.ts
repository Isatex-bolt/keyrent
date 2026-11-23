"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userDb } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const db = await userDb();
  const get = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const { error } = await db.from("profiles").update({
    first_name: get("first_name"), last_name: get("last_name"), phone: get("phone"),
  }).eq("id", user.id);
  const back = formData.get("back") === "/pro/profilo" ? "/pro/profilo" : "/account";
  revalidatePath(back);
  redirect(error ? `${back}?errore=${encodeURIComponent("Salvataggio non riuscito")}` : `${back}?ok=1`);
}
