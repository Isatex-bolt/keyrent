"use server";

import { sendEmailsSoon } from "@/lib/email";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serviceDb } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { dbMessage } from "@/lib/status";
import { generateImage } from "@/lib/aiImage";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function reviewListing(f: FormData) {
  sendEmailsSoon();
  const { user } = await requireStaff();
  const id = str(f, "id");
  const to = str(f, "to");
  const reason = str(f, "reason") || null;
  if (!["approved", "changes_required", "rejected", "suspended", "published", "unpublished"].includes(to)) redirect(`/admin/revisione/${id}`);
  const { error } = await serviceDb().rpc("svc_listing_transition", {
    p_listing: id, p_to: to, p_actor: user.id, p_reason: reason, p_notes: reason ? { note: reason } : null,
  });
  if (error) redirect(`/admin/revisione/${id}?errore=${encodeURIComponent(dbMessage(error.message))}`);
  revalidatePath("/admin/revisione");
  redirect(to === "approved" ? "/admin/revisione?ok=approvato" : `/admin/revisione/${id}?ok=${to}`);
}

export async function reviewChanges(f: FormData) {
  sendEmailsSoon();
  const { user } = await requireStaff();
  const id = str(f, "listing_id");
  const approve = str(f, "approve") === "true";
  const reason = str(f, "reason");
  const { error } = await serviceDb().rpc("svc_review_listing_changes", {
    p_revision: str(f, "revision_id"), p_actor: user.id, p_approve: approve, p_notes: reason ? { note: reason } : null,
  });
  if (error) redirect(`/admin/revisione/${id}?errore=${encodeURIComponent(dbMessage(error.message))}`);
  redirect(`/admin/revisione/${id}?ok=${approve ? "modifica-approvata" : "modifica-respinta"}`);
}

export async function setOrgVerification(f: FormData) {
  const { user } = await requireStaff();
  const { error } = await serviceDb().rpc("svc_set_org_verification", {
    p_org: str(f, "id"), p_status: str(f, "status"), p_actor: user.id, p_reason: str(f, "reason") || null,
  });
  if (error) redirect(`/admin/anagrafiche?errore=${encodeURIComponent(dbMessage(error.message))}`);
  revalidatePath("/admin/anagrafiche");
  redirect("/admin/anagrafiche?ok=1");
}

/** Noleggiatore Premium: lo decide lo staff (compare nelle schede dei risultati). */
export async function setOrgPremium(f: FormData) {
  await requireStaff();
  const id = str(f, "id");
  const { error } = await serviceDb().from("organizations").update({ is_premium: str(f, "premium") === "1" }).eq("id", id).eq("kind", "provider");
  if (error) redirect(`/admin/anagrafiche/${id}?errore=${encodeURIComponent(dbMessage(error.message))}`);
  revalidatePath(`/admin/anagrafiche/${id}`);
  redirect(`/admin/anagrafiche/${id}?ok=1`);
}

// ---------- Immagini indicative di catalogo ----------
async function ensureListingsBucket() {
  const admin = serviceDb();
  const { error } = await admin.storage.getBucket("listings");
  if (error) await admin.storage.createBucket("listings", { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
}





// ---------- Immagini della home (esigenze e destinazioni) ----------
type ContentKind = "collection" | "destination";
const contentTable = (k: ContentKind) => (k === "collection" ? "home_collections" : "destinations");

const COLLECTION_PROMPTS: Record<string, string> = {
  "escursione-in-bici": "a person riding an e-mountain bike on a scenic mountain road in the Italian Prealps near Monte Grappa, sunny summer morning, view over the valley",
  "sei-in-viaggio": "a modern compact car parked near an elegant Italian railway station square at golden hour, a traveller with a suitcase walking towards it",
  "weekend-in-camper": "a modern white motorhome parked by a lake in the Italian Dolomites at sunset, camping chairs and warm lights",
  "giornata-in-barca": "a rigid inflatable boat anchored in a turquoise cove in Sardinia, crystal clear water, summer, aerial view",
  "mezzo-per-azienda": "a clean white delivery van parked in front of a modern Italian business building, morning light",
  avventura: "two quad bikes on a snowy mountain trail in the Italian Alps, blue sky, adventure",
};

async function contentPrompt(kind: ContentKind, slug: string) {
  if (kind === "collection") return COLLECTION_PROMPTS[slug] ?? "scenic Italian landscape with a rental vehicle";
  const { data } = await serviceDb().from("destinations").select("name, region").eq("slug", slug).maybeSingle();
  return `breathtaking scenic view of ${data?.name ?? slug}, ${data?.region ?? ""}, Italy, golden hour, wide landscape, travel magazine style`;
}

async function setContentImage(kind: ContentKind, slug: string, path: string) {
  const db = serviceDb();
  const { data: old } = await db.from(contentTable(kind)).select("image_path").eq("slug", slug).maybeSingle();
  const { error, count } = await db.from(contentTable(kind)).update({ image_path: path }, { count: "exact" }).eq("slug", slug);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("riga non trovata");
  if (old?.image_path && old.image_path !== path) await db.storage.from("listings").remove([old.image_path]);
  revalidatePath("/admin/home");
}

export async function createContentUploadUrl(kind: ContentKind, slug: string, fileName: string): Promise<{ path: string; token: string } | { error: string }> {
  await requireStaff();
  try {
    await ensureListingsBucket();
    const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `home/${kind}/${slug.replace(/[^a-z0-9-]/g, "")}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await serviceDb().storage.from("listings").createSignedUploadUrl(path);
    if (error) return { error: `Storage: ${error.message}` };
    return { path, token: data.token };
  } catch (e) {
    return { error: `Preparazione: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function saveContentImage(kind: ContentKind, slug: string, path: string): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  if (!path.startsWith(`home/${kind}/`)) return { error: "Percorso non valido" };
  try {
    await setContentImage(kind, slug, path);
    return { ok: true };
  } catch (e) {
    return { error: `Salvataggio: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function generateContentImage(kind: ContentKind, slug: string) {
  await requireStaff();
  await ensureListingsBucket();
  try {
    const prompt = `Professional realistic photograph, ${await contentPrompt(kind, slug)}. High detail, natural colours, no text, no watermark, no logos.`;
    const img = await generateImage(prompt);
    const path = `home/${kind}/${slug.replace(/[^a-z0-9-]/g, "")}/${crypto.randomUUID()}.${img.type.includes("png") ? "png" : "jpg"}`;
    const { error } = await serviceDb().storage.from("listings").upload(path, img.bytes, { contentType: img.type });
    if (error) throw new Error(error.message);
    await setContentImage(kind, slug, path);
    return { ok: true };
  } catch (e) {
    console.error(e);
    const m = e instanceof Error ? e.message : String(e);
    return { error: m.startsWith("Generazione") ? "Servizio immagini occupato, riprova tra un minuto." : `Errore: ${m}` };
  }
}

// ---------- Testi della home: esigenze e mete ----------
const CATS = ["auto", "moto", "bici", "camper", "barche", "furgoni", "quad-motoslitte"];

export async function saveCollection(f: FormData) {
  await requireStaff();
  const slug = str(f, "slug");
  const title = str(f, "title").slice(0, 80), subtitle = str(f, "subtitle").slice(0, 160);
  if (!title || !subtitle) redirect("/admin/home?errore=" + encodeURIComponent("Titolo e sottotitolo sono obbligatori."));
  const cat = str(f, "cat"), sub = str(f, "sub");
  const query = new URLSearchParams();
  if (CATS.includes(cat)) query.set("cat", cat);
  if (cat && /^[a-z0-9-]{2,40}$/.test(sub)) query.set("sub", sub);
  const { error } = await serviceDb().from("home_collections")
    .update({ title, subtitle, query: query.toString(), active: f.get("active") === "on" }).eq("slug", slug);
  if (error) redirect("/admin/home?errore=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/admin/home?ok=salvato#c-" + slug);
}

export async function saveDestination(f: FormData) {
  await requireStaff();
  const isNew = !str(f, "slug");
  const name = str(f, "name").slice(0, 80);
  const slug = isNew
    ? name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : str(f, "slug");
  const lat = Number(str(f, "lat")), lng = Number(str(f, "lng"));
  const row: Record<string, unknown> = {
    name, region: str(f, "region").slice(0, 80), tagline: str(f, "tagline").slice(0, 120),
    description: str(f, "description").slice(0, 1200),
    radius_km: Math.min(Math.max(Number(str(f, "radius_km")) || 30, 5), 150),
    categories: f.getAll("categories").map(String).filter((c) => CATS.includes(c)),
    active: f.get("active") === "on",
  };
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 35 && lat < 48 && lng > 6 && lng < 19) { row.latitude = lat; row.longitude = lng; }
  const back = (m: string) => redirect(`/admin/home?errore=${encodeURIComponent(m)}`);
  if (!name || !row.region || !row.tagline || !row.description) back("Compila nome, regione, frase breve e descrizione.");
  const db = serviceDb();
  if (isNew) {
    if (row.latitude == null) back("Scegli il luogo della meta dai suggerimenti, così sappiamo dov'è sulla mappa.");
    const { error } = await db.from("destinations").insert({ ...row, slug, sort: 1000 });
    if (error) back(error.message.includes("duplicate") ? "Esiste già una meta con questo nome." : error.message);
  } else {
    const { error } = await db.from("destinations").update(row).eq("slug", slug);
    if (error) back(error.message);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/home?ok=salvato#d-${slug}`);
}

export async function deleteDestination(f: FormData) {
  await requireStaff();
  const db = serviceDb();
  const { data } = await db.from("destinations").select("image_path").eq("slug", str(f, "slug")).maybeSingle();
  await db.from("destinations").delete().eq("slug", str(f, "slug"));
  if (data?.image_path) await db.storage.from("listings").remove([data.image_path]);
  revalidatePath("/", "layout");
  redirect("/admin/home?ok=eliminata");
}

// ---------- Catalogo marche e modelli ----------
export async function syncCatalogAction() {
  await requireStaff();
  const { syncCatalog } = await import("@/lib/catalogSync");
  try {
    const r = await syncCatalog();
    revalidatePath("/admin/catalogo");
    redirect(`/admin/catalogo?ok=${encodeURIComponent(`${r.makes}|${r.models}`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect
    redirect(`/admin/catalogo?errore=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
}
