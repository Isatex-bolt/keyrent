import "server-only";
import { userDb } from "@/lib/supabase/server";

/** Mezzi dell'attività per il modulo (titolo + sede). */
export async function orgVehicles(orgId: string) {
  const db = await userDb();
  const { data } = await db.from("listings").select("id, title, status, locations(name)").eq("organization_id", orgId).order("title");
  return ((data ?? []) as unknown as { id: string; title: string; locations: { name: string } | null }[])
    .map((l) => ({ id: l.id, title: l.title, location: l.locations?.name ?? "" }));
}

/** "2026-11-28T09:00:00Z" → ["2026-11-28", "10:00"] in ora di Roma */
export function romeParts(iso: string): [string, string] {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
  const time = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return [day, time];
}
