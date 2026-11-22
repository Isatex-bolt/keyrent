import { NextResponse, type NextRequest } from "next/server";
import { flushEmails } from "@/lib/email";

export const maxDuration = 60;

/** Invio periodico delle email in attesa (cron di Vercel). Protetto da CRON_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const result = await flushEmails(100);
  return NextResponse.json(result);
}
