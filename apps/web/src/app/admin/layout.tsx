import { SideNav, type NavItem } from "@/components/SideNav";

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/revisione", label: "Revisione annunci", badge: "admin_reviews" },
  { href: "/admin/anagrafiche", label: "Anagrafiche", badge: "admin_orgs" },
  { href: "/admin/foto", label: "Foto catalogo" },
  { href: "/admin/home", label: "Immagini home" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">Area KeyRent · staff</p>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <SideNav items={nav} footer="In arrivo: prenotazioni, catalogo, sorgenti dati, utenti interni." />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
