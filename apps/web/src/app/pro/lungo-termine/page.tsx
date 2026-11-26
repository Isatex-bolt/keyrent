import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { LT_SERVICES } from "@/lib/longTerm";
import { euro } from "@/lib/format";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { SubmitOnce } from "@/components/SubmitOnce";
import { setLtStatus } from "@/app/lungo-termine/actions";

export const metadata = { title: "Richieste lungo termine" };

export default function Page({ searchParams }: PageProps<"/pro/lungo-termine">) {
  return <Suspense fallback={<Skeleton />}><Leads searchParams={searchParams} /></Suspense>;
}

type Lead = {
  id: string; created_at: string; customer_name: string; customer_email: string; customer_phone: string; customer_kind: string;
  company_name: string | null; company_vat: string | null; months: number; km_per_year: number; services: string[]; note: string | null;
  monthly_cents: number; fee_cents: number; status: string; report_reason: string | null; listing: { title: string } | null;
};

const STATUS: Record<string, [string, string]> = {
  new: ["Nuova", "bg-teal-100 text-teal-900"], contacted: ["Contattato", "bg-navy-50 text-navy-800"],
  closed: ["Chiusa", "bg-gray-100 text-gray-700"], reported: ["Segnalata", "bg-amber-100 text-amber-900"], invalid: ["Non valida", "bg-red-50 text-red-800"],
};

/** Esempi per l'account demo: mostrano come arrivano le richieste (nessun dato vero). */
function demoLeads(): Lead[] {
  const d = (h: number) => new Date(new Date().getTime() - h * 3600_000).toISOString();
  const base = { company_name: null, company_vat: null, note: null, report_reason: null, customer_kind: "privato" };
  return [
    { ...base, id: "demo-1", created_at: d(2), customer_name: "Giulia Bianchi", customer_email: "giulia.bianchi@esempio.it", customer_phone: "333 123 4567",
      months: 36, km_per_year: 15000, services: ["assicurazione", "tagliandi"], monthly_cents: 32900, fee_cents: 1645, status: "new",
      note: "Mi servirebbe entro fine mese, colore bianco se possibile.", listing: { title: "Fiat 500 Hybrid" } },
    { ...base, id: "demo-2", created_at: d(26), customer_name: "Marco Conti", customer_email: "m.conti@edilconti.it", customer_phone: "347 555 0192",
      customer_kind: "azienda", company_name: "Edil Conti S.r.l.", company_vat: "IT01234567890", months: 48, km_per_year: 30000, services: ["gomme"],
      monthly_cents: 51900, fee_cents: 2595, status: "contacted", listing: { title: "Furgone Fiat Ducato 13 m³" } },
    { ...base, id: "demo-3", created_at: d(90), customer_name: "Sara Colombo", customer_email: "sara.colombo@esempio.it", customer_phone: "320 987 6543",
      months: 24, km_per_year: 10000, services: [], monthly_cents: 62900, fee_cents: 3145, status: "closed", listing: { title: "BMW X3" } },
  ];
}

async function Leads({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/lungo-termine");
  if (!membership) redirect("/pro");
  const db = await userDb();
  const [{ data }, { data: org }] = await Promise.all([
    db.from("lt_requests").select("id, created_at, customer_name, customer_email, customer_phone, customer_kind, company_name, company_vat, months, km_per_year, services, note, monthly_cents, fee_cents, status, report_reason, listing:listings(title)")
      .eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(200),
    db.from("organizations").select("is_demo").eq("id", membership.organization_id).maybeSingle(),
  ]);
  const demo = !!(org as { is_demo?: boolean } | null)?.is_demo;
  const leads = (demo && !(data ?? []).length ? demoLeads() : (data ?? [])) as unknown as Lead[];
  const now = new Date().getTime();

  return (
    <div className="space-y-5">
      <ProHeader title="Richieste lungo termine" subtitle="Clienti che chiedono un preventivo: hai subito i loro contatti. Contattali presto, documenti e contratto li gestisci tu." />
      <Flash sp={sp} ok={{ salvato: "Stato aggiornato.", segnalata: "Segnalazione inviata: la controlliamo noi. Se la richiesta non è valida non ti viene addebitata." }} />
      <p className="rounded-xl bg-navy-50/70 px-4 py-3 text-sm text-navy-800">
        Ogni richiesta valida costa il <strong>5% della prima rata</strong> indicata dal cliente. Un numero falso o una richiesta per sbaglio?
        Segnalala entro 7 giorni: se non è valida, non si paga.
      </p>
      {!leads.length && <div className="card p-8 text-center text-mute">Nessuna richiesta per ora. Arrivano dagli annunci con il lungo termine attivo.</div>}
      {leads.map((r) => {
        const [label, tone] = STATUS[r.status] ?? STATUS.new;
        const canReport = r.status !== "reported" && r.status !== "invalid" && now - Date.parse(r.created_at) < 7 * 86400_000;
        return (
          <article key={r.id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.listing?.title ?? "Annuncio"}</p>
                <p className="text-sm text-mute">{new Date(r.created_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" })}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-navy-50/60 p-4 text-sm">
                <p className="text-base font-semibold">{r.customer_name}</p>
                {r.customer_kind === "azienda" && <p className="text-mute">{r.company_name} · P.IVA {r.company_vat}</p>}
                <p className="mt-2"><a className="font-semibold text-navy-800 underline" href={`tel:${r.customer_phone.replace(/\s+/g, "")}`}>{r.customer_phone}</a></p>
                <p><a className="text-navy-800 underline" href={`mailto:${r.customer_email}`}>{r.customer_email}</a></p>
              </div>
              <div className="text-sm">
                <p><span className="text-mute">Durata:</span> {r.months} mesi · {r.km_per_year.toLocaleString("it-IT")} km/anno</p>
                <p><span className="text-mute">Servizi:</span> {r.services.length ? r.services.map((k) => LT_SERVICES.find((x) => x.key === k)?.label ?? k).join(", ") : "nessuno"}</p>
                <p className="mt-1"><span className="text-mute">Rata indicata:</span> <strong>{euro(r.monthly_cents)}/mese</strong></p>
                <p className="text-xs text-mute">Costo del contatto: {euro(r.fee_cents)}{r.status === "invalid" ? " (annullato)" : ""}</p>
              </div>
            </div>
            {r.note && <p className="rounded-xl border border-line p-3 text-sm">“{r.note}”</p>}
            {r.status === "reported" && <p className="text-sm text-amber-900">Segnalata: {r.report_reason}. La stiamo controllando.</p>}
            {r.status !== "reported" && r.status !== "invalid" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                {r.status === "new" && <StatusButton id={r.id} stato="contacted" label="Segna come contattato" main />}
                {r.status !== "closed" && <StatusButton id={r.id} stato="closed" label="Chiudi richiesta" />}
                {canReport && (
                  <details className="w-full sm:w-auto">
                    <summary className="cursor-pointer text-sm font-semibold text-amber-800">Segnala richiesta non valida</summary>
                    <form action={setLtStatus} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="stato" value="reported" />
                      <input name="motivo" required maxLength={500} placeholder="Es. numero inesistente" className="field min-w-56 flex-1 py-2 text-sm" />
                      <SubmitOnce className="btn-ghost px-4 py-2 text-sm" pendingText="Invio…">Invia</SubmitOnce>
                    </form>
                  </details>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function StatusButton({ id, stato, label, main = false }: { id: string; stato: string; label: string; main?: boolean }) {
  return (
    <form action={setLtStatus}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="stato" value={stato} />
      <SubmitOnce className={main ? "btn-primary px-4 py-2 text-sm" : "btn-ghost px-4 py-2 text-sm"} pendingText="Salvo…">{label}</SubmitOnce>
    </form>
  );
}
