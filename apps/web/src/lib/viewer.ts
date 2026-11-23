import "server-only";
import { accountType, getMemberships, getUser } from "@/lib/auth";

/** Chi sta guardando (per la guida): non loggato, cliente o noleggiatore. Non lancia mai errori. */
export async function getViewer(): Promise<{ loggedIn: boolean; provider: boolean }> {
  try {
    const user = await getUser();
    if (!user) return { loggedIn: false, provider: false };
    const m = await getMemberships();
    return { loggedIn: true, provider: accountType(user, m) === "provider" && m.length > 0 };
  } catch {
    return { loggedIn: false, provider: false };
  }
}
