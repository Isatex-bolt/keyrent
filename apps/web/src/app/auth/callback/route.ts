import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";

/** Arrivo dal link nell'email (conferma registrazione o accesso con link). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";
  if (code) {
    const db = await userDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/accedi?errore=" + encodeURIComponent("Il link non è valido o è scaduto. Accedi di nuovo."), url.origin));
}
