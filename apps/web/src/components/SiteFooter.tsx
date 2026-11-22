import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy-950 text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm">Noleggio di auto, moto, bici, camper, barche e furgoni da operatori professionali verificati.</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">KeyRent</p>
          <ul className="space-y-1.5">
            <li><Link href="/come-funziona" className="hover:text-white">Come funziona</Link></li>
            <li><Link href="/diventa-partner" className="hover:text-white">Diventa partner</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Informazioni</p>
          <ul className="space-y-1.5">
            <li><Link href="/termini" className="hover:text-white">Termini e condizioni</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
          </ul>
        </div>
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
