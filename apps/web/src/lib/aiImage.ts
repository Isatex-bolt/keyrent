import "server-only";

/**
 * Genera un'immagine con Pollinations (gratuito, senza chiave; con POLLINATIONS_TOKEN facoltativo
 * su Vercel si evitano limiti e filigrana). L'immagine viene salvata su Storage: mai collegata a ogni visita.
 */
export async function generateImage(prompt: string, seed = Math.floor(Math.random() * 1e9)): Promise<{ bytes: ArrayBuffer; type: string }> {
  const params = new URLSearchParams({ width: "1280", height: "960", nologo: "true", seed: String(seed), model: "flux", private: "true" });
  const headers: Record<string, string> = {};
  if (process.env.POLLINATIONS_TOKEN) headers.Authorization = `Bearer ${process.env.POLLINATIONS_TOKEN}`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(75_000),
    }).catch((e) => { last = String(e); return null; });
    if (res?.ok) {
      const type = res.headers.get("content-type") ?? "image/jpeg";
      if (type.startsWith("image/")) return { bytes: await res.arrayBuffer(), type };
      last = `risposta non valida (${type})`;
    } else if (res) {
      last = `HTTP ${res.status}`;
      if (res.status === 429) await new Promise((r) => setTimeout(r, 16_000)); // limite: 1 richiesta ogni 15 s
    }
  }
  throw new Error(`Generazione immagine non riuscita: ${last}`);
}

const NOUN: Record<string, string> = {
  auto: "car", moto: "motorcycle", bici: "bicycle", camper: "motorhome camper van", barche: "boat",
  furgoni: "van", "quad-motoslitte": "quad bike ATV",
};

export const SETTINGS: Record<string, { key: string; label: string; en: string }[]> = {
  default: [
    { key: "citta", label: "Città", en: "parked in an elegant street of an Italian historic town centre, late afternoon light" },
    { key: "mare", label: "Mare", en: "on an Italian coastal road with the sea in the background, sunny day" },
    { key: "montagna", label: "Montagna", en: "on a mountain road in the Dolomites, clear sky" },
    { key: "campagna", label: "Campagna", en: "on a country road in Tuscany among cypress trees, golden light" },
    { key: "studio", label: "Studio", en: "in a photo studio with a seamless light grey background, soft lighting" },
  ],
  barche: [
    { key: "mare", label: "Mare", en: "anchored in a turquoise cove in Sardinia, sunny day" },
    { key: "porto", label: "Porto", en: "moored in a small Italian harbour with colourful houses in the background" },
    { key: "lago", label: "Lago", en: "on Lake Garda with mountains in the background, calm water" },
  ],
  bici: [
    { key: "citta", label: "Città", en: "leaning against a wall in a square of an Italian historic town" },
    { key: "mare", label: "Lungomare", en: "on a seaside cycle path, sunny day" },
    { key: "montagna", label: "Montagna", en: "on a mountain trail in the Dolomites" },
    { key: "campagna", label: "Campagna", en: "on a gravel road in Tuscany among vineyards" },
  ],
};

export function settingsFor(category: string) {
  return SETTINGS[category] ?? SETTINGS.default;
}

export function vehiclePrompt(o: { category: string; vehicle?: string; year?: string | number | null; color?: string; setting?: string }) {
  const s = settingsFor(o.category).find((x) => x.key === o.setting) ?? settingsFor(o.category)[0];
  const what = [o.color?.trim(), o.year ? String(o.year) : "", o.vehicle?.trim() || "", NOUN[o.category] ?? "vehicle"].filter(Boolean).join(" ");
  return `Professional realistic photograph of a ${what}, ${s.en}. Three-quarter front view, whole vehicle visible and centred, `
    + `clean and new looking, high detail, natural colours. No people, no readable licence plate, no text, no watermark.`;
}
