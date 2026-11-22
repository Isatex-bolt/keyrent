import "server-only";
import ExcelJS from "exceljs";
import { CATALOG, EXTRA_SUBCATEGORIES, norm, searchCatalog } from "@/data/catalog";
import { CATEGORIES } from "./catalog";

export type Loc = { id: string; name: string; city: string };
export type Cat = { slug: string; name: string; subs: { slug: string; name: string }[] };

export const COLUMNS = [
  { key: "categoria", header: "Categoria *", width: 16 },
  { key: "marca", header: "Marca *", width: 16 },
  { key: "modello", header: "Modello *", width: 20 },
  { key: "tipologia", header: "Tipologia", width: 18 },
  { key: "anno", header: "Anno", width: 8 },
  { key: "targa", header: "Targa", width: 11 },
  { key: "quantita", header: "Quantità", width: 10 },
  { key: "sede", header: "Sede", width: 22 },
  { key: "giorno", header: "Prezzo al giorno €", width: 12 },
  { key: "settimana", header: "Prezzo a settimana €", width: 12 },
  { key: "mezza", header: "Prezzo mezza giornata €", width: 12 },
  { key: "ora", header: "Prezzo all'ora €", width: 12 },
  { key: "cauzione", header: "Cauzione €", width: 11 },
  { key: "eta", header: "Età minima", width: 9 },
  { key: "km", header: "Km inclusi al giorno", width: 11 },
  { key: "titolo", header: "Titolo (facoltativo)", width: 28 },
  { key: "descrizione", header: "Descrizione (facoltativa)", width: 50 },
] as const;

const MAX_ROWS = 200;

const HEADER_PREFIX: Record<string, string> = {
  categoria: "categoria", marca: "marca", modello: "modello", tipologia: "tipologia", anno: "anno", targa: "targa",
  quantita: "quantita", sede: "sede", giorno: "prezzoalgiorno", settimana: "prezzoasettimana", mezza: "prezzomezza",
  ora: "prezzoallora", cauzione: "cauzione", eta: "eta", km: "km", titolo: "titolo", descrizione: "descrizione",
};

/** Modello Excel con elenchi a tendina (categorie, tipologie, sedi) e una riga di esempio. */
export async function buildTemplate(locations: Loc[], cats: Cat[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KeyRent";
  const ws = wb.addWorksheet("Mezzi", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.height = 34;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF011938" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  const loc = locations[0];
  ws.addRow({ categoria: "Furgoni", marca: "Fiat", modello: "Ducato", tipologia: "Furgone merci", anno: 2023, quantita: 2,
    sede: loc ? `${loc.name} · ${loc.city}` : "", giorno: 89, settimana: 490, cauzione: 500, eta: 23, km: 200 });
  ws.getRow(2).font = { italic: true, color: { argb: "FF5A6678" } };

  const lists = wb.addWorksheet("Elenchi", { state: "veryHidden" });
  CATEGORIES.forEach((c, i) => { lists.getCell(i + 1, 1).value = c.name; });
  const subs = [...new Set(cats.flatMap((c) => c.subs.map((s) => s.name)))];
  subs.forEach((s, i) => { lists.getCell(i + 1, 2).value = s; });
  locations.forEach((l, i) => { lists.getCell(i + 1, 3).value = `${l.name} · ${l.city}`; });
  const last = MAX_ROWS + 1;
  for (let r = 2; r <= last; r++) {
    ws.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Elenchi!$A$1:$A$${CATEGORIES.length}`] };
    if (subs.length) ws.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Elenchi!$B$1:$B$${subs.length}`] };
    if (locations.length) ws.getCell(`H${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Elenchi!$C$1:$C$${locations.length}`] };
  }

  const help = wb.addWorksheet("Istruzioni");
  help.getColumn(1).width = 110;
  [
    "Come compilare (una riga = un annuncio)",
    "",
    "• Cancella la riga di esempio in grigio, oppure modificala con un tuo mezzo.",
    "• Obbligatori: Categoria, Marca, Modello e almeno un prezzo.",
    "• Categoria, Tipologia e Sede si scelgono dal menu a tendina della cella.",
    "• Quantità: se hai più mezzi identici (es. 20 e-bike uguali) metti il numero: diventano un solo annuncio.",
    "• Sede: se la lasci vuota usiamo la tua prima sede.",
    "• Titolo e descrizione: se li lasci vuoti li prepariamo noi, poi puoi modificarli.",
    "• Prezzi in euro, senza simbolo: 89 oppure 89,50.",
    "• Gli annunci vengono creati come bozze: aggiungi le foto (anche con l'AI) e inviali in revisione.",
    `• Massimo ${MAX_ROWS} righe per file.`,
  ].forEach((t, i) => {
    const c = help.getCell(i + 1, 1);
    c.value = t;
    if (i === 0) c.font = { bold: true, size: 14 };
  });
  return wb.xlsx.writeBuffer();
}

export type PreviewRow = {
  line: number; errors: string[]; warnings: string[];
  category: string; categoryName: string; sub: string; subName: string;
  make: string; model: string; makeSlug: string | null; modelSlug: string | null;
  year: string; plate: string; quantity: number; locationId: string; locationName: string;
  prices: { day: number; week: number; half_day: number; hour: number };
  deposit: number; minAge: string; km: string; title: string; description: string;
};

function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v) return text(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if (v instanceof Date) return String(v.getFullYear());
  }
  return String(v).trim();
}
function euroCents(s: string) {
  const n = Number(s.replace(/[€\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Legge il file, riconosce modelli, sedi e tipologie, e segnala gli errori riga per riga. Non scrive nulla. */
export async function parseWorkbook(buf: ArrayBuffer, locations: Loc[], cats: Cat[]): Promise<PreviewRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("Mezzi") ?? wb.worksheets[0];
  if (!ws) throw new Error("Il file non contiene fogli.");
  // colonne riconosciute dall'intestazione (così funziona anche se l'ordine cambia)
  const colOf = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const h = norm(text(cell.value));
    const key = Object.entries(HEADER_PREFIX).find(([, p]) => h.startsWith(p))?.[0];
    if (key && !colOf.has(key)) colOf.set(key, col);
  });
  if (!colOf.has("categoria") || !colOf.has("modello")) throw new Error("Non riconosciamo le colonne: usa il modello Excel di KeyRent.");

  const rows: PreviewRow[] = [];
  ws.eachRow((row, line) => {
    if (line === 1 || rows.length >= MAX_ROWS) return;
    const get = (k: (typeof COLUMNS)[number]["key"]) => (colOf.has(k) ? text(row.getCell(colOf.get(k)!).value) : "");
    const vals = COLUMNS.map((c) => get(c.key));
    if (vals.every((v) => !v)) return;
    const errors: string[] = [], warnings: string[] = [];

    const catIn = get("categoria");
    const cat = CATEGORIES.find((c) => norm(c.name) === norm(catIn) || c.slug === norm(catIn) || norm(c.name).startsWith(norm(catIn)) && norm(catIn).length >= 3);
    if (!cat) errors.push(catIn ? `Categoria "${catIn}" non valida` : "Manca la categoria");
    const catObj = cats.find((c) => c.slug === cat?.slug);
    const subsAll = [...(catObj?.subs ?? []), ...((cat && EXTRA_SUBCATEGORIES[cat.slug]) || []).map((s) => ({ slug: s.slug, name: s.name }))];

    const make = get("marca"), model = get("modello");
    if (!make) errors.push("Manca la marca");
    if (!model) errors.push("Manca il modello");
    let entry = cat ? CATALOG.find((e) => e.category === cat.slug && norm(e.make) === norm(make) && norm(e.model) === norm(model)) : undefined;
    if (!entry && cat && make && model) {
      const best = searchCatalog(`${make} ${model}`, cat.slug, 1)[0] ?? searchCatalog(`${make} ${model.split(/\s+/)[0]}`, cat.slug, 1)[0];
      if (best && norm(best.make) === norm(make) && (norm(best.model).startsWith(norm(model)) || norm(model).startsWith(norm(best.model)))) entry = best;
    }
    if (cat && make && model && !entry) warnings.push("Modello non a catalogo: lo inseriamo come scritto");

    const subIn = get("tipologia");
    let sub = subsAll.find((s) => norm(s.name) === norm(subIn) || s.slug === norm(subIn));
    if (!sub && entry) sub = subsAll.find((s) => s.slug === entry!.sub);
    if (subIn && !subsAll.some((s) => norm(s.name) === norm(subIn) || s.slug === norm(subIn))) warnings.push(`Tipologia "${subIn}" non riconosciuta`);

    const sedeIn = get("sede");
    let location = locations.find((l) => norm(`${l.name} · ${l.city}`) === norm(sedeIn) || norm(l.name) === norm(sedeIn) || norm(l.city) === norm(sedeIn));
    if (!location && !sedeIn) location = locations[0];
    if (!location) errors.push(`Sede "${sedeIn}" non trovata`);

    const prices = { day: euroCents(get("giorno")), week: euroCents(get("settimana")), half_day: euroCents(get("mezza")), hour: euroCents(get("ora")) };
    if (!prices.day && !prices.week && !prices.half_day && !prices.hour) errors.push("Manca almeno un prezzo");

    const year = get("anno").replace(/\D/g, "").slice(0, 4);
    if (year && (Number(year) < 1950 || Number(year) > 2100)) errors.push(`Anno "${year}" non valido`);
    const qty = Math.min(Math.max(Number(get("quantita").replace(",", ".")) || 1, 1), 200);
    const makeName = entry?.make ?? make, modelName = entry?.model ?? model;
    const title = (get("titolo") || [makeName, modelName, year].filter(Boolean).join(" ")).slice(0, 120);
    const city = location?.city ?? "";
    let description = get("descrizione");
    if (description.length < 40) {
      description = `${title} disponibile per il noleggio. Contatta ora e realizza la tua offerta dedicata.` + (description ? ` ${description}` : "");
    }

    rows.push({
      line, errors, warnings,
      category: cat?.slug ?? "", categoryName: cat?.name ?? catIn, sub: sub?.slug ?? "", subName: sub?.name ?? "",
      make: makeName, model: modelName, makeSlug: entry?.makeSlug ?? null, modelSlug: entry?.modelSlug ?? null,
      year, plate: get("targa").toUpperCase().slice(0, 20), quantity: qty,
      locationId: location?.id ?? "", locationName: location ? `${location.name} · ${location.city}` : sedeIn,
      prices, deposit: euroCents(get("cauzione")), minAge: get("eta").replace(/\D/g, "").slice(0, 2),
      km: get("km").replace(/\D/g, "").slice(0, 5), title, description: description.slice(0, 4000),
    });
  });
  return rows;
}
