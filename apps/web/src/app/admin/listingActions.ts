"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serviceDb } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { dbMessage } from "@/lib/status";
import { deliveryOf, listingPayload } from "@/lib/listingForm";
import { ensureCatalogEntry } from "@/lib/catalogSync";

/*
 * Il team KeyRent gestisce gli annunci di un noleggiatore su sua richiesta.
 * Solo staff admin/operations; ogni scrittura è lato server (service role) e finisce nel registro attività.
 */
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cents = (f: FormData, k: string) => {
  const v = Number(str(f, k).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
};
const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}errore=${encodeURIComponent(msg)}`);

async function providerOrg(orgId: string) {
  const { data } = await serviceDb().from("organizations").select("id, kind").eq("id", orgId).maybeSingle();
  if (!data || (data.kind && data.kind !== "provider")) fail("/admin/anagrafiche", "Attività di noleggio non trovata.");
}

async function listingOf(listingId: string) {
  const { data } = await serviceDb().from("listings").select("id, organization_id, status, title, description").eq("id", listingId).maybeSingle();
  if (!data) fail("/admin/anagrafiche", "Annuncio non trovato.");
  return data!;
}

const audit = (actor: string, listing: string, action: string, payload: Record<string, unknown> = {}) =>
  serviceDb().from("audit_log").insert({ actor_id: actor, actor_type: "staff", entity: "listing", entity_id: listing, action, diff: payload });

/** Nuovo annuncio preparato dal team per un noleggiatore (nasce come bozza dell'attività). */
export async function createListingForOrg(f: FormData) {
  const { user } = await requireStaff();
  const orgId = str(f, "org_id");
  await providerOrg(orgId);
  const payload = await listingPayload(f, orgId);
  if (payload.make && payload.model) await ensureCatalogEntry(payload.category, payload.make, payload.model).catch(() => undefined);
  const db = serviceDb();
  const { data, error } = await db.rpc("create_listing_draft", { p: payload });
  if (error) fail(`/admin/anagrafiche/${orgId}/nuovo`, dbMessage(error.message));
  const delivery = deliveryOf(f);
  if (delivery.delivery_enabled) await db.from("rental_terms").update(delivery).eq("listing_id", String(data));
  await audit(user.id, String(data), "staff:create_for_provider", { organization_id: orgId });
  redirect(`/admin/anagrafiche/${orgId}/annunci/${data}?ok=creato`);
}

/** Titolo e descrizione: il team li applica subito (è lui a revisionare). */
export async function staffUpdateDetails(f: FormData) {
  const { user } = await requireStaff();
  const l = await listingOf(str(f, "id"));
  const back = `/admin/anagrafiche/${l.organization_id}/annunci/${l.id}`;
  const title = str(f, "title"), description = str(f, "description");
  if (!title) fail(back, "Il titolo è obbligatorio.");
  if (title === l.title && description === (l.description ?? "")) redirect(back);
  const { error } = await serviceDb().from("listings").update({ title, description }).eq("id", l.id);
  if (error) fail(back, dbMessage(error.message));
  await audit(user.id, l.id, "staff:update_details", { title });
  revalidatePath(back);
  redirect(`${back}?ok=salvato`);
}

export async function staffUpdatePrices(f: FormData) {
  const { user } = await requireStaff();
  const l = await listingOf(str(f, "id"));
  const back = `/admin/anagrafiche/${l.organization_id}/annunci/${l.id}`;
  const db = serviceDb();
  for (const unit of ["hour", "half_day", "day", "week"]) {
    const price = cents(f, `price_${unit}`);
    await db.from("pricing_rules").delete().eq("listing_id", l.id).eq("unit", unit).is("valid_from", null);
    if (price > 0) {
      const { error } = await db.from("pricing_rules").insert({ listing_id: l.id, unit, price_cents: price });
      if (error) fail(back, dbMessage(error.message));
    }
  }
  await db.rpc("svc_refresh_price_from", { p_listing: l.id });
  await audit(user.id, l.id, "staff:update_prices");
  revalidatePath(back);
  redirect(`${back}?ok=prezzi`);
}

export async function staffUpdateDelivery(f: FormData) {
  const { user } = await requireStaff();
  const l = await listingOf(str(f, "id"));
  const back = `/admin/anagrafiche/${l.organization_id}/annunci/${l.id}`;
  const d = deliveryOf(f);
  if (d.delivery_enabled && !str(f, "delivery_radius_km")) fail(back, "Indica il raggio massimo di consegna in km.");
  const { error } = await serviceDb().from("rental_terms").update(d).eq("listing_id", l.id);
  if (error) fail(back, dbMessage(error.message));
  await audit(user.id, l.id, "staff:update_delivery", d);
  revalidatePath(back);
  redirect(`${back}?ok=salvato`);
}

/** Bozza preparata dal team → in revisione (poi si approva da "Revisione annunci"). */
export async function staffSubmitListing(f: FormData) {
  const { user } = await requireStaff();
  const l = await listingOf(str(f, "id"));
  const back = `/admin/anagrafiche/${l.organization_id}/annunci/${l.id}`;
  const { error } = await serviceDb().rpc("svc_listing_transition", { p_listing: l.id, p_to: "pending_review", p_actor: user.id });
  if (error) fail(back, dbMessage(error.message));
  revalidatePath("/admin/revisione");
  redirect(`/admin/revisione/${l.id}`);
}
