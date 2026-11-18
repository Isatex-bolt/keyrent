import Link from "next/link";

const nav = [
  ["/pro", "Dashboard"], ["/pro/mezzi", "I miei mezzi"], ["/pro/sedi", "Le mie sedi"], ["/pro/attivita", "La mia attività"],
] as const;

export default function ProLayout({ children }: LayoutProps<"/pro">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">Area noleggiatore</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink/80 hover:bg-white hover:text-navy-900">{label}</Link>
          ))}
          <span className="hidden px-3.5 pt-3 text-xs text-mute lg:block">In arrivo: richieste, prenotazioni, incassi, statistiche, team.</span>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
