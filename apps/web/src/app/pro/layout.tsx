import { SideNav, type NavItem } from "@/components/SideNav";

const nav: NavItem[] = [
  { href: "/pro", label: "Dashboard" },
  { href: "/pro/richieste", label: "Richieste", badge: "requests" },
  { href: "/pro/prenotazioni", label: "Prenotazioni", badge: "provider_bookings" },
  { href: "/messaggi", label: "Messaggi", badge: "messages" },
  { href: "/pro/mezzi", label: "I miei mezzi", badge: "listings_to_fix" },
  { href: "/pro/sedi", label: "Le mie sedi" },
  { href: "/pro/attivita", label: "La mia attività" },
];

export default function ProLayout({ children }: LayoutProps<"/pro">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">Area noleggiatore</p>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <SideNav items={nav} footer="In arrivo: incassi, statistiche, team." />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
