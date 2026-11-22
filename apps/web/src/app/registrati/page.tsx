import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormError } from "@/components/AuthCard";
import { OrgFields } from "@/components/OrgFields";
import { signUp } from "../accedi/actions";

export const metadata = { title: "Registrati" };

export default function Page({ searchParams }: PageProps<"/registrati">) {
  return <Suspense><SignUp searchParams={searchParams} /></Suspense>;
}

type Choice = { href: string; icon: string; title: string; text: string };

function Choices({ items }: { items: Choice[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <Link key={c.href} href={c.href}
          className="group flex flex-col gap-2 rounded-2xl border-2 border-line bg-white p-5 transition hover:border-teal-500 hover:bg-teal-50/50 hover:shadow-md">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-2xl">{c.icon}</span>
          <span className="text-lg font-bold text-navy-900">{c.title}</span>
          <span className="text-sm text-mute">{c.text}</span>
          <span className="mt-auto pt-2 text-sm font-semibold text-teal-600 group-hover:underline">Continua →</span>
        </Link>
      ))}
    </div>
  );
}

const Back = ({ href }: { href: string }) => (
  <Link href={href} className="mb-4 inline-block text-sm text-mute hover:text-navy-900">← Indietro</Link>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4">
    <legend className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-teal-600">{title}</legend>
    {children}
  </fieldset>
);

function Account({ pro }: { pro?: boolean }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="first_name">{pro ? "Nome del referente" : "Nome"}</label>
          <input id="first_name" name="first_name" required autoComplete="given-name" className="field" /></div>
        <div><label className="label" htmlFor="last_name">{pro ? "Cognome del referente" : "Cognome"}</label>
          <input id="last_name" name="last_name" required autoComplete="family-name" className="field" /></div>
      </div>
      <div><label className="label" htmlFor="phone">Cellulare {pro ? "" : "(facoltativo)"}</label>
        <input id="phone" name="phone" type="tel" required={pro} autoComplete="tel" className="field" /></div>
      <div><label className="label" htmlFor="email">Email per accedere</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="password">Password (almeno 8 caratteri)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" /></div>
    </>
  );
}

function Terms() {
  return (
    <label className="flex items-start gap-2 text-sm text-mute">
      <input type="checkbox" name="terms" required className="mt-1" />
      <span>Accetto i <Link href="/termini" className="text-teal-600">termini</Link> e l&apos;<Link href="/privacy" className="text-teal-600">informativa privacy</Link>.</span>
    </label>
  );
}

async function SignUp({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const n = next ? `&next=${encodeURIComponent(next)}` : "";
  const errore = typeof sp.errore === "string" ? sp.errore : undefined;
  const tipo = sp.tipo === "noleggiatore" ? "noleggiatore" : sp.tipo === "cliente" ? "cliente" : null;
  const come = sp.come === "azienda" ? "azienda" : sp.come === "privato" ? "privato" : null;
  const login = (
    <p className="mt-6 text-center text-sm text-mute">
      Hai già un account? <Link href={`/accedi${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-teal-600">Accedi</Link>
    </p>
  );

  // 1 · cosa vuoi fare
  if (!tipo) {
    return (
      <AuthCard wide title="Crea il tuo account KeyRent" subtitle="Scegli come vuoi usare KeyRent.">
        <FormError message={errore} />
        <Choices items={[
          { href: `/registrati?tipo=cliente${n}`, icon: "🔑", title: "Voglio noleggiare", text: "Auto, moto, bici, camper, barche e furgoni da noleggiatori professionali verificati." },
          { href: `/registrati?tipo=noleggiatore${n}`, icon: "🏢", title: "Metto a noleggio", text: "Sei un'attività con partita IVA e vuoi pubblicare i tuoi mezzi su KeyRent." },
        ]} />
        {login}
      </AuthCard>
    );
  }

  // 2a · cliente: privato o azienda
  if (tipo === "cliente" && !come) {
    return (
      <AuthCard wide title="Sei un privato o un'azienda?" subtitle="Così ti chiediamo solo i dati che servono.">
        <Back href={`/registrati${next ? `?next=${encodeURIComponent(next)}` : ""}`} />
        <Choices items={[
          { href: `/registrati?tipo=cliente&come=privato${n}`, icon: "🙋", title: "Privato", text: "Noleggio per me, per una vacanza o un'uscita." },
          { href: `/registrati?tipo=cliente&come=azienda${n}`, icon: "💼", title: "Azienda", text: "Noleggio per la mia attività, con fattura intestata all'azienda." },
        ]} />
        {login}
      </AuthCard>
    );
  }

  // 3 · i moduli
  const pro = tipo === "noleggiatore";
  return (
    <AuthCard wide={pro || come === "azienda"}
      title={pro ? "Registra la tua attività" : come === "azienda" ? "Account aziendale" : "Account privato"}
      subtitle={pro
        ? "Per noleggiatori professionali con P.IVA. Verifichiamo i dati prima di pubblicare i tuoi mezzi."
        : "Gratuito. Per prenotare mezzi da noleggiatori professionali verificati."}>
      <Back href={pro ? `/registrati${next ? `?next=${encodeURIComponent(next)}` : ""}` : `/registrati?tipo=cliente${n}`} />
      <FormError message={errore} />
      <form action={signUp} className="space-y-8">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="come" value={come ?? ""} />
        {pro && <Section title="La tua attività"><OrgFields /></Section>}
        {come === "azienda" && (
          <Section title="La tua azienda">
            <div><label className="label" htmlFor="company_name">Ragione sociale</label>
              <input id="company_name" name="company_name" required autoComplete="organization" className="field" /></div>
            <div><label className="label" htmlFor="vat_number">Partita IVA</label>
              <input id="vat_number" name="vat_number" required placeholder="IT01234567890" className="field" /></div>
          </Section>
        )}
        <Section title={pro || come === "azienda" ? "Referente e accesso" : "I tuoi dati"}><Account pro={pro} /></Section>
        <div className="space-y-4">
          <Terms />
          <button className="btn-primary w-full">{pro ? "Registra attività" : "Crea account"}</button>
          {pro && <p className="text-center text-xs text-mute">Ti mandiamo un'email di conferma: dopo il clic l'attività è creata e puoi aggiungere sedi e mezzi.</p>}
        </div>
      </form>
      {login}
    </AuthCard>
  );
}
