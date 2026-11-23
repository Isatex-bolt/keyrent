"use server";

import { sendEmailsSoon } from "@/lib/email";
import { requireUser } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { confirmHold } from "@/lib/payments";

/** Dopo che Stripe ha bloccato l'importo: verifica lato server e invia la richiesta al noleggiatore. */
export async function completeCardPayment(bookingId: string): Promise<{ ok: true } | { error: string }> {
  sendEmailsSoon();
  const user = await requireUser(`/account/prenotazioni/${bookingId}/pagamento`);
  const { data: b } = await serviceDb().from("bookings").select("customer_id").eq("id", bookingId).maybeSingle();
  if (!b || b.customer_id !== user.id) return { error: "Prenotazione non trovata." };
  return confirmHold(bookingId);
}
