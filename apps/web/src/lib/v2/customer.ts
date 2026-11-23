import "server-only";
import { getUser, getMemberships } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { covers } from "@/lib/data";
import { CATEGORIES } from "@/lib/catalog";

/**
 * ANTEPRIMA esperienza cliente: dati veri dell'utente collegato (sola lettura),
 * oppure dati di esempio con ?demo=1 o senza accesso. Nessuna scrittura.
 */
export type Bucket = "attivi" | "attesa" | "futuri" | "completati" | "cancellati";
export type Rental = {
  id: string; code: string; status: string; pickupAt: string; returnAt: string; totalCents: number;
  title: string; category: string; city: string; province: string; cover: string | null;
  dueAt: string | null; bucket: Bucket; forBusiness: boolean;
};
export type Thread = { id: string; title: string; other: string; last: string; at: string | null; unread: boolean; cover: string | null };
export type Business = { name: string; vat: string; sdi: string; pec: string; email: string; street: string; city: string; province: string; cap: string };
export type CustomerData = {
  demo: boolean; loggedIn: boolean; first: string; last: string; email: string; phone: string;
  isProvider: boolean; business: Business | null; context: "personale" | "azienda";
  rentals: Rental[]; threads: Thread[];
};

const catName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

export function bucketOf(status: string, pickupAt: string, returnAt: string, now = Date.now()): Bucket {
  if (["cancelled", "declined", "expired"].includes(status)) return "cancellati";
  if (["requested", "accepted"].includes(status)) return "attesa";
  if (status === "completed" || Date.parse(returnAt) < now) return "completati";
  if (status === "picked_up" || Date.parse(pickupAt) <= now) return "attivi";
  return "futuri";
}

export async function loadCustomer(sp: Record<string, string | string[] | undefined>): Promise<CustomerData> {
  const wantDemo = sp.demo === "1";
  const user = wantDemo ? null : await getUser();
  const ctx = sp.contesto === "azienda" ? "azienda" : "personale";
  if (!user) return demoCustomer(ctx, !wantDemo);
  const db = await userDb();
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const [{ data: profile }, memberships, { data: rows }, { data: convs }] = await Promise.all([
    db.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    getMemberships(),
    db.rpc("my_bookings", {}),
    db.rpc("my_conversations", {}),
  ]);
  const bookings = (rows ?? []) as { id: string; code: string; status: string; pickup_at: string; return_at: string; total_cents: number;
    provider_response_due_at: string | null; listing_id: string; listing_title: string; category_slug: string; city: string; province: string }[];
  const threads = ((convs ?? []) as { id: string; listing_id: string; listing_title: string; my_side: string; other_label: string; last_message_at: string | null; last_message: string | null }[])
    .filter((c) => c.my_side === "customer");
  const cov = await covers([...new Set([...bookings.map((b) => b.listing_id), ...threads.map((t) => t.listing_id)])]);
  const business = meta.company_name ? {
    name: meta.company_name, vat: meta.vat_number ?? "", sdi: "", pec: "", email: user.email ?? "", street: "", city: "", province: "", cap: "",
  } : null;
  return {
    demo: false, loggedIn: true,
    first: profile?.first_name ?? meta.first_name ?? "", last: profile?.last_name ?? meta.last_name ?? "", email: user.email ?? "", phone: profile?.phone ?? "",
    isProvider: memberships.length > 0, business, context: business ? ctx : "personale",
    rentals: bookings.map((b) => ({
      id: b.id, code: b.code, status: b.status, pickupAt: b.pickup_at, returnAt: b.return_at, totalCents: b.total_cents,
      title: b.listing_title, category: catName(b.category_slug), city: b.city, province: b.province, cover: cov.get(b.listing_id)?.url ?? null,
      dueAt: b.provider_response_due_at, bucket: bucketOf(b.status, b.pickup_at, b.return_at), forBusiness: false,
    })),
    threads: threads.map((t) => ({ id: t.id, title: t.listing_title, other: t.other_label, last: t.last_message ?? "", at: t.last_message_at, unread: false, cover: cov.get(t.listing_id)?.url ?? null })),
  };
}

function demoCustomer(ctx: "personale" | "azienda", notLogged: boolean): CustomerData {
  const h = 3_600_000, d = 24 * h, now = Date.now();
  const at = (ms: number, hour?: number) => { const x = new Date(now + ms); if (hour !== undefined) x.setHours(hour, 0, 0, 0); return x.toISOString(); };
  const r = (id: string, status: string, title: string, cat: string, city: string, prov: string, p: string, ret: string, cents: number, biz = false, due: string | null = null): Rental =>
    ({ id, code: `KR-${id.toUpperCase()}`, status, pickupAt: p, returnAt: ret, totalCents: cents, title, category: cat, city, province: prov, cover: null,
      dueAt: due, bucket: bucketOf(status, p, ret), forBusiness: biz });
  return {
    demo: true, loggedIn: !notLogged, first: "Filippo", last: "Antonello", email: "filippo@esempio.it", phone: "+39 333 1234567", isProvider: true,
    business: { name: "ISATEX S.r.l.", vat: "IT00038630281", sdi: "M5UXCR1", pec: "isatex@pec.it", email: "amministrazione@isatex.it",
      street: "Via Vittorio Veneto, 95", city: "Tombolo", province: "PD", cap: "35019" },
    context: ctx,
    rentals: [
      r("a1", "picked_up", "Fiat 500 Hybrid", "Auto", "Padova", "PD", at(-d, 9), at(3 * h), 9000),
      r("p1", "requested", "Audi A4 Avant", "Auto", "Vicenza", "VI", at(4 * d, 10), at(7 * d, 10), 26700, false, at(20 * h)),
      r("f1", "confirmed", "E-Bike Trekking", "Bici", "Garda", "VR", at(9 * d, 9), at(10 * d, 18), 7000),
      r("f2", "confirmed", "Ducato Furgone L2H2", "Furgoni", "Padova", "PD", at(3 * d, 8), at(5 * d, 18), 23700, true),
      r("a2", "picked_up", "Ducato Furgone L2H2", "Furgoni", "Padova", "PD", at(-2 * d, 8), at(d, 18), 31600, true),
      r("c1", "completed", "VW California", "Camper", "Verona", "VR", at(-30 * d, 10), at(-25 * d, 10), 72500),
      r("c2", "completed", "Ducato Furgone L2H2", "Furgoni", "Padova", "PD", at(-12 * d, 8), at(-11 * d, 18), 15800, true),
      r("x1", "cancelled", "Vespa Primavera 125", "Scooter", "Verona", "VR", at(-5 * d, 10), at(-4 * d, 10), 3900),
    ],
    threads: [
      { id: "t1", title: "Fiat 500 Hybrid", other: "Rent Padova Srl", last: "Perfetto, la aspettiamo alle 18 per la riconsegna.", at: at(-2 * h), unread: true, cover: null },
      { id: "t2", title: "Audi A4 Avant", other: "Noleggiatore verificato · Vicenza", last: "Il seggiolino per bambini è disponibile?", at: at(-26 * h), unread: false, cover: null },
      { id: "t3", title: "VW California", other: "Camper Verona", last: "Grazie a lei, buon viaggio!", at: at(-25 * d), unread: false, cover: null },
    ],
  };
}

/** Le prenotazioni del contesto scelto (personale / azienda). */
export const inContext = (c: CustomerData) => c.rentals.filter((r) => (c.context === "azienda") === r.forBusiness);
