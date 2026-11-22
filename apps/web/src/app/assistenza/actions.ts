"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendEmailsSoon } from "@/lib/email";
import { requireUser, requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const BASES = ["/assistenza", "/pro/assistenza", "/admin/messaggi"] as const;
const baseOf = (f: FormData) => (BASES as readonly string[]).includes(str(f, "base")) ? str(f, "base") : "/assistenza";
const err = (path: string, msg: string) => redirect(`${path}?errore=${encodeURIComponent(msg)}`);

/** Nuova conversazione con il team KeyRent (dall'area noleggiatore vale per l'attività selezionata). */
export async function startSupport(f: FormData) {
  sendEmailsSoon();
  const base = baseOf(f);
  let org: string | null = null;
  if (base === "/pro/assistenza") org = (await requireProvider(base)).membership?.organization_id ?? null;
  else await requireUser(base);
  const subject = str(f, "subject"), body = str(f, "body");
  if (!subject || !body) err(base, "Scrivi l'argomento e il messaggio.");
  const db = await userDb();
  const { data, error } = await db.rpc("support_start", { p_subject: subject.slice(0, 200), p_body: body.slice(0, 4000), p_org: org });
  if (error) err(base, "Messaggio non inviato. Riprova.");
  redirect(`${base}/${data}?ok=inviato`);
}

export async function replySupport(f: FormData) {
  sendEmailsSoon();
  const base = baseOf(f);
  const id = str(f, "thread_id");
  await requireUser(`${base}/${id}`);
  const body = str(f, "body");
  if (body) {
    const db = await userDb();
    const { error } = await db.rpc("support_reply", { p_thread: id, p_body: body.slice(0, 4000) });
    if (error) err(`${base}/${id}`, "Messaggio non inviato. Riprova.");
  }
  revalidatePath(`${base}/${id}`);
  redirect(`${base}/${id}#fondo`);
}

/** Solo staff: segna la conversazione come risolta o la riapre. */
export async function setSupportStatus(f: FormData) {
  const id = str(f, "thread_id");
  await requireUser(`/admin/messaggi/${id}`);
  const db = await userDb();
  const status = str(f, "status") === "closed" ? "closed" : "open";
  const { error } = await db.rpc("support_set_status", { p_thread: id, p_status: status });
  if (error) err(`/admin/messaggi/${id}`, "Operazione non riuscita.");
  revalidatePath("/admin/messaggi");
  redirect(`/admin/messaggi/${id}?ok=${status === "closed" ? "chiusa" : "riaperta"}`);
}
