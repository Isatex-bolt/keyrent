import "server-only";
import { ensureCatalogEntry } from "@/lib/catalogSync";

/* Dati del nuovo annuncio dal modulo guidato (stesso per noleggiatore e per il team KeyRent che lo prepara per un cliente). */
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cents = (f: FormData, k: string) => {
  const v = Number(str(f, k).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
};

export async function listingPayload(f: FormData, organizationId: string) {
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
    organization_id: organizationId,
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
  if (payload.make && payload.model) {
    await ensureCatalogEntry(payload.category, payload.make, payload.model).catch((e) => console.error("catalogo", e));
  } else if (payload.subcategory) {
    await ensureCatalogEntry(payload.category, "", "").catch(() => undefined);
  }
  return payload;
}

/** Consegna a domicilio dal modulo (prezzi in euro → centesimi). */
export function deliveryOf(f: FormData) {
  const enabled = str(f, "delivery_enabled") === "1";
  const n = (k: string) => Math.max(0, Math.round((Number(str(f, k).replace(",", ".")) || 0) * 100));
  return {
    delivery_enabled: enabled,
    delivery_radius_km: enabled ? Math.min(500, Math.max(1, Math.round(Number(str(f, "delivery_radius_km")) || 0))) : null,
    delivery_fee_cents: enabled ? n("delivery_fee") : 0,
    delivery_per_km_cents: enabled ? n("delivery_per_km") : 0,
  };
}

/**
 * Contatti nel testo dell'annuncio (telefono, email, siti, social): prima della prenotazione il noleggiatore resta anonimo,
 * quindi titolo e descrizione non possono contenerli. Stesse regole del filtro dei messaggi (private.filter_contacts).
 */
export function contactsIn(text: string): string | null {
  const t = text ?? "";
  if (/[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i.test(t)) return "un indirizzo email";
  if (/(https?:\/\/|www\.)\S+/i.test(t) || /\b[A-Za-z0-9-]+\.(it|com|net|org|eu|info|biz|me|io|app|shop|store)\b/i.test(t)) return "un sito web";
  for (const m of t.match(/\+?\d[\d\s./()-]{6,}\d/g) ?? []) if (m.replace(/\D/g, "").length >= 8) return "un numero di telefono";
  if (/\b(whats\s*app|telegram|instagram|facebook|tiktok|skype|messenger)\b/i.test(t) || /(^|\s)@[A-Za-z0-9_.]{3,}/.test(t)) return "un contatto social";
  return null;
}
export const contactsError = (what: string) =>
  `Il testo contiene ${what}: toglilo. Prima della prenotazione KeyRent non mostra i contatti del noleggiatore; il cliente li riceve dopo il pagamento.`;
