import { NextResponse, type NextRequest } from "next/server";
import { authorizedJob, runJobs } from "@/lib/jobs";

export const maxDuration = 60;

/**
 * Giro dei lavori automatici: scadenze, addebiti da verificare, carte da sbloccare, rimborsi, accrediti, email.
 * Chiamato ogni 5 minuti dal database (pg_cron + pg_net) e una volta al giorno dal cron di Vercel. Protetto da CRON_SECRET.
 */
async function run(req: NextRequest) {
  if (!authorizedJob(req.headers.get("authorization"))) return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  return NextResponse.json(await runJobs());
}
export const GET = run;
export const POST = run;
