import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { userDb } from "./supabase/server";

export type Membership = {
  organization_id: string;
  role: "owner" | "manager" | "staff";
  org: { id: string; legal_name: string; trade_name: string | null; verification_status: string };
};

export async function getUser() {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  return data.user ?? null;
}

export async function requireUser(next = "/account") {
  const user = await getUser();
  if (!user) redirect(`/accedi?next=${encodeURIComponent(next)}`);
  return user;
}

/** Le attività NOLEGGIATORE dell'utente (le aziende clienti non danno accesso all'area noleggiatore). */
export async function getMemberships(): Promise<Membership[]> {
  const db = await userDb();
  const res = await db.from("organization_members")
    .select("organization_id, role, org:organizations!inner(id, legal_name, trade_name, verification_status, kind)")
    .eq("status", "active").eq("org.kind", "provider");
  if (!res.error) return (res.data ?? []) as unknown as Membership[];
  // database senza la migrazione 0018: tutte le attività sono noleggiatori
  const { data } = await db.from("organization_members")
    .select("organization_id, role, org:organizations(id, legal_name, trade_name, verification_status)")
    .eq("status", "active");
  return (data ?? []) as unknown as Membership[];
}

export type BusinessProfile = { id: string; name: string; kind: "provider" | "renter"; role: string };
/** Le aziende per cui l'utente può prenotare (aziende clienti e anche le proprie attività noleggiatore). */
export async function getBusinessProfiles(): Promise<BusinessProfile[]> {
  const db = await userDb();
  const { data, error } = await db.from("organization_members")
    .select("organization_id, role, org:organizations(legal_name, trade_name, kind)").eq("status", "active");
  if (error) return [];
  return ((data ?? []) as unknown as { organization_id: string; role: string; org: { legal_name: string; trade_name: string | null; kind: string } }[])
    .map((m) => ({ id: m.organization_id, name: m.org.trade_name ?? m.org.legal_name, kind: m.org.kind === "renter" ? "renter" : "provider", role: m.role }));
}

/** Contesto di prenotazione del cliente: personale oppure una sua azienda (cookie). */
export const CTX_COOKIE = "kr_ctx";
export async function getBookingContext() {
  const [orgs, jar] = await Promise.all([getBusinessProfiles(), cookies()]);
  const v = jar.get(CTX_COOKIE)?.value;
  const current = orgs.find((o) => o.id === v) ?? null;
  return { orgs, current };
}

/** L'organizzazione su cui l'utente lavora (la prima; il selettore multi-azienda arriverà se servirà). */
export const ORG_COOKIE = "kr_org";

/** L'attività su cui l'utente sta lavorando: quella scelta nel selettore (cookie), altrimenti la prima. */
export async function requireProvider(next = "/pro") {
  const user = await requireUser(next);
  const memberships = await getMemberships();
  const chosen = (await cookies()).get(ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organization_id === chosen) ?? memberships[0] ?? null;
  return { user, membership, memberships };
}

export async function getStaffRole(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  const db = await userDb();
  const { data } = await db.from("staff_members").select("role, active").eq("user_id", user.id).maybeSingle();
  return data?.active ? (data.role as string) : null;
}

export async function requireStaff(roles: string[] = ["admin", "operations"]) {
  const user = await requireUser("/admin");
  const role = await getStaffRole();
  if (!role || !roles.includes(role)) redirect("/account?errore=non-autorizzato");
  return { user, role };
}

export function canEdit(m: Membership | null) {
  return m?.role === "owner" || m?.role === "manager";
}

export type AccountType = "provider" | "customer";

/** Tipo di account: scelto in registrazione (metadati), oppure noleggiatore se fa già parte di un'attività. */
export function accountType(user: { user_metadata?: Record<string, unknown> } | null, memberships: unknown[] = []): AccountType {
  if (memberships.length > 0) return "provider";
  // noleggiatore appena registrato, con l'attività in attesa di essere creata
  return user?.user_metadata?.pending_org ? "provider" : "customer";
}
