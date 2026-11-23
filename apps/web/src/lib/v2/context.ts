import "server-only";
import { getUser, getMemberships } from "@/lib/auth";
import { cookies } from "next/headers";
import { ORG_COOKIE } from "@/lib/auth";
import { bySede, demoFleet, loadFleet, type FleetData } from "./fleet";

/**
 * ANTEPRIMA V2: dati veri del noleggiatore collegato; dati di esempio se non è un noleggiatore
 * o se l'indirizzo contiene ?demo=1 (per vedere la grafica con una flotta piena).
 */
export async function previewFleet(sp: Record<string, string | string[] | undefined>, from: string, to: string) {
  const sede = typeof sp.sede === "string" ? sp.sede : "tutte";
  const wantDemo = sp.demo === "1";
  let all: FleetData;
  let reason: "demo" | "no-login" | "no-provider" | null = null;
  const user = await getUser();
  const ms = user ? await getMemberships() : [];
  if (wantDemo || !user || !ms.length) {
    reason = wantDemo ? "demo" : !user ? "no-login" : "no-provider";
    all = demoFleet(from, to);
  } else {
    const chosen = (await cookies()).get(ORG_COOKIE)?.value;
    const m = ms.find((x) => x.organization_id === chosen) ?? ms[0];
    all = await loadFleet(m.organization_id, m.org.trade_name ?? m.org.legal_name, from, to);
  }
  return { all, data: bySede(all, sede), sede, reason, demoParam: wantDemo };
}

/** Mantiene ?demo e ?sede nei link interni dell'anteprima */
export function keep(sp: Record<string, string | string[] | undefined>, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (sp.demo === "1") p.set("demo", "1");
  if (typeof sp.sede === "string" && sp.sede !== "tutte") p.set("sede", sp.sede);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
