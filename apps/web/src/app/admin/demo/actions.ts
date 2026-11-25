"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { generateImage, vehiclePrompt } from "@/lib/aiImage";

/** Foto dei 10 annunci di esempio: 3 per mezzo, ambientazioni diverse. Generate una alla volta e salvate su Storage. */
const SHOTS: Record<string, { color: string; settings: string[]; custom?: string[] }> = {
  "fiat-500-hybrid": { color: "pastel mint green", settings: ["citta", "mare", "studio"] },
  "bmw-x3-xdrive20d": { color: "dark blue metallic", settings: ["montagna", "citta", "studio"] },
  "ducati-multistrada-v4": { color: "Ducati red", settings: ["montagna", "campagna", "studio"] },
  "vespa-primavera-125": { color: "glossy white", settings: ["citta", "mare", "studio"] },
  "e-bike-specialized-turbo-vado": { color: "satin grey", settings: ["mare", "citta", "montagna"] },
  "camper-adria-matrix-plus-670": { color: "white with grey graphics", settings: ["campagna", "montagna", "mare"] },
  "gommone-joker-boat-clubman-19": { color: "white and grey", settings: ["lago", "porto", "mare"] },
  "furgone-fiat-ducato-13-m": { color: "white", settings: ["citta", "studio", "campagna"] },
  "quad-polaris-sportsman-570": { color: "sage green", settings: [], custom: [
    "on a gravel mountain trail in the Dolomites near Cortina, summer, clear sky",
    "on a snowy forest track in the Dolomites, winter morning light",
    "in a photo studio with a seamless light grey background, soft lighting",
  ] },
  "motoslitta-ski-doo-summit": { color: "black and yellow", settings: [], custom: [
    "on fresh powder snow on a wide open slope in the Dolomites, blue sky",
    "parked on a snowy plateau in front of the Tofane peaks near Cortina, sunny winter day",
    "in a photo studio with a seamless light grey background, soft lighting",
  ] },
};

export async function demoPhotoJobs() {
  await requireStaff();
  const db = serviceDb();
  const { data: ls } = await db.from("listings").select("id, slug, title, listing_media(sort), organizations!inner(is_demo)")
    .eq("organizations.is_demo", true).eq("demo_keep", true).order("created_at");
  const jobs: { id: string; title: string; idx: number }[] = [];
  for (const l of (ls ?? []) as unknown as { id: string; slug: string; title: string; listing_media: { sort: number }[] }[]) {
    const have = new Set(l.listing_media.map((m) => m.sort));
    for (const idx of [0, 1, 2]) if (!have.has(idx) && SHOTS[l.slug]) jobs.push({ id: l.id, title: l.title, idx });
  }
  return jobs;
}

export async function generateDemoPhoto(listingId: string, idx: number): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  const db = serviceDb();
  const { data: l } = await db.from("listings")
    .select("id, slug, title, demo_keep, categories(slug), vehicle: listing_units(vehicle_units(year)), organizations!inner(is_demo)")
    .eq("id", listingId).maybeSingle();
  const row = l as unknown as { slug: string; title: string; demo_keep: boolean; categories: { slug: string } | null;
    vehicle: { vehicle_units: { year: number | null } | null }[]; organizations: { is_demo: boolean } } | null;
  if (!row || !row.demo_keep || !row.organizations.is_demo) return { error: "Annuncio non dimostrativo." };
  const shot = SHOTS[row.slug];
  if (!shot) return { error: "Foto non previste per questo annuncio." };
  const { count } = await db.from("listing_media").select("id", { count: "exact", head: true }).eq("listing_id", listingId).eq("sort", idx);
  if (count) return { ok: true };
  const year = row.vehicle[0]?.vehicle_units?.year ?? null;
  const vehicle = row.title.replace(/^(E-bike|Camper|Gommone|Furgone|Quad|Motoslitta)\s+/i, "");
  const prompt = shot.custom
    ? `Professional realistic photograph of a ${shot.color} ${year ?? ""} ${row.title}, ${shot.custom[idx]}. Three-quarter front view, whole vehicle visible and centred, clean and new looking, high detail, natural colours. No people, no readable licence plate, no text, no watermark.`
    : vehiclePrompt({ category: row.categories?.slug ?? "", vehicle, year, color: shot.color, setting: shot.settings[idx] });
  try {
    const { data: bucket } = await db.storage.getBucket("listings");
    if (!bucket) await db.storage.createBucket("listings", { public: true });
    const img = await generateImage(prompt, 1000 + idx * 7 + row.slug.length);
    const ext = img.type.includes("png") ? "png" : img.type.includes("webp") ? "webp" : "jpg";
    const path = `${listingId}/demo-${idx}-${crypto.randomUUID()}.${ext}`;
    const { error: up } = await db.storage.from("listings").upload(path, img.bytes, { contentType: img.type });
    if (up) throw new Error(up.message);
    const { error } = await db.from("listing_media").insert({
      listing_id: listingId, storage_path: path, sort: idx, moderation_status: "approved", alt: row.title,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    const m = e instanceof Error ? e.message : String(e);
    return { error: m.startsWith("Generazione") ? "Servizio immagini occupato" : m };
  }
}

export async function resetDemoNow(): Promise<{ ok: true; info: string } | { error: string }> {
  await requireStaff();
  const { data, error } = await serviceDb().rpc("svc_demo_reset");
  if (error) return { error: /does not exist|Could not find/i.test(error.message) ? "Manca la migrazione 0025 nel database." : error.message };
  revalidatePath("/", "layout");
  const d = data as { annunci_cancellati: number; noleggi_creati: number };
  return { ok: true, info: `Noleggi finti rigenerati: ${d.noleggi_creati}. Annunci di prova cancellati: ${d.annunci_cancellati}.` };
}

/** Foto da rifare: cancella le foto di un annuncio di esempio (poi "Genera foto mancanti"). */
export async function clearDemoPhotos(listingId: string) {
  await requireStaff();
  const db = serviceDb();
  const { data: l } = await db.from("listings").select("id, demo_keep, organizations!inner(is_demo)").eq("id", listingId).maybeSingle();
  if (!l || !(l as unknown as { demo_keep: boolean }).demo_keep) return;
  const { data: media } = await db.from("listing_media").select("storage_path").eq("listing_id", listingId);
  if (media?.length) await db.storage.from("listings").remove(media.map((m) => m.storage_path));
  await db.from("listing_media").delete().eq("listing_id", listingId);
  revalidatePath("/admin/demo");
  revalidatePath("/", "layout");
}

/** Foto caricata a mano (es. creata con ChatGPT): l'URL firmato fa salire il file direttamente su Storage. */
export async function createDemoUploadUrl(listingId: string, fileName: string): Promise<{ path: string; token: string } | { error: string }> {
  await requireStaff();
  const db = serviceDb();
  const { data: l } = await db.from("listings").select("id, demo_keep, organizations!inner(is_demo)").eq("id", listingId).maybeSingle();
  if (!l || !(l as unknown as { demo_keep: boolean }).demo_keep) return { error: "Annuncio non dimostrativo." };
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `${listingId}/demo-up-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("listings").createSignedUploadUrl(path);
  if (error) return { error: `Storage: ${error.message}` };
  return { path, token: data.token };
}

/** Dopo il caricamento: la foto nuova diventa l'unica dell'annuncio (le vecchie vengono tolte). */
export async function saveDemoUpload(listingId: string, path: string): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  if (!path.startsWith(`${listingId}/demo-up-`)) return { error: "Percorso non valido." };
  const db = serviceDb();
  const { data: old } = await db.from("listing_media").select("id, storage_path").eq("listing_id", listingId);
  const { data: l } = await db.from("listings").select("title").eq("id", listingId).maybeSingle();
  const { error } = await db.from("listing_media").insert({ listing_id: listingId, storage_path: path, sort: 0, moderation_status: "approved", alt: l?.title ?? null });
  if (error) return { error: error.message };
  if (old?.length) {
    await db.from("listing_media").delete().in("id", old.map((m) => m.id));
    await db.storage.from("listings").remove(old.map((m) => m.storage_path));
  }
  revalidatePath("/admin/demo");
  revalidatePath("/", "layout");
  return { ok: true };
}
