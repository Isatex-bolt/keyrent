import { userDb } from "@/lib/supabase/server";
import { blockDays, unblock } from "./blockActions";
import { BlockForm } from "./BlockForm";

const fmt = (iso: string) => new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(new Date(iso));

/** Blocchi del mezzo scelto: elenco + modulo per bloccare giorni (noleggio esterno o manutenzione). */
export async function Blocks({ listingId, units, back, canEdit }: { listingId: string; units: number; back: string; canEdit: boolean }) {
  const db = await userDb();
  const { data: lu } = await db.from("listing_units").select("vehicle_unit_id").eq("listing_id", listingId);
  const ids = (lu ?? []).map((x) => x.vehicle_unit_id as string);
  const { data: rows } = ids.length
    ? await db.from("unit_reservations").select("id, period, kind, note").in("vehicle_unit_id", ids)
      .eq("active", true).in("kind", ["block", "maintenance"]).order("period")
    : { data: [] as { id: string; period: string; kind: string; note: string | null }[] };
  const now = new Date().getTime();
  const list = (rows ?? []).map((r) => {
    const m = String(r.period).match(/^[[(]"?([^",]*)"?,"?([^",)\]]*)"?/);
    const iso = (x: string) => x.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    const a = m ? iso(m[1]) : "", b = m ? iso(m[2]) : "";
    return { ...r, a, b };
  }).filter((r) => r.b && Date.parse(r.b) > now);
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Blocca giorni</h2>
        <p className="text-sm text-mute">Noleggi fuori da KeyRent o manutenzione: i giorni bloccati non si possono prenotare.</p>
      </div>
      {canEdit ? <BlockForm action={blockDays} listingId={listingId} units={units} back={back} /> : <p className="text-sm text-mute">Solo titolare e manager possono bloccare giorni.</p>}
      {list.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium">{fmt(r.a)} → {fmt(new Date(Date.parse(r.b) - 1).toISOString())}</span>
                <span className="block text-xs text-mute">{r.kind === "maintenance" ? "Manutenzione" : "Bloccato"}{r.note ? ` · ${r.note}` : ""}</span>
              </span>
              {canEdit && (
                <form action={unblock}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                  <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-navy-50">Sblocca</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
