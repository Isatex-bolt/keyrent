"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function startConversation(f: FormData) {
  const listing = str(f, "listing_id");
  await requireUser(`/messaggi/nuovo?annuncio=${listing}`);
  const body = str(f, "body");
  if (!body) redirect(`/messaggi/nuovo?annuncio=${listing}&errore=${encodeURIComponent("Scrivi un messaggio.")}`);
  const db = await userDb();
  const { data, error } = await db.rpc("start_conversation", { p_listing: listing, p_body: body.slice(0, 4000) });
  if (error) redirect(`/messaggi/nuovo?annuncio=${listing}&errore=${encodeURIComponent("Messaggio non inviato. Riprova.")}`);
  redirect(`/messaggi/${data}`);
}

export async function sendMessage(f: FormData) {
  const conv = str(f, "conversation_id");
  const base = str(f, "base") === "/pro/messaggi" ? "/pro/messaggi" : "/messaggi";
  await requireUser(`${base}/${conv}`);
  const body = str(f, "body");
  if (body) {
    const db = await userDb();
    const { error } = await db.rpc("send_message", { p_conversation: conv, p_body: body.slice(0, 4000) });
    if (error) redirect(`${base}/${conv}?errore=${encodeURIComponent("Messaggio non inviato. Riprova.")}`);
  }
  revalidatePath(`${base}/${conv}`);
  redirect(`${base}/${conv}#fondo`);
}
