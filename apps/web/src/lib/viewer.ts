import "server-only";
import { accountType, getMemberships, getUser } from "@/lib/auth";

/** Chi sta guardando (per la guida): non loggato, cliente o noleggiatore. Non lancia mai errori. */
export type ViewerInfo = { loggedIn: boolean; provider: boolean; orgName?: string };

export async function getViewer(): Promise<ViewerInfo> {
  try {
    const user = await getUser();
    if (!user) return { loggedIn: false, provider: false };
    const m = await getMemberships();
    const provider = accountType(user, m) === "provider" && m.length > 0;
    return { loggedIn: true, provider, orgName: provider ? (m[0].org.trade_name ?? m[0].org.legal_name) : undefined };
  } catch {
    return { loggedIn: false, provider: false };
  }
}
