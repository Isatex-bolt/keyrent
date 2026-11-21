"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serviceDb } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { dbMessage } from "@/lib/status";
import { generateImage, vehiclePrompt } from "@/lib/aiImage";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function reviewListing(f: FormData) {
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

// ---------- Immagini indicative di catalogo ----------
async function ensureListingsBucket() {
  const admin = serviceDb();
  const { error } = await admin.storage.getBucket("listings");
  if (error) await admin.storage.createBucket("listings", { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
}

export async function createCatalogUploadUrl(categoryId: string, modelId: string | null, fileName: string) {
  await requireStaff();
  await ensureListingsBucket();
  const ext = (fileName.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
  const path = `catalog/${modelId ?? `cat-${categoryId}`}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await serviceDb().storage.from("listings").createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}

export async function saveCatalogImage(categoryId: string, modelId: string | null, path: string) {
  const { user } = await requireStaff();
  if (!path.startsWith("catalog/")) throw new Error("Percorso non valido");
  const db = serviceDb();
  let q = db.from("catalog_images").select("id, storage_path").eq("category_id", categoryId);
  q = modelId ? q.eq("model_id", modelId) : q.is("model_id", null);
  const { data: old } = await q;
  for (const o of old ?? []) {
    await db.from("catalog_images").delete().eq("id", o.id);
    await db.storage.from("listings").remove([o.storage_path]);
  }
  const { error } = await db.from("catalog_images").insert({ category_id: categoryId, model_id: modelId, storage_path: path, source: "ai", created_by: user.id });
  if (error) throw new Error(dbMessage(error.message));
  revalidatePath("/admin/foto");
}

export async function removeCatalogImage(f: FormData) {
  await requireStaff();
  const db = serviceDb();
  const { data } = await db.from("catalog_images").select("storage_path").eq("id", str(f, "id")).maybeSingle();
  if (data) {
    await db.from("catalog_images").delete().eq("id", str(f, "id"));
    await db.storage.from("listings").remove([data.storage_path]);
  }
  revalidatePath("/admin/foto");
  redirect("/admin/foto?ok=rimossa");
}

export async function generateCatalogImage(categoryId: string, modelId: string | null) {
  await requireStaff();
  await ensureListingsBucket();
  const db = serviceDb();
  const { data: cat } = await db.from("categories").select("slug").eq("id", categoryId).maybeSingle();
  if (!cat) return { error: "Categoria non trovata" };
  let vehicle = "";
  if (modelId) {
    const { data: m } = await db.from("models").select("name, makes(name)").eq("id", modelId).maybeSingle();
    const mm = m as unknown as { name: string; makes: { name: string } } | null;
    vehicle = mm ? `${mm.makes.name} ${mm.name}` : "";
  }
  try {
    const img = await generateImage(vehiclePrompt({ category: cat.slug, vehicle: vehicle || "modern generic", setting: "studio" }));
    const ext = img.type.includes("png") ? "png" : "jpg";
    const path = `catalog/${modelId ?? `cat-${categoryId}`}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("listings").upload(path, img.bytes, { contentType: img.type });
    if (error) throw new Error(error.message);
    await saveCatalogImage(categoryId, modelId, path);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Servizio immagini occupato, riprova tra un minuto." };
  }
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
  const { error } = await db.from(contentTable(kind)).update({ image_path: path }).eq("slug", slug);
  if (error) throw new Error(dbMessage(error.message));
  if (old?.image_path && old.image_path !== path) await db.storage.from("listings").remove([old.image_path]);
  revalidatePath("/admin/home");
}

export async function createContentUploadUrl(kind: ContentKind, slug: string, fileName: string) {
  await requireStaff();
  await ensureListingsBucket();
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `home/${kind}/${slug.replace(/[^a-z0-9-]/g, "")}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await serviceDb().storage.from("listings").createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}

export async function saveContentImage(kind: ContentKind, slug: string, path: string) {
  await requireStaff();
  if (!path.startsWith(`home/${kind}/`)) throw new Error("Percorso non valido");
  await setContentImage(kind, slug, path);
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
    return { error: "Servizio immagini occupato, riprova tra un minuto." };
  }
}
