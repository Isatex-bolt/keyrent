import { CATEGORIES } from "@/lib/catalog";
import { PLACES } from "@/lib/places";

type Values = { luogo?: string; dal?: string; al?: string; cat?: string };

/** Form di ricerca: GET verso /cerca, i parametri restano nell'URL. Funziona anche senza JavaScript. */
export function SearchForm({ values = {}, compact = false }: { values?: Values; compact?: boolean }) {
  return (
    <form action="/cerca" method="get"
      className={`grid gap-3 ${compact ? "sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" : "sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"}`}>
      <div>
        <label htmlFor="luogo" className="label">Dove</label>
        <input id="luogo" name="luogo" list="kr-places" className="field" placeholder="Città o località"
          defaultValue={values.luogo ?? ""} autoComplete="off" />
        <datalist id="kr-places">
          {PLACES.map((p) => <option key={p.slug} value={p.name}>{p.province}</option>)}
        </datalist>
      </div>
      <div>
        <label htmlFor="dal" className="label">Dal</label>
        <input id="dal" name="dal" type="date" className="field" defaultValue={values.dal ?? ""} />
      </div>
      <div>
        <label htmlFor="al" className="label">Al</label>
        <input id="al" name="al" type="date" className="field" defaultValue={values.al ?? ""} />
      </div>
      <div>
        <label htmlFor="cat" className="label">Categoria</label>
        <select id="cat" name="cat" className="field" defaultValue={values.cat ?? ""}>
          <option value="">Tutte</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">Cerca</button>
      </div>
    </form>
  );
}
