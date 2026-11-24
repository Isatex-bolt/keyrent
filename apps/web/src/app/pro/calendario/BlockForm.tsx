"use client";

import { useState } from "react";
import { DateRange } from "@/components/RangePicker";
import { SubmitOnce } from "@/components/SubmitOnce";

export function BlockForm({ action, listingId, units, back }: { action: (f: FormData) => Promise<void>; listingId: string; units: number; back: string }) {
  const [d, setD] = useState({ dal: "", al: "" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
      <input type="hidden" name="listing_id" value={listingId} /><input type="hidden" name="back" value={back} />
      <div>
        <span className="label">Dal → Al</span>
        <div className="field flex items-center !py-0"><DateRange dal={d.dal} al={d.al} onChange={setD} placeholder={["Dal", "Al"]} className="!py-2.5" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
        <select name="kind" className="field" aria-label="Motivo"><option value="block">Noleggio esterno / bloccato</option><option value="maintenance">Manutenzione</option></select>
        {units > 1 && (
          <select name="qty" className="field" aria-label="Quante unità" defaultValue={units}>
            {Array.from({ length: units }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === units ? `Tutte (${n})` : `${n} unità`}</option>)}
          </select>
        )}
      </div>
      <input name="note" maxLength={200} placeholder="Nota (facoltativa)" className="field sm:col-span-2" />
      <div className="sm:row-start-1 sm:col-start-3"><SubmitOnce className="btn-primary w-full" pendingText="Blocco…">Blocca</SubmitOnce></div>
    </form>
  );
}
