"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { requireProvider, canEdit, ORG_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import { dbMessage } from "@/lib/status";
import { findPlace } from "@/lib/places";
import { generateImage, vehiclePrompt } from "@/lib/aiImage";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cents = (f: FormData, k: string) => {
  const v = Number(str(f, k).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
};
const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}errore=${encodeURIComponent(msg)}`);

async function editor() {
  const ctx = await requireProvider();
  if (!ctx.membership) redirect("/pro");
  if (!canEdit(ctx.membership)) fail("/pro", "Il tuo ruolo non permette modifiche.");
  return ctx as typeof ctx & { membership: NonNullable<typeof ctx.membership> };
}

// ---------- Attività ----------
export async function createOrganization(f: FormData) {
  await requireProvider();
  const db = await userDb();
  const { data: orgId, error } = await db.rpc("create_organization", {
    p_legal_name: str(f, "legal_name"), p_vat: str(f, "vat_number").toUpperCase(), p_trade_name: str(f, "trade_name") || null,
  });
  if (error) fail("/pro", dbMessage(error.message));
  await db.from("organizations").update({
    business_email: str(f, "business_email") || null, business_phone: str(f, "business_phone") || null,
    pec: str(f, "pec") || null, sdi_code: str(f, "sdi_code") || null,
    legal_address: { street: str(f, "street"), city: str(f, "city"), postal_code: str(f, "postal_code"), province: str(f, "province").toUpperCase() },
  }).eq("id", orgId as string);
  revalidatePath("/", "layout");
  redirect("/pro/sedi?benvenuto=1");
}

export async function updateOrganization(f: FormData) {
  const { membership } = await editor();
  if (membership.role !== "owner") fail("/pro/attivita", "Solo il titolare può modificare l'anagrafica.");
  const db = await userDb();
  const { error } = await db.from("organizations").update({
    trade_name: str(f, "trade_name") || null, business_email: str(f, "business_email") || null,
    business_phone: str(f, "business_phone") || null, pec: str(f, "pec") || null, sdi_code: str(f, "sdi_code") || null,
    legal_address: { street: str(f, "street"), city: str(f, "city"), postal_code: str(f, "postal_code"), province: str(f, "province").toUpperCase() },
  }).eq("id", membership.organization_id);
  if (error) fail("/pro/attivita", dbMessage(error.message));
  redirect("/pro/attivita?ok=1");
}

// ---------- Sedi ----------
export async function createLocation(f: FormData) {
  const { membership } = await editor();
  const place = findPlace(str(f, "city"));
  if (!place) fail("/pro/sedi", "Scegli la città dall'elenco.");
  const db = await userDb();
  const { error } = await db.from("locations").insert({
    organization_id: membership.organization_id, name: str(f, "name") || `Sede ${place!.name}`,
    address_line: str(f, "address_line"), postal_code: str(f, "postal_code"), city: place!.name, province: place!.province,
    latitude: place!.lat, longitude: place!.lng, phone: str(f, "phone") || null,
    pickup_instructions: str(f, "pickup_instructions") || null,
  });
  if (error) fail("/pro/sedi", dbMessage(error.message));
  revalidatePath("/pro/sedi");
  redirect("/pro/sedi?ok=1");
}

export async function toggleLocation(f: FormData) {
  await editor();
  const db = await userDb();
  await db.from("locations").update({ active: str(f, "active") === "true" }).eq("id", str(f, "id"));
  revalidatePath("/pro/sedi");
  redirect("/pro/sedi");
}

// ---------- Mezzi ----------
export async function createListing(f: FormData) {
  const { membership } = await editor();
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("attr_") || typeof v !== "string" || v === "") continue;
    const key = k.slice(5);
    attributes[key] = v === "true" ? true : v === "false" ? false : /^\d+([.,]\d+)?$/.test(v) ? Number(v.replace(",", ".")) : v;
  }
  if (typeof attributes.power_cv === "number" && attributes.power_kw === undefined) {
    attributes.power_kw = Math.round((attributes.power_cv as number) * 0.73549875);
  }
  delete attributes.power_cv;
  const payload = {
    organization_id: membership.organization_id,
    location_id: str(f, "location_id"),
    category: str(f, "category"), subcategory: str(f, "subcategory") || null,
    make: str(f, "make") && str(f, "make") !== "__altra" ? str(f, "make") : null, model: str(f, "model") || null,
    custom_make: str(f, "custom_make") || null, custom_model: str(f, "custom_model") || null,
    title: str(f, "title"), description: str(f, "description"),
    attributes, quantity: Math.max(1, Number(str(f, "quantity")) || 1), plate: str(f, "plate"), year: str(f, "year"),
    terms: {
      deposit_cents: cents(f, "deposit"), min_driver_age: str(f, "min_driver_age"), min_license_years: str(f, "min_license_years"),
      required_license: str(f, "required_license"), included_km_per_day: str(f, "included_km_per_day"),
      extra_km_cents: cents(f, "extra_km") || "", insurance_excess_cents: cents(f, "insurance_excess") || "",
      fuel_policy: str(f, "fuel_policy"), buffer_minutes: str(f, "buffer_minutes"),
      min_duration_minutes: str(f, "min_duration_minutes"), notes: str(f, "terms_notes"),
    },
    prices: ["hour", "half_day", "day", "week"].map((unit) => ({ unit, price_cents: cents(f, `price_${unit}`) })),
  };
  const db = await userDb();
  const { data, error } = await db.rpc("create_listing_draft", { p: payload });
  if (error) fail("/pro/mezzi/nuovo", dbMessage(error.message));
  redirect(`/pro/mezzi/${data}?nuovo=1`);
}

export async function updateListingDetails(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const back = `/pro/mezzi/${id}`;
  const db = await userDb();
  const { data: l } = await db.from("listings").select("status, title, description").eq("id", id).maybeSingle();
  if (!l) fail("/pro/mezzi", "Annuncio non trovato.");
  const title = str(f, "title"), description = str(f, "description");
  // dirty-state lato server: se non è cambiato nulla, nessuna scrittura e nessun cambio di stato
  if (title === l!.title && description === (l!.description ?? "")) redirect(back);
  if (["draft", "changes_required"].includes(l!.status)) {
    const { error } = await db.from("listings").update({ title, description }).eq("id", id);
    if (error) fail(back, dbMessage(error.message));
    redirect(`${back}?ok=salvato`);
  }
  const { error } = await serviceDb().rpc("svc_propose_listing_changes", { p_listing: id, p_actor: user.id, p_changes: { title, description } });
  if (error) fail(back, dbMessage(error.message));
  redirect(`${back}?ok=revisione`);
}

export async function updatePrices(f: FormData) {
  await editor();
  const id = str(f, "id");
  const db = await userDb();
  const { error } = await db.rpc("set_listing_prices", {
    p_listing: id, p_prices: ["hour", "half_day", "day", "week"].map((unit) => ({ unit, price_cents: cents(f, `price_${unit}`) })),
  });
  if (error) fail(`/pro/mezzi/${id}`, dbMessage(error.message));
  await serviceDb().rpc("svc_refresh_price_from", { p_listing: id });
  redirect(`/pro/mezzi/${id}?ok=prezzi`);
}

export async function transitionListing(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const to = str(f, "to");
  if (!["pending_review", "unpublished", "published"].includes(to)) fail(`/pro/mezzi/${id}`, "Azione non valida.");
  // il controllo di appartenenza lo fa la funzione nel DB (attore = utente della sessione)
  const { error } = await serviceDb().rpc("svc_listing_transition", { p_listing: id, p_to: to, p_actor: user.id });
  if (error) fail(`/pro/mezzi/${id}`, dbMessage(error.message));
  revalidatePath("/pro/mezzi");
  redirect(`/pro/mezzi/${id}?ok=${to}`);
}

// ---------- Foto ----------
async function assertListingAccess(listingId: string) {
  await editor();
  const db = await userDb();
  const { data } = await db.from("listings").select("id").eq("id", listingId).maybeSingle();  // RLS: solo i propri
  if (!data) throw new Error("FORBIDDEN");
}

async function ensureBucket() {
  const admin = serviceDb();
  const { error } = await admin.storage.getBucket("listings");
  if (error) await admin.storage.createBucket("listings", { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
}

export async function createUploadUrl(listingId: string, fileName: string) {
  await assertListingAccess(listingId);
  await ensureBucket();
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `${listingId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await serviceDb().storage.from("listings").createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}

export async function registerMedia(listingId: string, path: string, indicative = false) {
  await assertListingAccess(listingId);
  if (!path.startsWith(`${listingId}/`)) throw new Error("FORBIDDEN");
  const db = await userDb();
  const { count } = await db.from("listing_media").select("id", { count: "exact", head: true }).eq("listing_id", listingId);
  const { error } = await db.from("listing_media").insert({ listing_id: listingId, storage_path: path, sort: count ?? 0, ...(indicative ? { is_indicative: true } : {}) });
  if (error) throw new Error(dbMessage(error.message));
  revalidatePath(`/pro/mezzi/${listingId}`);
}

export async function deleteMedia(f: FormData) {
  const listingId = str(f, "listing_id");
  await assertListingAccess(listingId);
  const db = await userDb();
  const { data: m } = await db.from("listing_media").select("storage_path").eq("id", str(f, "id")).eq("listing_id", listingId).maybeSingle();
  if (m) {
    await db.from("listing_media").delete().eq("id", str(f, "id"));
    await serviceDb().storage.from("listings").remove([m.storage_path]);
  }
  redirect(`/pro/mezzi/${listingId}`);
}

// ---------- Richieste di prenotazione ----------
export async function respondBooking(f: FormData) {
  const ctx = await requireProvider("/pro/richieste");
  if (!ctx.membership) redirect("/pro");
  const id = str(f, "id");
  const decision = str(f, "decision");
  const { bookingError } = await import("@/lib/bookings");
  const { error } = decision === "accept"
    ? await serviceDb().rpc("svc_accept_booking", { p_booking: id, p_actor: ctx.user.id })
    : await serviceDb().rpc("svc_decline_booking", { p_booking: id, p_actor: ctx.user.id, p_reason: str(f, "reason") || null });
  if (error) fail("/pro/richieste", bookingError(error.message));
  revalidatePath("/pro/richieste");
  redirect(`/pro/richieste?ok=${decision === "accept" ? "accettata" : "rifiutata"}`);
}

// ---------- Selettore attività ----------
export async function switchOrganization(f: FormData) {
  const { memberships } = await requireProvider();
  const id = str(f, "organization_id");
  if (memberships.some((m) => m.organization_id === id)) {
    (await cookies()).set(ORG_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/pro", "layout");
  redirect("/pro");
}

// ---------- Foto creata automaticamente con l'AI ----------
export async function generateListingPhoto(listingId: string, input: { color: string; year: string; setting: string }) {
  await assertListingAccess(listingId);
  await ensureBucket();
  const db = await userDb();
  const { data: l } = await db.from("listings")
    .select("id, title, categories(slug), makes(name), models(name), listing_units(vehicle_units(year, custom_make, custom_model))")
    .eq("id", listingId).maybeSingle();
  if (!l) throw new Error("FORBIDDEN");
  const { count } = await db.from("listing_media").select("id", { count: "exact", head: true }).eq("listing_id", listingId);
  if ((count ?? 0) >= 20) return { error: "Hai già 20 foto: eliminane qualcuna prima di crearne altre." };
  type Row = { title: string; categories: { slug: string } | null; makes: { name: string } | null; models: { name: string } | null;
    listing_units: { vehicle_units: { year: number | null; custom_make: string | null; custom_model: string | null } | null }[] };
  const r = l as unknown as Row;
  const vu = r.listing_units[0]?.vehicle_units;
  const vehicle = [r.makes?.name ?? vu?.custom_make, r.models?.name ?? vu?.custom_model].filter(Boolean).join(" ") || r.title;
  const year = /^\d{4}$/.test(input.year) ? input.year : vu?.year ?? null;
  const prompt = vehiclePrompt({ category: r.categories?.slug ?? "", vehicle, year, color: input.color.slice(0, 40), setting: input.setting });
  try {
    const img = await generateImage(prompt);
    const ext = img.type.includes("png") ? "png" : img.type.includes("webp") ? "webp" : "jpg";
    const path = `${listingId}/ai-${crypto.randomUUID()}.${ext}`;
    const { error: up } = await serviceDb().storage.from("listings").upload(path, img.bytes, { contentType: img.type });
    if (up) throw new Error(up.message);
    await registerMedia(listingId, path, true);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Il servizio che crea le immagini è occupato in questo momento. Riprova tra un minuto." };
  }
}
