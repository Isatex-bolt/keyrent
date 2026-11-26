import { NextResponse, type NextRequest } from "next/server";
import { runJobs } from "@/lib/jobs";
import { serviceDb } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Invio periodico delle email in attesa (cron di Vercel). Protetto da CRON_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const result = await runJobs();   // giro completo anche qui: rete di sicurezza se il giro ogni 5 minuti non è attivo
  // una volta al giorno: l'account di prova torna com'era (annunci di prova > 24 h via, noleggi finti rigenerati)
  const { data: demo, error } = await serviceDb().rpc("svc_demo_reset");
  return NextResponse.json({ jobs: result, demo: error ? `non attivo: ${error.message}` : demo });
}
