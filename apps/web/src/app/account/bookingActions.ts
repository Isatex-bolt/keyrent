"use server";

import { sendEmailsSoon } from "@/lib/email";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCapabilities, requireUser } from "@/lib/auth";
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
  // per chi si prenota: profilo privato oppure un profilo azienda cliente (un'attività di noleggio non noleggia)
  const caps = await getCapabilities();
  let billingOrg = str(f, "billing_org");
  if (billingOrg && !caps.aziende.some((a) => a.id === billingOrg)) billingOrg = "";
  if (!billingOrg && !caps.privato) {
    if (caps.aziende[0]) billingOrg = caps.aziende[0].id;
    else redirect(`${back}&errore=${encodeURIComponent("Per noleggiare aggiungi un profilo privato o un profilo azienda dal tuo Profilo.")}`);
  }
  const driver = {
    first_name: str(f, "first_name"), last_name: str(f, "last_name"),
    birth_year: str(f, "birth_year"), license_year: str(f, "license_year"), notes: str(f, "notes").slice(0, 500),
  };
  // doppio invio (doppio tocco, pagina ricaricata): se la stessa richiesta esiste già da pochi minuti, si riprende quella
  const { data: dup } = await serviceDb().from("bookings").select("id, payment_required, payment_ready")
    .eq("customer_id", user.id).eq("listing_id", listing).eq("pickup_at", pickup).eq("return_at", ret).eq("status", "requested")
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (dup) redirect(dup.payment_required && !dup.payment_ready ? `/account/prenotazioni/${dup.id}/pagamento` : `/account/prenotazioni/${dup.id}`);
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
  // prenotazione intestata all'azienda scelta (il database controlla che il cliente ne faccia parte)
  if (billingOrg) {
    const { error: bErr } = await serviceDb().rpc("svc_set_booking_billing", { p_booking: data, p_customer: user.id, p_org: billingOrg });
    if (bErr) {
      // non resta una prenotazione intestata alla persona sbagliata: la richiesta si annulla subito (nessun addebito)
      await serviceDb().rpc("svc_cancel_booking", { p_booking: data, p_actor: user.id, p_side: "customer", p_reason: "intestazione azienda non riuscita" });
      redirect(`${back}&errore=${encodeURIComponent("Non riusciamo a intestare la prenotazione all'azienda scelta: riprova o scegli Privato.")}`);
    }
  }
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
