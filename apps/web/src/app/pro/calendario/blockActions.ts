"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canEdit, requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { romeToIso } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const plusDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Blocca giorni di un mezzo (noleggio fuori da KeyRent, manutenzione). Passa dalla RLS: solo titolare o manager
 * dell'attività, solo blocchi (mai prenotazioni). Il database rifiuta i giorni già occupati.
 */
export async function blockDays(f: FormData) {
  const back = str(f, "back") || "/pro/calendario";
  const go = (msg: string, ok = false): never => redirect(`${back}${back.includes("?") ? "&" : "?"}${ok ? "ok" : "errore"}=${encodeURIComponent(msg)}`);
  const { membership } = await requireProvider(back);
  if (!membership || !canEdit(membership)) go("Il tuo ruolo non permette di bloccare giorni.");
  const listing = str(f, "listing_id"), dal = str(f, "dal"), al = str(f, "al") || str(f, "dal");
  const kind = str(f, "kind") === "maintenance" ? "maintenance" : "block";
  const start = romeToIso(dal, "00:00"), end = romeToIso(plusDay(al), "00:00");
  if (!start || !end || al < dal) go("Scegli i giorni da bloccare.");
  const db = await userDb();
  const { data: lu } = await db.from("listing_units").select("vehicle_unit_id").eq("listing_id", listing);
  const units = (lu ?? []).map((x) => x.vehicle_unit_id as string);
  if (!units.length) go("Mezzo non trovato.");
  const want = Math.min(units.length, Math.max(1, Number(str(f, "qty")) || units.length));
  const note = str(f, "note").slice(0, 200) || null;
  let done = 0;
  for (const u of units) {
    if (done >= want) break;
    const { error } = await db.from("unit_reservations").insert({
      vehicle_unit_id: u, period: `[${start},${end})`, kind, note,
    });
    if (!error) done++;
  }
  revalidatePath("/pro/calendario");
  revalidatePath("/pro");
  if (!done) go("Non si può bloccare: in quei giorni il mezzo è già prenotato o in attesa di risposta.");
  go(done < want ? `Bloccate ${done} unità su ${want}: le altre sono già occupate.` : "Giorni bloccati.", true);
}

export async function unblock(f: FormData) {
  const back = str(f, "back") || "/pro/calendario";
  const { membership } = await requireProvider(back);
  if (!membership || !canEdit(membership)) redirect(back);
  const db = await userDb();
  await db.from("unit_reservations").update({ active: false }).eq("id", str(f, "id")).in("kind", ["block", "maintenance"]);
  revalidatePath("/pro/calendario");
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Giorni di nuovo disponibili.")}`);
}
