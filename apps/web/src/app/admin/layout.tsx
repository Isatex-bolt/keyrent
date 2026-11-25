import { Suspense } from "react";
import { getBadges } from "@/lib/badges";
import { ProNav, type NavSection } from "@/components/ProNav";

/* Menu admin con lo stesso stile dell'area noleggiatore: sezioni a sinistra, pagine a destra. */
const ADMIN: NavSection[] = [
  { section: "Account", items: [{ label: "Il mio profilo", href: "/admin/profilo" }] },
  { section: "Operatività", items: [
    { label: "Dashboard", href: "/admin", exact: true },
    { label: "Messaggi", href: "/admin/messaggi", badge: "admin_support" },
    { label: "Revisione annunci", href: "/admin/revisione", badge: "admin_reviews" },
  ] },
  { section: "Clienti", items: [
    { label: "Anagrafiche", href: "/admin/anagrafiche", badge: "admin_orgs" },
  ] },
  { section: "Sito", items: [
    { label: "Catalogo", href: "/admin/catalogo" },
    { label: "Contenuti home", href: "/admin/home" },
    { label: "Account demo", href: "/admin/demo" },
    { label: "Prenotazioni" }, { label: "Utenti interni" },
  ] },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <Suspense fallback={<div className="hidden lg:block" />}><Nav /></Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

async function Nav() {
  return <ProNav sections={ADMIN} title="Area admin" badges={await getBadges()} />;
}
