import { NextResponse } from "next/server";
import { getBadges } from "@/lib/badges";

/** Contatori delle novità dell'utente collegato, letti dal menu ogni 30 secondi. */
export async function GET() {
  const b = await getBadges();
  return NextResponse.json(b, { headers: { "Cache-Control": "no-store" } });
}
