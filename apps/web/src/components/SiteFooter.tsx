import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy-950 text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm">Noleggio di auto, moto, bici, camper, barche e furgoni da operatori professionali verificati.</p>
        </div>
        <Col title="Per chi noleggia" links={[["Come funziona", "/guida"], ["I miei noleggi", "/account/noleggi"], ["Assistenza", "/assistenza"]]} />
        <Col title="Per chi mette a noleggio" links={[["Come funziona", "/guida"], ["Diventa partner", "/diventa-partner"], ["Gestisci la tua flotta", "/pro"]]} />
        <Col title="Informazioni" links={[["Termini e condizioni", "/termini"], ["Privacy", "/privacy"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © 2026 KeyRent.it è un servizio di <span className="text-white/90">ISATEX SRL</span> · P.IVA 00038630281 ·
            Via Vittorio Veneto, 95 · 35019 Tombolo (PD)
          </p>
          <Link href="/admin" className="text-white/40 hover:text-white">Area staff</Link>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="text-sm">
      <p className="mb-2 font-semibold text-white">{title}</p>
      <ul className="space-y-1.5">
        {links.map(([l, h]) => <li key={l + h}><Link href={h} className="hover:text-white">{l}</Link></li>)}
      </ul>
    </div>
  );
}
