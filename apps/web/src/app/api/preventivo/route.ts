import { NextResponse, type NextRequest } from "next/server";
import { quoteOrError } from "@/lib/data";
import { romeToIso } from "@/lib/format";

/** Prezzo per le date scelte nella scheda del mezzo (calcolato dal database, mai dal browser). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const id = p.get("id") ?? "";
  const pickup = romeToIso(p.get("dal") ?? "", p.get("ora_ritiro") ?? "10:00");
  const ret = romeToIso(p.get("al") ?? "", p.get("ora_riconsegna") ?? "10:00");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !pickup || !ret) return NextResponse.json({ error: "Date non valide." }, { status: 400 });
  const q = await quoteOrError(id, pickup, ret);
  return NextResponse.json(q, { headers: { "Cache-Control": "no-store" } });
}
