"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";
import { romeToIso } from "@/lib/format";
import { bookingError } from "@/lib/bookings";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function requestBooking(f: FormData) {
  const listing = str(f, "listing_id");
  const dal = str(f, "dal"), al = str(f, "al");
  const back = `/prenota/${listing}?dal=${dal}&al=${al}`;
  const user = await requireUser(back);
  if (!f.get("terms")) redirect(`${back}&errore=${encodeURIComponent("Devi accettare condizioni e policy di cancellazione.")}`);
  const pickup = romeToIso(dal, str(f, "ora_ritiro") || "10:00");
  const ret = romeToIso(al, str(f, "ora_riconsegna") || "10:00");
  if (!pickup || !ret || ret <= pickup) redirect(`${back}&errore=${encodeURIComponent("Controlla le date: la riconsegna deve essere dopo il ritiro.")}`);
  const driver = {
    first_name: str(f, "first_name"), last_name: str(f, "last_name"),
    birth_year: str(f, "birth_year"), license_year: str(f, "license_year"), notes: str(f, "notes").slice(0, 500),
  };
  const { data, error } = await serviceDb().rpc("svc_create_booking_request", {
    p_customer: user.id, p_listing: listing, p_pickup: pickup, p_return: ret, p_extras: [], p_driver: driver,
  });
  if (error) redirect(`${back}&errore=${encodeURIComponent(bookingError(error.message))}`);
  // salva nome e cognome nel profilo se mancano
  const db = await userDb();
  const { data: p } = await db.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
  if (!p?.first_name) await db.from("profiles").update({ first_name: driver.first_name, last_name: driver.last_name }).eq("id", user.id);
  redirect(`/account/prenotazioni/${data}?ok=richiesta`);
}

export async function cancelMyBooking(f: FormData) {
  const id = str(f, "id");
  const user = await requireUser(`/account/prenotazioni/${id}`);
  const { error } = await serviceDb().rpc("svc_cancel_booking", { p_booking: id, p_actor: user.id, p_side: "customer", p_reason: str(f, "reason") || null });
  if (error) redirect(`/account/prenotazioni/${id}?errore=${encodeURIComponent(bookingError(error.message))}`);
  revalidatePath("/account");
  redirect(`/account/prenotazioni/${id}?ok=cancellata`);
}
