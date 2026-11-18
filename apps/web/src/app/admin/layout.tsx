import Link from "next/link";

const nav = [["/admin", "Dashboard"], ["/admin/revisione", "Revisione annunci"], ["/admin/anagrafiche", "Anagrafiche"]] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">Area KeyRent · staff</p>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink/80 hover:bg-white hover:text-navy-900">{label}</Link>
          ))}
          <span className="hidden px-3.5 pt-3 text-xs text-mute lg:block">In arrivo: prenotazioni, catalogo, sorgenti dati, utenti interni.</span>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
