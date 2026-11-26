"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProvider } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { romeToIso } from "@/lib/format";

/**
 * Prenotazioni manuali (telefono / banco): solo funzioni del database con controllo dell'attività e del ruolo,
 * stessa disponibilità delle prenotazioni online. Nessun pagamento, commissione o accredito.
 */
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeBack = (b: string) => (b.startsWith("/pro") ? b : "/pro/prenotazioni");
const withMsg = (back: string, k: "ok" | "errore", msg: string) => `${back}${back.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(msg)}`;

function message(m: string) {
  if (m.includes("NOT_AVAILABLE")) return "In quelle date il mezzo non è libero (prenotato, bloccato o in manutenzione). Scegli altre date.";
  if (m.includes("BAD_DATES")) return "La riconsegna deve essere dopo il ritiro.";
  if (m.includes("NAME_MISSING")) return "Scrivi il nome del cliente.";
  if (m.includes("FORBIDDEN")) return "Il tuo ruolo non permette di gestire le prenotazioni di questa attività.";
  if (m.includes("CANCELLED")) return "Questa prenotazione è già annullata.";
  if (m.includes("NOT_FOUND")) return "Prenotazione o mezzo non trovati.";
  return "Non siamo riusciti a salvare. Riprova tra poco.";
}

function fields(f: FormData) {
  const pickup = romeToIso(s(f, "dal"), s(f, "ora_ritiro") || "09:00");
  const ret = romeToIso(s(f, "al") || s(f, "dal"), s(f, "ora_riconsegna") || "18:00");
  const price = Math.round(Number(s(f, "prezzo").replace(/\./g, "").replace(",", ".")) * 100);
  return {
    p_listing: s(f, "mezzo"), p_pickup: pickup, p_return: ret,
    p_name: s(f, "nome").slice(0, 120), p_contact: s(f, "recapito").slice(0, 160) || null,
    p_price_cents: Number.isFinite(price) && price > 0 ? price : 0, p_note: s(f, "note").slice(0, 1000) || null,
  };
}

export async function createManual(f: FormData) {
  const back = safeBack(s(f, "back"));
  const form = `/pro/prenotazioni/manuale/nuova?mezzo=${s(f, "mezzo")}&dal=${s(f, "dal")}&back=${encodeURIComponent(back)}`;
  const { user } = await requireProvider(back);
  const v = fields(f);
  if (!v.p_pickup || !v.p_return) redirect(withMsg(form, "errore", "Scegli date e orari di ritiro e riconsegna."));
  const { error } = await serviceDb().rpc("svc_manual_create", { p_actor: user.id, ...v });
  if (error) redirect(withMsg(form, "errore", message(error.message)));
  revalidatePath("/pro", "layout");
  redirect(withMsg(back, "ok", "Prenotazione manuale salvata."));
}

export async function updateManual(f: FormData) {
  const back = safeBack(s(f, "back"));
  const id = s(f, "id");
  const form = `/pro/prenotazioni/manuale/${id}?back=${encodeURIComponent(back)}`;
  const { user } = await requireProvider(back);
  const v = fields(f);
  if (!v.p_pickup || !v.p_return) redirect(withMsg(form, "errore", "Scegli date e orari di ritiro e riconsegna."));
  const { error } = await serviceDb().rpc("svc_manual_update", { p_actor: user.id, p_id: id, ...v });
  if (error) redirect(withMsg(form, "errore", `${message(error.message)} La prenotazione è rimasta com'era.`));
  revalidatePath("/pro", "layout");
  redirect(withMsg(back, "ok", "Prenotazione aggiornata."));
}

export async function cancelManual(f: FormData) {
  const back = safeBack(s(f, "back"));
  const { user } = await requireProvider(back);
  const { error } = await serviceDb().rpc("svc_manual_cancel", { p_actor: user.id, p_id: s(f, "id") });
  if (error) redirect(withMsg(back, "errore", message(error.message)));
  revalidatePath("/pro", "layout");
  redirect(withMsg(back, "ok", "Prenotazione annullata: il mezzo è di nuovo libero."));
}
