import "server-only";
import { after } from "next/server";
import { serviceDb } from "@/lib/supabase/admin";

/**
 * Account dimostrativo per i concessionari. Credenziali pubbliche per scelta (si mandano insieme al link /demo):
 * l'account non può prenotare, non riceve soldi, non può cambiare password; ogni notte torna com'era.
 */
export const DEMO_EMAIL = "concessionario@keyrent.it";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "123456";

export async function isDemoUser(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await serviceDb().rpc("svc_is_demo_user", { p_user: userId });
  return data === true;
}

/** Approva gli annunci della demo in verifica da almeno 30 secondi (dopo la risposta, senza rallentare la pagina). */
export function demoAutoapproveSoon(delayMs = 0) {
  after(async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await serviceDb().rpc("svc_demo_autoapprove");
  });
}
