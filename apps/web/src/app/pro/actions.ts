"use server";

import { sendEmailsSoon } from "@/lib/email";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { requireProvider, canEdit, ORG_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import { dbMessage } from "@/lib/status";
import { findPlace } from "@/lib/places";
import { PROVINCE } from "@/lib/province";
import { captureIntent } from "@/lib/stripe";
import { releaseHold } from "@/lib/payments";
import { generateImage, vehiclePrompt } from "@/lib/aiImage";
import { ensureCatalogEntry } from "@/lib/catalogSync";
import { contactsError, contactsIn, deliveryOf, listingPayload } from "@/lib/listingForm";
import { longTermOf } from "@/lib/longTerm";
import { demoAutoapproveSoon, isDemoUser } from "@/lib/demo";
import type { PreviewRow } from "@/lib/importSheet";

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
  await db.auth.updateUser({ data: { pending_org: null } });
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
/** Dati della sede dal modulo, con la posizione sulla mappa. */
async function locationFields(f: FormData, back: string) {
  const city = str(f, "city"), province = str(f, "province").toUpperCase(), address = str(f, "address_line"), cap = str(f, "postal_code");
  if (!city || !address || !cap || !PROVINCE[province]) fail(back, "Completa indirizzo, CAP, città e provincia.");
  // posizione: dal suggerimento scelto, altrimenti cerchiamo l'indirizzo, altrimenti il centro della città
  let lat = Number(str(f, "lat")), lng = Number(str(f, "lng"));
  if (!lat || !lng) {
    const g = await geocode(`${address}, ${cap} ${city} ${province}, Italia`) ?? await geocode(`${city} ${province}, Italia`);
    const p = g ? null : findPlace(city);
    lat = g?.lat ?? p?.lat ?? 0; lng = g?.lng ?? p?.lng ?? 0;
  }
  if (!lat || !lng) fail(back, "Non troviamo l'indirizzo sulla mappa: sceglilo dai suggerimenti mentre scrivi.");
  return {
    name: str(f, "name") || `Sede ${city}`, address_line: address, postal_code: cap, city, province,
    latitude: lat, longitude: lng, phone: str(f, "phone") || null, pickup_instructions: str(f, "pickup_instructions") || null,
  };
}

export async function createLocation(f: FormData) {
  const { membership } = await editor();
  const fields = await locationFields(f, "/pro/sedi");
  const db = await userDb();
  const { error } = await db.from("locations").insert({ organization_id: membership.organization_id, ...fields });
  if (error) fail("/pro/sedi", dbMessage(error.message));
  revalidatePath("/pro/sedi");
  redirect("/pro/sedi?ok=1");
}

export async function updateLocation(f: FormData) {
  const { membership } = await editor();
  const id = str(f, "id");
  const fields = await locationFields(f, `/pro/sedi/${id}`);
  const db = await userDb();
  const { error } = await db.from("locations").update(fields).eq("id", id).eq("organization_id", membership.organization_id);
  if (error) fail(`/pro/sedi/${id}`, dbMessage(error.message));
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

/** Elimina un annuncio mai inviato (bozza), con le sue foto. */
export async function deleteDraftListing(f: FormData) {
  const { membership } = await editor();
  const id = str(f, "id");
  const admin = serviceDb();
  const { data: l } = await admin.from("listings").select("id, status, organization_id").eq("id", id).maybeSingle();
  if (!l || l.organization_id !== membership.organization_id || l.status !== "draft") fail(`/pro/mezzi/${id}/modifica`, "Si possono eliminare solo le bozze.");
  const { count } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("listing_id", id);
  if ((count ?? 0) > 0) fail(`/pro/mezzi/${id}/modifica`, "Questo annuncio ha prenotazioni: non si può eliminare.");
  const { data: media } = await admin.from("listing_media").select("storage_path").eq("listing_id", id);
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean);
  if (paths.length) await admin.storage.from("listings").remove(paths);
  const { error } = await admin.from("listings").delete().eq("id", id);
  if (error) fail(`/pro/mezzi/${id}/modifica`, dbMessage(error.message));
  revalidatePath("/pro/mezzi");
  redirect("/pro/mezzi?ok=eliminato");
}

/** Posizione di un indirizzo italiano (Mapbox, lato server). */
async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=IT&limit=1&language=it&access_token=${token}`);
    if (!res.ok) return null;
    const d = (await res.json()) as { features?: { geometry: { coordinates: [number, number] } }[] };
    const c = d.features?.[0]?.geometry.coordinates;
    return c ? { lat: c[1], lng: c[0] } : null;
  } catch { return null; }
}

// ---------- Mezzi ----------
export async function createListing(f: FormData) {
  const { membership } = await editor();
  const lt = longTermOf(f);
  if (lt.error) fail("/pro/mezzi/nuovo", lt.error);
  const found = contactsIn(`${str(f, "title")} ${str(f, "description")}`);
  if (found) fail("/pro/mezzi/nuovo", contactsError(found));
  const payload = await listingPayload(f, membership.organization_id);
  const db = await userDb();
  // doppio invio dello stesso modulo: riapri la bozza appena creata invece di farne un'altra
  const { data: same } = await db.from("listings").select("id").eq("organization_id", membership.organization_id)
    .eq("title", payload.title).eq("status", "draft").gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString()).limit(1);
  if (same?.length) redirect(`/pro/mezzi/${same[0].id}/modifica?nuovo=1`);
  const { data, error } = await db.rpc("create_listing_draft", { p: payload });
  if (error) fail("/pro/mezzi/nuovo", dbMessage(error.message));
  // consegna a domicilio e lungo termine: sulla bozza si salvano direttamente
  const { error: tErr } = await db.from("rental_terms").update({ ...deliveryOf(f), ...lt.data }).eq("listing_id", String(data));
  if (tErr) console.error("condizioni nuova bozza", tErr.message);
  redirect(`/pro/mezzi/${data}/modifica?nuovo=1`);
}

/** Consegna a domicilio: bozza → salvata subito; annuncio online → passa dalla revisione del team. */
export async function updateDelivery(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const back = `/pro/mezzi/${id}/modifica`;
  const d = deliveryOf(f);
  if (d.delivery_enabled && !str(f, "delivery_radius_km")) fail(back, "Indica il raggio massimo di consegna in km.");
  const db = await userDb();
  const [{ data: l }, { data: t }] = await Promise.all([
    db.from("listings").select("status").eq("id", id).maybeSingle(),
    db.from("rental_terms").select("delivery_enabled, delivery_radius_km, delivery_fee_cents, delivery_per_km_cents").eq("listing_id", id).maybeSingle(),
  ]);
  if (!l) fail("/pro/mezzi", "Annuncio non trovato.");
  const same = t && t.delivery_enabled === d.delivery_enabled && (t.delivery_radius_km ?? null) === d.delivery_radius_km
    && t.delivery_fee_cents === d.delivery_fee_cents && t.delivery_per_km_cents === d.delivery_per_km_cents;
  if (same) redirect(back);
  if (["draft", "changes_required"].includes(l!.status)) {
    const { error } = await db.from("rental_terms").update(d).eq("listing_id", id);
    if (error) fail(back, dbMessage(error.message));
    redirect(`${back}?ok=salvato`);
  }
  const { error } = await serviceDb().rpc("svc_propose_listing_changes", { p_listing: id, p_actor: user.id, p_changes: { terms: d } });
  if (error) fail(back, error.message.includes("REVISION_ALREADY_PENDING") ? "C'è già una modifica in verifica: attendi la risposta del team prima di inviarne un'altra." : dbMessage(error.message));
  redirect(`${back}?ok=revisione`);
}

/** Breve / lungo termine: bozza → salvata subito; annuncio online → passa dalla revisione del team. */
export async function updateRentalModes(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const back = `/pro/mezzi/${id}/modifica`;
  const lt = longTermOf(f);
  if (lt.error) fail(back, lt.error);
  const db = await userDb();
  const { data: l } = await db.from("listings").select("status").eq("id", id).maybeSingle();
  if (!l) fail("/pro/mezzi", "Annuncio non trovato.");
  if (["draft", "changes_required"].includes(l!.status)) {
    const { error } = await db.from("rental_terms").update(lt.data).eq("listing_id", id);
    if (error) fail(back, dbMessage(error.message));
    redirect(`${back}?ok=salvato`);
  }
  const { error } = await serviceDb().rpc("svc_propose_listing_changes", { p_listing: id, p_actor: user.id, p_changes: { terms: lt.data } });
  if (error) fail(back, error.message.includes("REVISION_ALREADY_PENDING") ? "C'è già una modifica in verifica: attendi la risposta del team prima di inviarne un'altra." : dbMessage(error.message));
  redirect(`${back}?ok=revisione`);
}

export async function updateListingDetails(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const back = `/pro/mezzi/${id}/modifica`;
  const db = await userDb();
  const { data: l } = await db.from("listings").select("status, title, description").eq("id", id).maybeSingle();
  if (!l) fail("/pro/mezzi", "Annuncio non trovato.");
  const title = str(f, "title"), description = str(f, "description");
  const found = contactsIn(`${title} ${description}`);
  if (found) fail(back, contactsError(found));
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
  if (error) fail(`/pro/mezzi/${id}/modifica`, dbMessage(error.message));
  await serviceDb().rpc("svc_refresh_price_from", { p_listing: id });
  redirect(`/pro/mezzi/${id}/modifica?ok=prezzi`);
}

export async function transitionListing(f: FormData) {
  const { user } = await editor();
  const id = str(f, "id");
  const to = str(f, "to");
  if (!["pending_review", "unpublished", "published"].includes(to)) fail(`/pro/mezzi/${id}/modifica`, "Azione non valida.");
  // il controllo di appartenenza lo fa la funzione nel DB (attore = utente della sessione)
  const { error } = await serviceDb().rpc("svc_listing_transition", { p_listing: id, p_to: to, p_actor: user.id });
  if (error) fail(`/pro/mezzi/${id}/modifica`, dbMessage(error.message));
  // account di prova: approvazione automatica dopo 30 secondi
  const demo = to === "pending_review" && await isDemoUser(user.id);
  if (demo) demoAutoapproveSoon(31_000);
  revalidatePath("/pro/mezzi");
  redirect(`/pro/mezzi/${id}/modifica?ok=${demo ? "demo" : to}`);
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
  if (error) {
    // il file era già salito: non lasciarlo orfano su Storage
    await serviceDb().storage.from("listings").remove([path]);
    return { error: dbMessage(error.message) };   // restituito, non lanciato: in produzione un errore lanciato diventa illeggibile
  }
  revalidatePath(`/pro/mezzi/${listingId}/modifica`);
  return { ok: true as const };
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
  redirect(`/pro/mezzi/${listingId}/modifica`);
}

// ---------- Richieste di prenotazione ----------
export async function respondBooking(f: FormData) {
  sendEmailsSoon();
  const ctx = await requireProvider("/pro/richieste");
  if (!ctx.membership) redirect("/pro");
  const id = str(f, "id");
  const decision = str(f, "decision");
  const { bookingError } = await import("@/lib/bookings");
  const db = serviceDb();
  const { data: bk } = await db.from("bookings").select("payment_required").eq("id", id).maybeSingle();

  if (decision !== "accept") {
    const { error } = await db.rpc("svc_decline_booking", { p_booking: id, p_actor: ctx.user.id, p_reason: str(f, "reason") || null });
    if (error) fail("/pro/richieste", bookingError(error.message));
    await releaseHold(id);
    revalidatePath("/pro/richieste");
    redirect("/pro/richieste?ok=rifiutata");
  }

  if (!bk?.payment_required) {
    const { error } = await db.rpc("svc_accept_booking", { p_booking: id, p_actor: ctx.user.id });
    if (error) fail("/pro/richieste", bookingError(error.message));
    revalidatePath("/pro/richieste");
    redirect("/pro/richieste?ok=accettata");
  }

  // con pagamento: verifica → addebito sulla carta → conferma (cliente e noleggiatore avvisati)
  const { data: pi, error } = await db.rpc("svc_accept_paid_booking", { p_booking: id, p_actor: ctx.user.id });
  if (error || !pi) fail("/pro/richieste", bookingError(error?.message ?? ""));
  let captured: { id: string; amount_received: number; status: string } | null = null;
  if (String(pi).startsWith("pi_demo_")) {
    // noleggio finto dell'account di prova: nessuna carta vera da addebitare
    const { data: t } = await db.from("bookings").select("total_cents").eq("id", id).maybeSingle();
    captured = { id: String(pi), amount_received: t?.total_cents ?? 0, status: "succeeded" };
  } else {
    try {
      captured = await captureIntent(pi as string);
    } catch (e) {
      console.error("capture", id, e);
    }
  }
  if (!captured || captured.status !== "succeeded") {
    await db.rpc("svc_payment_failed", { p_booking: id });
    await releaseHold(id);
    revalidatePath("/pro/richieste");
    fail("/pro/richieste", "Addebito non riuscito sulla carta del cliente: la prenotazione è stata annullata e il cliente avvisato.");
  }
  const { error: cErr } = await db.rpc("svc_confirm_paid_booking", {
    p_booking: id, p_actor: ctx.user.id, p_pi: captured!.id, p_captured: captured!.amount_received,
  });
  if (cErr) {
    console.error("confirm after capture", id, cErr.message);
    fail("/pro/richieste", "Pagamento incassato ma conferma non registrata: avvisa l'assistenza KeyRent.");
  }
  revalidatePath("/pro/richieste");
  redirect("/pro/richieste?ok=confermata");
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
    const reg = await registerMedia(listingId, path, true);
    if ("error" in reg) return { error: reg.error };
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Il servizio che crea le immagini è occupato in questo momento. Riprova tra un minuto." };
  }
}

// ---------- Importazione da Excel ----------
async function importContext() {
  const { membership } = await editor();
  const db = await userDb();
  const { data: locations } = await db.from("locations").select("id, name, city")
    .eq("organization_id", membership.organization_id).eq("active", true).order("created_at");
  const { importCats } = await import("./mezzi/importa/cats");
  return { membership, locations: locations ?? [], cats: await importCats() };
}

export async function previewImport(f: FormData): Promise<{ rows?: PreviewRow[]; error?: string }> {
  const { locations, cats } = await importContext();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Scegli il file Excel." };
  if (file.size > 4 * 1024 * 1024) return { error: "Il file è troppo grande (massimo 4 MB)." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Serve un file .xlsx (Excel). Da Numbers o Google Fogli: File → Esporta → Excel." };
  if (!locations.length) return { error: "Prima aggiungi almeno una sede." };
  try {
    const { parseWorkbook } = await import("@/lib/importSheet");
    const rows = await parseWorkbook(await file.arrayBuffer(), locations, cats);
    if (!rows.length) return { error: "Il file non contiene mezzi: compila almeno una riga sotto le intestazioni." };
    return { rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "File non leggibile." };
  }
}

export async function confirmImport(input: PreviewRow[]): Promise<{ created: number; failed: { line: number; error: string }[] }> {
  const { membership, locations } = await importContext();
  const db = await userDb();
  const failed: { line: number; error: string }[] = [];
  let created = 0;
  for (const r of input.slice(0, 200)) {
    if (r.errors.length) continue;
    // ricontrollo lato server: sede dell'attività, prezzi positivi
    if (!locations.some((l) => l.id === r.locationId)) { failed.push({ line: r.line, error: "Sede non valida" }); continue; }
    const p = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    if (r.makeSlug && r.modelSlug) await ensureCatalogEntry(r.category, r.makeSlug, r.modelSlug).catch(() => undefined);
    else if (r.sub) await ensureCatalogEntry(r.category, "", "").catch(() => undefined);
    const payload = {
      organization_id: membership.organization_id, location_id: r.locationId,
      category: r.category, subcategory: r.sub || null,
      make: r.makeSlug, model: r.modelSlug,
      custom_make: r.makeSlug ? null : String(r.make).slice(0, 60), custom_model: r.modelSlug ? null : String(r.model).slice(0, 80),
      title: String(r.title).slice(0, 120), description: String(r.description).slice(0, 4000), attributes: {},
      quantity: Math.min(Math.max(Math.round(Number(r.quantity) || 1), 1), 200), plate: String(r.plate ?? "").slice(0, 20), year: String(r.year ?? ""),
      terms: {
        deposit_cents: p(r.deposit), min_driver_age: String(r.minAge ?? ""), min_license_years: "", required_license: "",
        included_km_per_day: String(r.km ?? ""), extra_km_cents: "", insurance_excess_cents: "", fuel_policy: "",
        buffer_minutes: "60", min_duration_minutes: "1440", notes: "",
      },
      prices: (["hour", "half_day", "day", "week"] as const).map((unit) => ({ unit, price_cents: p(r.prices?.[unit]) })),
    };
    const { error } = await db.rpc("create_listing_draft", { p: payload });
    if (error) failed.push({ line: r.line, error: dbMessage(error.message) }); else created++;
  }
  revalidatePath("/pro/mezzi");
  return { created, failed };
}

// ---------- Ciclo del noleggio: consegnato, rientrato, non presentato ----------
export async function rentalStep(f: FormData) {
  sendEmailsSoon();
  const ctx = await requireProvider("/pro/prenotazioni");
  if (!ctx.membership) redirect("/pro");
  const id = str(f, "id");
  const step = str(f, "step");
  const fn = step === "consegnato" ? "svc_mark_picked_up" : step === "rientrato" ? "svc_mark_returned" : step === "assente" ? "svc_mark_no_show" : null;
  if (!fn) fail("/pro/prenotazioni", "Azione non valida.");
  const { error } = await serviceDb().rpc(fn as string, { p_booking: id, p_actor: ctx.user.id });
  if (error) {
    const msg = /TOO_EARLY/.test(error.message)
      ? (step === "assente" ? "Puoi segnare il cliente come non presentato solo 2 ore dopo l'orario di ritiro." : "Puoi segnare la consegna al massimo 3 ore prima dell'orario di ritiro.")
      : /schema cache|does not exist|Could not find/i.test(error.message) ? "Funzione non ancora attiva: serve aggiornare il database (blocco SQL 0024)."
      : (await import("@/lib/bookings")).bookingError(error.message);
    fail("/pro/prenotazioni", msg);
  }
  revalidatePath("/pro/prenotazioni");
  revalidatePath("/pro");
  redirect(`/pro/prenotazioni?ok=${step}`);
}
