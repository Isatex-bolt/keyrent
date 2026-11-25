import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const db = await userDb();
  await db.auth.signOut();
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // chi stava provando la demo torna alla pagina della demo
  const demo = request.cookies.get("kr_demo")?.value === "1";
  const res = NextResponse.redirect(new URL(demo ? "/demo" : safe, request.url), { status: 303 });
  if (demo) res.cookies.delete("kr_demo");
  return res;
}
