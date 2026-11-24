import { NextResponse, type NextRequest } from "next/server";
import { getDeliveryQuote } from "@/lib/data";

/** Prezzo della consegna per la posizione scelta (calcolato dal database, mai dal browser). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const id = p.get("id") ?? "";
  const lat = Number(p.get("lat")), lng = Number(p.get("lng"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Posizione non valida." }, { status: 400 });
  }
  const q = await getDeliveryQuote(id, lat, lng);
  if (!q) return NextResponse.json({ error: "Questo mezzo non ha la consegna." }, { status: 404 });
  return NextResponse.json(q, { headers: { "Cache-Control": "no-store" } });
}
