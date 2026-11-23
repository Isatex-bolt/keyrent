"use server";

import { sendEmailsSoon } from "@/lib/email";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { userDb } from "@/lib/supabase/server";
import { romeToIso } from "@/lib/format";
import { bookingError } from "@/lib/bookings";
import { paymentsEnabled } from "@/lib/stripe";
import { refundAfterCancel, releaseHold } from "@/lib/payments";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function requestBooking(f: FormData) {
  sendEmailsSoon();
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
  let paid = paymentsEnabled();
  let { data, error } = paid
    ? await serviceDb().rpc("svc_create_paid_booking_request", { p_customer: user.id, p_listing: listing, p_pickup: pickup, p_return: ret, p_driver: driver })
    : await serviceDb().rpc("svc_create_booking_request", {
      p_customer: user.id, p_listing: listing, p_pickup: pickup, p_return: ret, p_extras: [], p_driver: driver,
    });
  // database non ancora aggiornato per i pagamenti: richiesta senza carta, come prima
  if (paid && error && /svc_create_paid_booking_request|schema cache|does not exist/i.test(error.message)) {
    paid = false;
    ({ data, error } = await serviceDb().rpc("svc_create_booking_request", {
      p_customer: user.id, p_listing: listing, p_pickup: pickup, p_return: ret, p_extras: [], p_driver: driver,
    }));
  }
  if (error) redirect(`${back}&errore=${encodeURIComponent(bookingError(error.message))}`);
  // salva nome e cognome nel profilo se mancano
  const db = await userDb();
  const { data: p } = await db.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
  if (!p?.first_name) await db.from("profiles").update({ first_name: driver.first_name, last_name: driver.last_name }).eq("id", user.id);
  redirect(paid ? `/account/prenotazioni/${data}/pagamento` : `/account/prenotazioni/${data}?ok=richiesta`);
}

export async function cancelMyBooking(f: FormData) {
  sendEmailsSoon();
  const id = str(f, "id");
  const user = await requireUser(`/account/prenotazioni/${id}`);
  const { data: refund, error } = await serviceDb().rpc("svc_cancel_booking", { p_booking: id, p_actor: user.id, p_side: "customer", p_reason: str(f, "reason") || null });
  if (error) redirect(`/account/prenotazioni/${id}?errore=${encodeURIComponent(bookingError(error.message))}`);
  // prima dell'addebito: si annulla il blocco sulla carta; dopo: rimborso secondo la policy
  if (Number(refund) > 0) await refundAfterCancel(id); else await releaseHold(id);
  revalidatePath("/account");
  redirect(`/account/prenotazioni/${id}?ok=cancellata`);
}
