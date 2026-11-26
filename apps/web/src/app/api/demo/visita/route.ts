import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/supabase/admin";
import { demoRef } from "@/lib/demoRef";

/** Registra l'apertura di un link personale della demo (solo il nome del link, nessun dato della persona). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ref = demoRef((body as { ref?: unknown }).ref);
  if (ref) await serviceDb().rpc("svc_demo_visit", { p_ref: ref });
  return new NextResponse(null, { status: 204 });
}
