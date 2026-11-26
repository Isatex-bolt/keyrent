import "server-only";
import { userDb } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/supabase/public";

/**
 * ANTEPRIMA V2 — dati della flotta per dashboard, catalogo e calendario.
 * Sola lettura: legge tabelle esistenti con i permessi del noleggiatore (RLS). Nessuna scrittura.
 */
export type DayState = "free" | "booked" | "pending" | "off" | "partial";
export type FleetBooking = {
  id: string; code: string; status: string; listingId: string; locationId: string;
  pickupAt: string; returnAt: string; totalCents: number; netCents: number; customer: string;
  /** prenotazione presa al telefono / al banco (status "manual"): recapito e note visibili solo all'attività */
  manual?: { contact: string | null; note: string | null };
};
export type FleetVehicle = {
  id: string; title: string; status: string; category: string; categorySlug: string; make: string; model: string;
  locationId: string; locationName: string; priceFromCents: number | null; cover: string | null;
  quantityMode: "single" | "pool"; units: number;
  /** stato per giorno (YYYY-MM-DD) nell'intervallo caricato + disponibili/total per i pool */
  days: Record<string, { state: DayState; free: number; bookingIds: string[] }>;
  upcoming: number; alerts: string[];
};
export type FleetData = {
  demo: boolean; orgName: string; from: string; to: string; today: string;
  locations: { id: string; name: string; city: string }[];
  vehicles: FleetVehicle[]; bookings: FleetBooking[];
  requests: FleetBooking[]; payoutsCents: number;
};

const DAY = 86_400_000;
export const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
export function dayList(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** "[\"2026-11-23 09:00:00+00\",\"2026-11-25 09:00:00+00\")" → [inizio, fine] in ms */
function parseRange(r: string): [number, number] | null {
  const m = r.match(/^[[(]"?([^",]*)"?,"?([^",)\]]*)"?[)\]]$/);
  if (!m) return null;
  // Postgres scrive "2026-11-23 09:00:00+00": per JavaScript serve "2026-11-23T09:00:00+00:00"
  const iso = (x: string) => x.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const a = Date.parse(iso(m[1])), b = Date.parse(iso(m[2]));
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}
/** giorni (Europe/Rome) toccati da un intervallo */
function touchedDays(a: number, b: number, days: string[]) {
  const first = isoDay(new Date(a)), last = isoDay(new Date(b - 1));
  return days.filter((d) => d >= first && d <= last);
}

type UnitRes = { unit: string; kind: string; start: number; end: number; bookingId: string | null };

function buildDays(units: { id: string; off: boolean }[], res: UnitRes[], days: string[]) {
  const out: FleetVehicle["days"] = {};
  for (const d of days) {
    let free = 0, booked = 0, pending = 0, off = 0; const ids = new Set<string>();
    for (const u of units) {
      const hits = res.filter((r) => r.unit === u.id && touchedDays(r.start, r.end, [d]).length);
      if (u.off || hits.some((h) => h.kind === "block" || h.kind === "maintenance")) { off++; continue; }
      const b = hits.find((h) => h.kind === "booking" || h.kind === "external");
      const h = hits.find((x) => x.kind === "hold");
      if (b) { booked++; if (b.bookingId) ids.add(b.bookingId); } else if (h) { pending++; if (h.bookingId) ids.add(h.bookingId); } else free++;
    }
    const total = units.length || 1;
    const state: DayState = free === total ? "free" : off === total ? "off" : free > 0 ? "partial"
      : booked > 0 ? "booked" : pending > 0 ? "pending" : "off";
    out[d] = { state: units.length ? state : "off", free, bookingIds: [...ids] };
  }
  return out;
}

export async function loadFleet(orgId: string, orgName: string, from: string, to: string): Promise<FleetData> {
  const db = await userDb();
  const today = isoDay(new Date());
  const days = dayList(from, to);
  const [{ data: locs }, { data: listings }, { data: units }, { data: bks }, { data: payouts }] = await Promise.all([
    db.from("locations").select("id, name, city").eq("organization_id", orgId).order("name"),
    db.from("listings").select("id, title, status, quantity_mode, price_from_cents, location_id, categories(name_it, slug), makes(name), models(name), listing_units(vehicle_unit_id)")
      .eq("organization_id", orgId),
    db.from("vehicle_units").select("id, operational_status").eq("organization_id", orgId),
    db.from("bookings").select("id, code, status, listing_id, location_id, pickup_at, return_at, total_cents, provider_net_cents, driver, payment_required, payment_ready")
      .eq("organization_id", orgId).in("status", ["requested", "accepted", "confirmed", "picked_up", "completed"])
      .lte("pickup_at", `${to}T23:59:59Z`).gte("return_at", `${from}T00:00:00Z`),
    db.from("payouts").select("amount_cents, status").eq("organization_id", orgId).in("status", ["pending_pickup", "scheduled"]),
  ]);
  const unitIds = (units ?? []).map((u) => u.id);
  const [{ data: res }, { data: media }, { data: man }] = await Promise.all([
    unitIds.length
      ? db.from("unit_reservations").select("id, vehicle_unit_id, kind, booking_id, period, expires_at").in("vehicle_unit_id", unitIds).eq("active", true)
      : Promise.resolve({ data: [] as { id: string; vehicle_unit_id: string; kind: string; booking_id: string | null; period: string; expires_at: string | null }[] }),
    db.from("listing_media").select("listing_id, storage_path, sort").in("listing_id", (listings ?? []).map((l) => l.id)).order("sort"),
    // prenotazioni manuali (tabella 0035: se manca nel database, semplicemente nessuna)
    db.from("manual_bookings").select("id, code, listing_id, reservation_id, customer_name, customer_contact, pickup_at, return_at, price_cents, note")
      .eq("organization_id", orgId).eq("status", "active").lte("pickup_at", `${to}T23:59:59Z`).gte("return_at", `${from}T00:00:00Z`),
  ]);
  const manualByRes = new Map((man ?? []).filter((m) => m.reservation_id).map((m) => [m.reservation_id as string, m.id as string]));
  const now = Date.now();
  const reservations: UnitRes[] = (res ?? []).flatMap((r) => {
    const p = parseRange(String(r.period));
    if (!p || (r.kind === "hold" && r.expires_at && Date.parse(r.expires_at) < now)) return [];
    return [{ unit: r.vehicle_unit_id, kind: r.kind, start: p[0], end: p[1], bookingId: r.booking_id ?? manualByRes.get(r.id) ?? null }];
  });
  const offUnit = new Map((units ?? []).map((u) => [u.id, u.operational_status !== "active"]));
  const cover = new Map<string, string>();
  for (const m of media ?? []) if (!cover.has(m.listing_id)) cover.set(m.listing_id, mediaUrl(m.storage_path));
  const locName = new Map((locs ?? []).map((l) => [l.id, `${l.name}`]));
  const one = <T,>(x: T | T[] | null) => (Array.isArray(x) ? x[0] : x) ?? null;

  const bookings: FleetBooking[] = (bks ?? [])
    .filter((b) => !(b.payment_required && !b.payment_ready))
    .map((b) => {
      const d = (b.driver ?? {}) as Record<string, string>;
      return {
        id: b.id, code: b.code, status: b.status, listingId: b.listing_id, locationId: b.location_id,
        pickupAt: b.pickup_at, returnAt: b.return_at, totalCents: b.total_cents, netCents: b.provider_net_cents,
        customer: [d.first_name, d.last_name].filter(Boolean).join(" ") || "Cliente",
      };
    });

  const listingLoc = new Map((listings ?? []).map((l) => [l.id, l.location_id as string]));
  for (const m of man ?? []) {
    bookings.push({
      id: m.id, code: m.code, status: "manual", listingId: m.listing_id, locationId: listingLoc.get(m.listing_id) ?? "",
      pickupAt: m.pickup_at, returnAt: m.return_at, totalCents: m.price_cents, netCents: m.price_cents, customer: m.customer_name,
      manual: { contact: m.customer_contact, note: m.note },
    });
  }

  const vehicles: FleetVehicle[] = (listings ?? []).map((l) => {
    const cat = one(l.categories as { name_it: string; slug: string } | { name_it: string; slug: string }[] | null);
    const lu = (l.listing_units ?? []) as { vehicle_unit_id: string }[];
    const us = lu.map((x) => ({ id: x.vehicle_unit_id, off: !!offUnit.get(x.vehicle_unit_id) }));
    const alerts: string[] = [];
    if (l.status === "changes_required") alerts.push("Modifiche richieste dalla revisione");
    if (!cover.has(l.id)) alerts.push("Senza foto");
    if (us.some((u) => u.off)) alerts.push("Mezzo in manutenzione");
    return {
      id: l.id, title: l.title, status: l.status, category: cat?.name_it ?? "—", categorySlug: cat?.slug ?? "",
      make: one(l.makes as unknown as { name: string } | null)?.name ?? "", model: one(l.models as unknown as { name: string } | null)?.name ?? "",
      locationId: l.location_id, locationName: locName.get(l.location_id) ?? "—", priceFromCents: l.price_from_cents,
      cover: cover.get(l.id) ?? null, quantityMode: l.quantity_mode as "single" | "pool", units: us.length,
      days: buildDays(us, reservations, days),
      upcoming: bookings.filter((b) => b.listingId === l.id && b.returnAt >= new Date().toISOString()).length,
      alerts,
    };
  });
  return {
    demo: false, orgName, from, to, today, locations: (locs ?? []).map((l) => ({ id: l.id, name: l.name, city: l.city })),
    vehicles, bookings: bookings.filter((b) => b.status !== "requested"), requests: bookings.filter((b) => b.status === "requested"),
    payoutsCents: (payouts ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0),
  };
}

/* ---------------- Dati di ESEMPIO (solo anteprima, mai salvati) ---------------- */
export function demoFleet(from: string, to: string): FleetData {
  const today = isoDay(new Date());
  const days = dayList(from, to);
  const locations = [
    { id: "pd", name: "Sede Padova", city: "Padova" }, { id: "vi", name: "Sede Vicenza", city: "Vicenza" },
    { id: "vr", name: "Sede Verona", city: "Verona" },
  ];
  const defs: [string, string, string, string, string, string, number, number][] = [
    // titolo, categoria, slug, marca, modello, sede, prezzo, unità
    ["Fiat 500 Hybrid", "Auto", "auto", "Fiat", "500", "pd", 4500, 1], ["Audi A4 Avant", "Auto", "auto", "Audi", "A4", "pd", 8900, 1],
    ["VW California", "Camper", "camper", "Volkswagen", "California", "vi", 14500, 1], ["E-Bike Trekking", "Bici", "bici", "Cube", "Kathmandu", "vr", 3500, 6],
    ["Vespa Primavera 125", "Scooter", "scooter", "Piaggio", "Vespa", "vr", 3900, 1], ["BMW R 1250 GS", "Moto", "moto", "BMW", "R 1250 GS", "vi", 12900, 1],
    ["Ducato Furgone L2H2", "Furgoni", "furgoni", "Fiat", "Ducato", "pd", 7900, 1], ["Gommone 5 m", "Barche", "barche", "Joker Boat", "Clubman", "vr", 16000, 1],
  ];
  const names = ["Marco Rossi", "Giulia Bianchi", "Luca Ferrari", "Sara Colombo", "Andrea Ricci", "Elena Marino", "Paolo Greco"];
  const bookings: FleetBooking[] = [];
  const seed = (n: number) => { const x = Math.sin(n) * 10000; return x - Math.floor(x); };
  const vehicles: FleetVehicle[] = defs.map((d, i) => {
    const id = `demo-${i}`;
    const map: FleetVehicle["days"] = {};
    for (const day of days) map[day] = { state: "free", free: d[7], bookingIds: [] };
    // 2-4 prenotazioni sparse per mezzo
    let cursor = -3 + Math.floor(seed(i + 1) * 4);
    for (let k = 0; k < 4; k++) {
      const len = 1 + Math.floor(seed(i * 7 + k) * 4);
      const startIdx = days.indexOf(today) + cursor;
      cursor += len + 4 + Math.floor(seed(i * 3 + k) * 7);
      if (startIdx < 0 || startIdx >= days.length) continue;
      const bid = `demo-b-${i}-${k}`;
      const start = days[startIdx], end = days[Math.min(days.length - 1, startIdx + len)];
      const status = start > today && i % 3 === 0 && k >= 1 && k <= 2 ? "requested" : start <= today && end >= today ? "picked_up" : start < today ? "completed" : "confirmed";
      const price = d[6] * len;
      bookings.push({ id: bid, code: `KR-${(4821 + i * 13 + k).toString(36).toUpperCase()}`, status, listingId: id, locationId: d[5],
        pickupAt: `${start}T09:00:00Z`, returnAt: `${end}T17:00:00Z`, totalCents: price, netCents: Math.round(price * 0.95),
        customer: names[(i + k) % names.length] });
      for (let j = startIdx; j <= Math.min(days.length - 1, startIdx + len); j++) {
        const pool = d[7] > 1;
        const free = pool ? Math.max(0, d[7] - 2 - (k % 2)) : 0;
        map[days[j]] = { state: status === "requested" ? "pending" : pool ? (free ? "partial" : "booked") : "booked", free, bookingIds: [bid] };
      }
    }
    if (i === 5) { const s = days.indexOf(today) + 9; for (let j = s; j < s + 3 && j < days.length; j++) if (j >= 0) map[days[j]] = { state: "off", free: 0, bookingIds: [] }; }
    const alerts = i === 5 ? ["Tagliando programmato"] : i === 7 ? ["Senza foto"] : [];
    return {
      id, title: d[0], status: i === 6 ? "pending_review" : "published", category: d[1], categorySlug: d[2], make: d[3], model: d[4],
      locationId: d[5], locationName: locations.find((l) => l.id === d[5])!.name, priceFromCents: d[6], cover: null,
      quantityMode: d[7] > 1 ? "pool" : "single", units: d[7], days: map,
      upcoming: bookings.filter((b) => b.listingId === id && b.returnAt >= `${today}T00:00:00Z`).length, alerts,
    };
  });
  return {
    demo: true, orgName: "Noleggio Esempio Srl", from, to, today, locations, vehicles,
    bookings: bookings.filter((b) => b.status !== "requested"), requests: bookings.filter((b) => b.status === "requested"),
    payoutsCents: bookings.filter((b) => b.status === "confirmed").reduce((s, b) => s + b.netCents, 0),
  };
}

/** Filtro per sede (vale per KPI, liste e calendari). */
export function bySede(f: FleetData, sede: string | undefined): FleetData {
  if (!sede || sede === "tutte") return f;
  const ids = new Set(f.vehicles.filter((v) => v.locationId === sede).map((v) => v.id));
  return {
    ...f, vehicles: f.vehicles.filter((v) => ids.has(v.id)),
    bookings: f.bookings.filter((b) => ids.has(b.listingId)), requests: f.requests.filter((b) => ids.has(b.listingId)),
  };
}

/** Mese "YYYY-MM" → primo e ultimo giorno */
export function monthRange(mese?: string) {
  const m = mese && /^\d{4}-\d{2}$/.test(mese) ? mese : isoDay(new Date()).slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { mese: m, from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
}
export function shiftMonth(mese: string, n: number) {
  const [y, m] = mese.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
