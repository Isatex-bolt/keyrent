import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { SubmitOnce } from "@/components/SubmitOnce";
import { resolveLt } from "@/app/lungo-termine/actions";

export const metadata = { title: "Contatti lungo termine" };

export default function Page({ searchParams }: PageProps<"/admin/lungo-termine">) {
  return <Suspense fallback={<Skeleton />}><Leads searchParams={searchParams} /></Suspense>;
}

type Row = { id: string; created_at: string; customer_name: string; monthly_cents: number; fee_cents: number; status: string;
  report_reason: string | null; organization_id: string; org: { legal_name: string; trade_name: string | null } | null; listing: { title: string } | null };

/** Mese in ora di Roma, "2026-11". */
const monthOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }).slice(0, 7);

async function Leads({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const today = monthOf(new Date().toISOString());
  const month = typeof sp.mese === "string" && /^\d{4}-\d{2}$/.test(sp.mese) ? sp.mese : today;
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1) - 2 * 3600_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 2 * 3600_000).toISOString();
  const db = await userDb();
  const { data, error } = await db.from("lt_requests")
    .select("id, created_at, customer_name, monthly_cents, fee_cents, status, report_reason, organization_id, org:organizations(legal_name, trade_name), listing:listings(title)")
    .gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false });
  if (error) throw new Error(`Contatti non caricati: ${error.message}`);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => monthOf(r.created_at) === month);
  const { data: rep } = await db.from("lt_requests")
    .select("id, created_at, customer_name, monthly_cents, fee_cents, status, report_reason, organization_id, org:organizations(legal_name, trade_name), listing:listings(title)")
    .eq("status", "reported").order("reported_at");
  const reported = (rep ?? []) as unknown as Row[];

  // da fatturare: tutto tranne le segnalate in attesa e quelle annullate
  const byOrg = new Map<string, { name: string; count: number; fee: number; pending: number }>();
  for (const r of rows) {
    const o = byOrg.get(r.organization_id) ?? { name: r.org?.trade_name || r.org?.legal_name || "—", count: 0, fee: 0, pending: 0 };
    if (r.status === "reported") o.pending++;
    else if (r.status !== "invalid") { o.count++; o.fee += r.fee_cents; }
    byOrg.set(r.organization_id, o);
  }
  const shift = (k: number) => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const totals = [...byOrg.values()].reduce((a, o) => ({ count: a.count + o.count, fee: a.fee + o.fee }), { count: 0, fee: 0 });
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <ProHeader title="Contatti lungo termine" subtitle="5% della prima rata per ogni richiesta valida: il riepilogo del mese è la base per la fattura a ogni noleggiatore." />
      <Flash sp={sp} ok={{ deciso: "Segnalazione decisa." }} />
      {reported.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Segnalazioni da decidere ({reported.length})</h2>
          {reported.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{r.org?.trade_name || r.org?.legal_name} · {r.listing?.title}</p>
                <p className="text-mute">{r.customer_name} · motivo: “{r.report_reason}”</p>
              </div>
              <div className="flex gap-2">
                {[["invalida", "Non valida: non si paga", "btn-primary"], ["valida", "Valida: si paga", "btn-ghost"]].map(([v, t, c]) => (
                  <form key={v} action={resolveLt}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="esito" value={v} />
                    <SubmitOnce className={`${c} px-3 py-2 text-sm`} pendingText="…">{t}</SubmitOnce></form>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/admin/lungo-termine?mese=${shift(-1)}`} className="btn-ghost px-3 py-2 text-sm">←</Link>
          <h2 className="font-semibold capitalize">{label}</h2>
          <Link href={`/admin/lungo-termine?mese=${shift(1)}`} className="btn-ghost px-3 py-2 text-sm">→</Link>
        </div>
        {!byOrg.size ? <p className="text-center text-mute">Nessun contatto in questo mese.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-mute"><th className="py-2">Noleggiatore</th><th className="py-2 text-right">Contatti validi</th><th className="py-2 text-right">Da fatturare</th></tr></thead>
            <tbody>
              {[...byOrg.values()].sort((a, b) => b.fee - a.fee).map((o) => (
                <tr key={o.name} className="border-t border-line">
                  <td className="py-2">{o.name}{o.pending ? <span className="ml-2 text-xs text-amber-800">{o.pending} in verifica</span> : null}</td>
                  <td className="py-2 text-right">{o.count}</td>
                  <td className="py-2 text-right font-semibold">{euro(o.fee)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-navy-900 font-semibold"><td className="py-2">Totale</td><td className="py-2 text-right">{totals.count}</td><td className="py-2 text-right">{euro(totals.fee)}</td></tr>
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-mute">Importi IVA esclusa, calcolati sulla rata indicata dal cliente al momento della richiesta.</p>
      </section>
      {rows.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Dettaglio del mese</h2>
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{new Date(r.created_at).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })} · {r.org?.trade_name || r.org?.legal_name} · {r.listing?.title} · {r.customer_name}</span>
                <span className={r.status === "invalid" ? "text-mute line-through" : "font-semibold"}>{euro(r.fee_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
