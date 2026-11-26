import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Rinnova la sessione Supabase (cookie) quando serve. Nessuna autorizzazione qui: la fa il server/DB. */
// Chi sta provando la demo (cookie kr_demo) resta nella demo: registrazione, accesso e area cliente lo riportano alla sua area.
const DEMO_BLOCKED = ["/registrati", "/account", "/prenota", "/diventa-partner", "/password-dimenticata", "/messaggi/nuovo", "/assistenza", "/admin"];

export async function proxy(request: NextRequest) {
  // link della demo nelle email: prima si vede il sito come un cliente, dopo 30 s l'invito a entrare (DemoInvite)
  if (request.nextUrl.pathname === "/demo" && !request.nextUrl.search && request.cookies.get("kr_demo")?.value !== "1") {
    return NextResponse.redirect(new URL("/?demo=invito", request.url));
  }
  if (request.cookies.get("kr_demo")?.value === "1") {
    const path = request.nextUrl.pathname;
    // /accedi porta alla pagina demo (se la sessione è scaduta si rientra da lì, senza giri a vuoto)
    if (path === "/accedi" || path.startsWith("/accedi/")) return NextResponse.redirect(new URL("/demo", request.url));
    if (DEMO_BLOCKED.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.redirect(new URL("/pro", request.url));
  }
  let response = NextResponse.next({ request });
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
