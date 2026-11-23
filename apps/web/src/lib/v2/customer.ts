import "server-only";
import { getUser, getMemberships, getBookingContext, type BusinessProfile } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { covers } from "@/lib/data";
import { CATEGORIES } from "@/lib/catalog";

/** Esperienza cliente: dati dell'utente collegato (sola lettura, RLS) nel contesto scelto (personale o azienda). */
export type Bucket = "attivi" | "attesa" | "futuri" | "completati" | "cancellati";
export type Rental = {
  id: string; code: string; status: string; pickupAt: string; returnAt: string; totalCents: number;
  title: string; category: string; city: string; province: string; cover: string | null;
  dueAt: string | null; bucket: Bucket; forBusiness: boolean; billTo: string | null;
};
export type Thread = { id: string; title: string; other: string; last: string; at: string | null; unread: boolean; cover: string | null };
export type Business = { name: string; vat: string; sdi: string; pec: string; email: string; street: string; city: string; province: string; cap: string };
export type CustomerData = {
  demo: boolean; loggedIn: boolean; first: string; last: string; email: string; phone: string;
  isProvider: boolean; business: Business | null; context: "personale" | "azienda";
  businessId: string | null; orgs: BusinessProfile[];
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

export async function loadCustomer(): Promise<CustomerData | null> {
  const user = await getUser();
  if (!user) return null;
  const db = await userDb();
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const [{ data: profile }, memberships, ctx, { data: rows }, { data: convs }, billing] = await Promise.all([
    db.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    getMemberships(),
    getBookingContext(),
    db.rpc("my_bookings", {}),
    db.rpc("my_conversations", {}),
    db.from("bookings").select("id, billing_organization_id").eq("customer_id", user.id),
  ]);
  const billTo = new Map(((billing.error ? [] : billing.data) ?? []).map((b) => [b.id as string, (b.billing_organization_id ?? null) as string | null]));
  const bookings = (rows ?? []) as { id: string; code: string; status: string; pickup_at: string; return_at: string; total_cents: number;
    provider_response_due_at: string | null; listing_id: string; listing_title: string; category_slug: string; city: string; province: string }[];
  const threads = ((convs ?? []) as { id: string; listing_id: string; listing_title: string; my_side: string; other_label: string; last_message_at: string | null; last_message: string | null }[])
    .filter((c) => c.my_side === "customer");
  const cov = await covers([...new Set([...bookings.map((b) => b.listing_id), ...threads.map((t) => t.listing_id)])]);
  const cur = ctx.current;
  return {
    demo: false, loggedIn: true,
    first: profile?.first_name ?? meta.first_name ?? "", last: profile?.last_name ?? meta.last_name ?? "", email: user.email ?? "", phone: profile?.phone ?? "",
    isProvider: memberships.length > 0,
    business: cur ? { name: cur.name, vat: "", sdi: "", pec: "", email: "", street: "", city: "", province: "", cap: "" } : null,
    businessId: cur?.id ?? null, orgs: ctx.orgs,
    context: cur ? "azienda" : "personale",
    rentals: bookings.map((b) => ({
      id: b.id, code: b.code, status: b.status, pickupAt: b.pickup_at, returnAt: b.return_at, totalCents: b.total_cents,
      title: b.listing_title, category: catName(b.category_slug), city: b.city, province: b.province, cover: cov.get(b.listing_id)?.url ?? null,
      dueAt: b.provider_response_due_at, bucket: bucketOf(b.status, b.pickup_at, b.return_at),
      forBusiness: !!billTo.get(b.id), billTo: billTo.get(b.id) ?? null,
    })),
    threads: threads.map((t) => ({ id: t.id, title: t.listing_title, other: t.other_label, last: t.last_message ?? "", at: t.last_message_at, unread: false, cover: cov.get(t.listing_id)?.url ?? null })),
  };
}

/** Le prenotazioni del contesto scelto (personale / azienda). */
export const inContext = (c: CustomerData) => c.rentals.filter((r) => (c.businessId ? r.billTo === c.businessId : !r.billTo));
