import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCapabilities, getMemberships, getUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";

export const metadata = { title: "Profilo" };

/*
 * Profilo: tre cose diverse, mai confuse.
 *  · PRIVATO  = noleggio come persona (profiles.rents_personally)
 *  · AZIENDA  = noleggio per un'azienda cliente (organizations kind 'renter')
 *  · ATTIVITÀ DI NOLEGGIO = chi pubblica mezzi (organizations kind 'provider')
 * Un noleggiatore puro vede Account + Attività di noleggio, senza blocchi da cliente.
 */
export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Profile /></Suspense>
    </div>
  );
}

type Org = { id: string; legal_name: string; trade_name: string | null; vat_number: string; tax_code: string | null; sdi_code: string | null;
  pec: string | null; business_email: string | null; business_phone: string | null; legal_address: Record<string, string> | null; verification_status?: string };

const dateIt = (d: string | null) => (d ? new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)) : null);
const addr = (a: Record<string, string> | null) => {
  if (!a) return null;
  const line = [a.street, [a.postal_code, a.city].filter(Boolean).join(" "), a.province && `(${a.province})`].filter(Boolean).join(", ");
  return line || null;
};

async function Profile() {
  const user = await getUser();
  if (!user) redirect("/accedi?next=/account/profilo");
  const db = await userDb();
  const [caps, memberships, { data: p }] = await Promise.all([
    getCapabilities(), getMemberships(),
    db.from("profiles").select("first_name, last_name, phone, birth_date, driving_license_since").eq("id", user.id).maybeSingle(),
  ]);
  const ids = [...caps.aziende.map((a) => a.id), ...memberships.map((m) => m.organization_id)];
  const [{ data: orgRows }, { count: sedi }] = await Promise.all([
    ids.length
      ? db.from("organizations").select("id, legal_name, trade_name, vat_number, tax_code, sdi_code, pec, business_email, business_phone, legal_address, verification_status").in("id", ids)
      : Promise.resolve({ data: [] as Org[] }),
    memberships[0]
      ? db.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", memberships[0].organization_id)
      : Promise.resolve({ count: 0 }),
  ]);
  const byId = new Map(((orgRows ?? []) as Org[]).map((o) => [o.id, o]));
  const aziende = caps.aziende.map((a) => byId.get(a.id)).filter((o): o is Org => !!o);
  const attivita = memberships[0] ? byId.get(memberships[0].organization_id) ?? null : null;

  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const initials = `${p?.first_name?.[0] ?? ""}${p?.last_name?.[0] ?? ""}`.toUpperCase();
  // noleggiatore puro: nessun profilo da cliente → niente blocchi Privato / Azienda
  const pureProvider = caps.noleggiatore && !caps.privato && aziende.length === 0;
  const missingPrivate = [!p?.phone && "telefono", !p?.first_name && "nome", !p?.last_name && "cognome"].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-xl font-bold text-white">{initials || "?"}</span>
        <div className="min-w-0"><p className="truncate text-xl font-bold">{name || "Il tuo account"}</p><p className="truncate text-sm text-mute">{user.email}</p></div>
      </div>

      {pureProvider ? (
        <Card title="Account" status="ok" rows={[["Nome", name || "—"], ["Email di accesso", user.email ?? "—"], ["Telefono", p?.phone || "—"]]}
          actions={[["Modifica dati", "/pro/profilo"]]} />
      ) : (
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-mute">I tuoi profili per noleggiare</h2>

          {caps.privato ? (
            <Card title="Privato" status={missingPrivate.length ? `Completa ${missingPrivate.length} ${missingPrivate.length === 1 ? "informazione" : "informazioni"}` : "ok"}
              heading={name || undefined}
              rows={[["Email", user.email ?? "—"], ["Telefono", p?.phone || "—"], ["Data di nascita", dateIt(p?.birth_date ?? null) ?? "—"],
                ["Patente dal", dateIt(p?.driving_license_since ?? null) ?? "—"], ["Documenti", "Richiesti solo se servono per il mezzo"]]}
              actions={[[missingPrivate.length ? "Completa profilo" : "Modifica dati", "/account/dati"]]} />
          ) : !caps.noleggiatore && (
            <AddCard title="Privato" text="Noleggia mezzi per uso personale." cta="Aggiungi profilo privato" href="/account/privato" />
          )}

          {aziende.map((o) => (
            <Card key={o.id} title="Azienda" status={o.sdi_code || o.pec ? "ok" : "Completa i dati di fatturazione"} heading={o.trade_name ?? o.legal_name}
              rows={[["Ragione sociale", o.legal_name], ["Partita IVA", o.vat_number], ...(o.tax_code ? [["Codice fiscale", o.tax_code] as [string, string]] : []),
                ["Codice SDI", o.sdi_code || "—"], ["PEC", o.pec || "—"], ["Indirizzo di fatturazione", addr(o.legal_address) ?? "—"],
                ["Email amministrativa", o.business_email || "—"], ["Telefono", o.business_phone || "—"]]}
              actions={[["Modifica dati azienda", `/account/azienda/dati?id=${o.id}`], ["Spese e noleggi", "/account/azienda"]]} />
          ))}
          {aziende.length === 0 && !caps.noleggiatore && (
            <AddCard title="Azienda" text="Noleggia mezzi per la tua attività e usa i dati aziendali per fatture e documenti." cta="Aggiungi profilo azienda" href="/account/azienda/dati" />
          )}
        </section>
      )}

      {attivita && (
        <section className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-mute">Per mettere a noleggio</h2>
          <Card title="Attività di noleggio" heading={attivita.trade_name ?? attivita.legal_name}
            status={attivita.verification_status === "verified" ? "Verificata" : "In verifica"}
            rows={[["Ragione sociale", attivita.legal_name], ["Partita IVA", attivita.vat_number], ["Sede legale", addr(attivita.legal_address) ?? "—"],
              ["Sedi operative", String(sedi ?? 0)], ["Email", attivita.business_email || "—"]]}
            actions={[["Vai all'area noleggiatore", "/pro"], ["Dati attività", "/pro/attivita"]]} dark />
        </section>
      )}

      <Group title="Account" items={[["Email di accesso", "", user.email ?? ""], ["Cambia password", "/account/password"]]} />
      {!pureProvider && (
        <Group title="Pagamenti e documenti" items={[["Metodi di pagamento", "", "Carta, al momento della prenotazione"], ["Documenti", "", "In arrivo"], ["Indirizzi salvati", "", "In arrivo"]]} />
      )}
      <Group title="KeyRent" items={[["Assistenza", pureProvider ? "/pro/assistenza" : "/assistenza"], ["Come funziona", "/guida"], ["Cancellazioni e pagamenti", "/termini"], ["Privacy", "/privacy"],
        ...(!caps.noleggiatore ? [["Metti a noleggio i tuoi mezzi", "/diventa-partner"] as [string, string]] : [])]} />
      <form action="/esci" method="post"><button className="min-h-12 w-full rounded-2xl border border-line bg-white py-3.5 font-semibold text-red-700">Esci</button></form>
    </div>
  );
}

function Card({ title, heading, status, rows, actions, dark = false }: {
  title: string; heading?: string; status?: string; rows: [string, string][]; actions: [string, string][]; dark?: boolean;
}) {
  const ok = status === "ok" || status === "Verificata";
  return (
    <div className={`overflow-hidden rounded-3xl border ${dark ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>
      <div className="space-y-1 px-5 pb-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-bold uppercase tracking-[0.14em] ${dark ? "text-teal-400" : "text-teal-600"}`}>{title}</p>
          {status && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? (dark ? "bg-white/10 text-teal-400" : "bg-teal-50 text-teal-600") : "bg-amber-50 text-amber-900"}`}>
              {status === "ok" ? "✓ Profilo completo" : ok ? `✓ ${status}` : status}
            </span>
          )}
        </div>
        {heading && <p className="text-xl font-bold tracking-tight">{heading}</p>}
      </div>
      <dl className={`divide-y px-5 ${dark ? "divide-white/10" : "divide-line"}`}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
            <dt className={dark ? "text-white/60" : "text-mute"}>{k}</dt>
            <dd className="min-w-0 break-words text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {actions.map(([label, href], i) => (
          <Link key={href} href={href}
            className={`flex min-h-12 items-center justify-center rounded-2xl px-4 text-[15px] font-semibold ${
              i === 0 ? (dark ? "bg-teal-500 text-navy-950" : "bg-navy-900 text-white") : dark ? "bg-white/10 text-white" : "border border-line text-navy-900"}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function AddCard({ title, text, cta, href }: { title: string; text: string; cta: string; href: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-navy-900/20 bg-white/60 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">{title}</p>
      <p className="mt-2 text-[15px] text-mute">{text}</p>
      <Link href={href} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal-500 px-4 text-[15px] font-semibold text-navy-950">
        <span aria-hidden className="text-lg leading-none">+</span> {cta}
      </Link>
    </div>
  );
}

function Group({ title, items }: { title: string; items: [string, string, string?][] }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-mute">{title}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {items.map(([label, href, hint]) => (
          <li key={label}>
            {href ? (
              <Link href={href} className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] active:bg-navy-50 hover:bg-navy-50/50">
                <span>{label}</span><span className="flex items-center gap-2 text-sm text-mute">{hint}<span aria-hidden>›</span></span>
              </Link>
            ) : (
              <span className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] text-mute/80">
                <span>{label}</span><span className="text-right text-xs">{hint ?? "In arrivo"}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
