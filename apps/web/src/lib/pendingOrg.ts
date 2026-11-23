import "server-only";
import { userDb } from "./supabase/server";

/** Dati dell'attività inseriti in registrazione, in attesa della conferma dell'email. */
export type PendingOrg = {
  legal_name: string; vat_number: string; trade_name?: string; street?: string; city?: string; postal_code?: string;
  province?: string; business_email?: string; business_phone?: string; pec?: string; sdi_code?: string;
};

export function pendingOrgOf(user: { user_metadata?: Record<string, unknown> } | null): PendingOrg | null {
  const p = user?.user_metadata?.pending_org as PendingOrg | undefined;
  return p && p.legal_name && p.vat_number ? p : null;
}

/**
 * Dopo la conferma dell'email: crea l'attività con i dati della registrazione (se l'utente non ne ha già una).
 * Se qualcosa va storto (es. P.IVA già presente) i dati restano e l'area noleggiatore li mostra già compilati.
 */
export async function completePendingOrg(): Promise<boolean> {
  const db = await userDb();
  const { data: u } = await db.auth.getUser();
  if (u.user) await completePendingRenter(db, u.user.user_metadata ?? {});
  const p = pendingOrgOf(u.user);
  if (!u.user || !p) return false;
  const { count } = await db.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("status", "active");
  if ((count ?? 0) === 0) {
    const { data: orgId, error } = await db.rpc("create_organization", {
      p_legal_name: p.legal_name, p_vat: p.vat_number, p_trade_name: p.trade_name || null,
    });
    if (error) return false;
    await db.from("organizations").update({
      business_email: p.business_email || null, business_phone: p.business_phone || null,
      pec: p.pec || null, sdi_code: p.sdi_code || null,
      legal_address: { street: p.street ?? "", city: p.city ?? "", postal_code: p.postal_code ?? "", province: p.province ?? "" },
    }).eq("id", orgId as string);
  }
  await db.auth.updateUser({ data: { pending_org: null } });
  return true;
}

type Db = Awaited<ReturnType<typeof userDb>>;
/** Azienda cliente indicata in registrazione ("Voglio noleggiare → Azienda"): la crea dopo la conferma dell'email. */
async function completePendingRenter(db: Db, meta: Record<string, unknown>) {
  const r = meta.pending_renter_org as { name?: string; vat?: string; sdi?: string; pec?: string } | undefined;
  if (!r?.name || !r.vat) return;
  const { error } = await db.rpc("create_renter_organization", {
    p_legal_name: r.name, p_vat: r.vat, p_sdi: r.sdi || null, p_pec: r.pec || null, p_email: null, p_phone: null, p_address: {},
  });
  // P.IVA già presente o database non aggiornato: i dati restano e l'utente completa da Profilo → Azienda
  if (!error) await db.auth.updateUser({ data: { pending_renter_org: null } });
}
