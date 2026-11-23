import "server-only";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { bySede, loadFleet } from "./fleet";

/** Dati della flotta del noleggiatore collegato (attività selezionata), filtrati per sede. */
export async function proFleet(sp: Record<string, string | string[] | undefined>, from: string, to: string, next = "/pro") {
  const { membership } = await requireProvider(next);
  if (!membership) redirect("/pro");
  const sede = typeof sp.sede === "string" ? sp.sede : "tutte";
  const all = await loadFleet(membership.organization_id, membership.org.trade_name ?? membership.org.legal_name, from, to);
  return { all, data: bySede(all, sede), sede, membership };
}

/** Mantiene ?sede nei link interni */
export function keepSede(sp: Record<string, string | string[] | undefined>, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (typeof sp.sede === "string" && sp.sede !== "tutte") p.set("sede", sp.sede);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
