import Link from "next/link";
import { SubmitOnce } from "@/components/SubmitOnce";

export type ManualValues = {
  id?: string; mezzo: string; dal: string; al: string; ora_ritiro: string; ora_riconsegna: string;
  nome: string; recapito: string; prezzo: string; note: string;
};

const HOURS = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`); // 06:00 → 22:00

/** Modulo della prenotazione manuale: pochi campi, campi nativi del telefono (data, ora, tastiera numerica). */
export function ManualForm({ action, values, vehicles, back, submit }: {
  action: (f: FormData) => Promise<void>; values: ManualValues; vehicles: { id: string; title: string; location: string }[];
  back: string; submit: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="back" value={back} />
      <div>
        <label className="label" htmlFor="m-mezzo">Mezzo e sede</label>
        <select id="m-mezzo" name="mezzo" defaultValue={values.mezzo} required className="field">
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.title} · {v.location}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:gap-3">
        <div><label className="label" htmlFor="m-dal">Ritiro</label><input id="m-dal" name="dal" type="date" required defaultValue={values.dal} className="field" /></div>
        <div><label className="label" htmlFor="m-or">Ora</label>
          <select id="m-or" name="ora_ritiro" defaultValue={values.ora_ritiro} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div><label className="label" htmlFor="m-al">Riconsegna</label><input id="m-al" name="al" type="date" required defaultValue={values.al} className="field" /></div>
        <div><label className="label" htmlFor="m-oc">Ora</label>
          <select id="m-oc" name="ora_riconsegna" defaultValue={values.ora_riconsegna} className="field">{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="m-nome">Nome cliente</label>
          <input id="m-nome" name="nome" required maxLength={120} defaultValue={values.nome} autoComplete="off" className="field" placeholder="Es. Mario Rossi" /></div>
        <div><label className="label" htmlFor="m-rec">Telefono o email</label>
          <input id="m-rec" name="recapito" maxLength={160} defaultValue={values.recapito} autoComplete="off" className="field" placeholder="Facoltativo" /></div>
      </div>
      <div className="sm:w-1/2"><label className="label" htmlFor="m-prezzo">Prezzo concordato (€)</label>
        <input id="m-prezzo" name="prezzo" inputMode="decimal" defaultValue={values.prezzo} className="field" placeholder="Es. 120" /></div>
      <div><label className="label" htmlFor="m-note">Note (facoltative)</label>
        <textarea id="m-note" name="note" rows={3} maxLength={1000} defaultValue={values.note} className="field" placeholder="Es. pagato al banco, cauzione in contanti, seggiolino…" /></div>
      <p className="rounded-xl bg-navy-50/70 px-4 py-3 text-sm text-navy-800">
        Occupa il mezzo nel calendario come una prenotazione KeyRent, così non può essere prenotato online in quelle date.
        Nessun pagamento passa da KeyRent e non ci sono commissioni.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={back} className="btn-ghost justify-center">Indietro</Link>
        <SubmitOnce className="btn-primary justify-center px-6 py-3" pendingText="Salvo…">{submit}</SubmitOnce>
      </div>
    </form>
  );
}
