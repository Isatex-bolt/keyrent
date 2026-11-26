/** Nome del link personale della demo (keyrent.it/demo?da=autonoleggio-rossi): minuscole, numeri e trattini. */
export function demoRef(raw: unknown): string | null {
  const s = String(raw ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || null;
}
