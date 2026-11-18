import "server-only";
import { redirect } from "next/navigation";
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

export async function getMemberships(): Promise<Membership[]> {
  const db = await userDb();
  const { data } = await db.from("organization_members")
    .select("organization_id, role, org:organizations(id, legal_name, trade_name, verification_status)")
    .eq("status", "active");
  return (data ?? []) as unknown as Membership[];
}

/** L'organizzazione su cui l'utente lavora (la prima; il selettore multi-azienda arriverà se servirà). */
export async function requireProvider(next = "/pro") {
  const user = await requireUser(next);
  const memberships = await getMemberships();
  return { user, membership: memberships[0] ?? null, memberships };
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
