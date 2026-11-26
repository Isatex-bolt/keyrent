"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireProvider, requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { bookingsOpen } from "@/lib/launch";
import { isDemoUser, demoStop } from "@/lib/demo";
import { sendEmailsSoon } from "@/lib/email";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function ltMessage(msg: string) {
  if (msg.includes("LT_NOT_OFFERED")) return "Questa combinazione di durata e km non è più disponibile: scegline un'altra nella scheda.";
  if (msg.includes("LT_CONTACT_MISSING")) return "Servono nome, email e telefono per farti ricontattare.";
  if (msg.includes("LT_COMPANY_MISSING")) return "Per un noleggio intestato all'azienda servono ragione sociale e partita IVA.";
  if (msg.includes("LT_REPORT_LATE")) return "Le richieste si possono segnalare entro 7 giorni dall'arrivo.";
  if (msg.includes("LT_REASON_MISSING")) return "Scrivi il motivo della segnalazione.";
  if (msg.includes("LT_LOCKED")) return "Questa richiesta è già stata segnalata.";
  if (msg.includes("NOT_FOUND")) return "Annuncio non disponibile.";
  return "Qualcosa non ha funzionato. Riprova tra poco.";
}

/** Cliente: invia la richiesta di lungo termine. La rata la ricalcola il database, non si usa quella del browser. */
export async function requestLongTerm(f: FormData) {
  const listing = s(f, "listing");
  const months = Number(s(f, "mesi")), km = Number(s(f, "km"));
  const services = f.getAll("servizi").map(String).filter((x) => /^[a-z_]{2,20}$/.test(x));
  const back = `/lungo-termine/${listing}?mesi=${months}&km=${km}${services.map((x) => `&servizi=${x}`).join("")}`;
  if (!bookingsOpen()) redirect(back);
  const user = await requireUser(back);
  const kind = s(f, "tipo") === "azienda" ? "azienda" : "privato";
  const { data, error } = await serviceDb().rpc("svc_create_lt_request", {
    p_user: user.id, p_listing: listing, p_months: months, p_km: km, p_services: services,
    p_name: s(f, "nome"), p_email: user.email ?? s(f, "email"), p_phone: s(f, "telefono"), p_kind: kind,
    p_company: s(f, "ragione_sociale"), p_vat: s(f, "piva"), p_note: s(f, "note").slice(0, 1000),
  });
  if (error || !data) redirect(`${back}&errore=${encodeURIComponent(ltMessage(error?.message ?? ""))}`);
  sendEmailsSoon();
  redirect(`/lungo-termine/${listing}?inviata=1`);
}

/** Noleggiatore: contattato / chiuso / segnala non valida (entro 7 giorni). */
export async function setLtStatus(f: FormData) {
  const { user, membership } = await requireProvider("/pro/lungo-termine");
  if (!membership) redirect("/pro");
  if (await isDemoUser(user.id)) await demoStop(user.id);
  const { error } = await serviceDb().rpc("svc_lt_set_status", {
    p_actor: user.id, p_id: s(f, "id"), p_status: s(f, "stato"), p_reason: s(f, "motivo").slice(0, 500) || null,
  });
  if (error) redirect(`/pro/lungo-termine?errore=${encodeURIComponent(ltMessage(error.message))}`);
  revalidatePath("/pro/lungo-termine");
  redirect(`/pro/lungo-termine?ok=${s(f, "stato") === "reported" ? "segnalata" : "salvato"}`);
}

/** Staff: decide su una segnalazione. */
export async function resolveLt(f: FormData) {
  await requireStaff();
  const { error } = await serviceDb().rpc("svc_lt_resolve", { p_id: s(f, "id"), p_invalid: s(f, "esito") === "invalida" });
  if (error) redirect(`/admin/lungo-termine?errore=${encodeURIComponent(ltMessage(error.message))}`);
  revalidatePath("/admin/lungo-termine");
  redirect("/admin/lungo-termine?ok=deciso");
}
