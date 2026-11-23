import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";
import { completePendingOrg } from "@/lib/pendingOrg";

/** Arrivo dal link nell'email (vecchio formato con "code"). Il formato nuovo passa da /auth/conferma. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";
  const login = (msg: string, ok = false) =>
    NextResponse.redirect(new URL(`/accedi?${ok ? "ok" : "errore"}=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`, url.origin));

  if (url.searchParams.get("error_code") === "otp_expired") {
    return login("Il link è scaduto o è già stato usato. Se avevi già confermato, accedi con email e password; altrimenti registrati di nuovo.");
  }
  if (code) {
    const db = await userDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) await completePendingOrg();
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    // Link per la nuova password aperto in un altro browser o app: non si può usare, ne serve uno nuovo
    if (next === "/account/password") {
      return NextResponse.redirect(new URL(`/password-dimenticata?errore=${encodeURIComponent("Il link va aperto nello stesso browser in cui l'hai richiesto. Richiedine uno nuovo qui sotto.")}`, url.origin));
    }
    // Link di conferma aperto in un altro browser o app: l'email è comunque confermata, basta accedere
    return login("Email confermata ✓ Ora accedi con email e password.", true);
  }
  return login("Il link non è valido. Accedi con email e password.");
}
