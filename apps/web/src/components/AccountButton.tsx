import Link from "next/link";
import { accountType, getUser, getMemberships, getStaffRole } from "@/lib/auth";
import { getBadges, providerTotal, adminTotal } from "@/lib/badges";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { MenuCloser } from "./MenuCloser";
import { LiveCount } from "./LiveCount";

const partner = (
  <Link href="/diventa-partner" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-mute hover:text-navy-900 sm:block">Sei un noleggiatore?</Link>
);
const linkCls = "hidden items-center rounded-lg px-3 py-2 text-sm font-medium text-mute hover:text-navy-900 sm:inline-flex";

export async function AccountButton() {
  const login = <div className="flex items-center gap-2">{partner}<Link href="/accedi" className="btn-ghost">Accedi</Link></div>;
  if (!isSupabaseConfigured()) return login;
  const user = await getUser();
  if (!user) return login;
  const [memberships, staff, b] = await Promise.all([getMemberships(), getStaffRole(), getBadges()]);
  const total = b.messages + b.customer_bookings + (memberships.length ? providerTotal(b) : 0) + (staff ? adminTotal(b) : 0) + (memberships.length ? 0 : b.support);
  const pro = accountType(user, memberships) === "provider";
  const who = (user.user_metadata?.first_name as string | undefined) || user.email?.split("@")[0] || "";
  const initials = [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).map((s) => String(s)[0]).join("").toUpperCase() || who.slice(0, 1).toUpperCase();
  // account del team KeyRent (senza attività): solo area admin e messaggi al team
  if (staff && memberships.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/admin" className={linkCls}>Area admin<LiveCount keys={["admin_reviews", "admin_orgs"]} initial={b.admin_reviews + b.admin_orgs} /></Link>
        <Link href="/admin/messaggi" className={linkCls}>Messaggi<LiveCount keys={["admin_support"]} initial={b.admin_support} /></Link>
        <details data-menu className="group relative">
          <summary className="btn-ghost cursor-pointer list-none gap-2 py-2 [&::-webkit-details-marker]:hidden">
            <span className="rounded-full bg-gradient-to-r from-navy-900 to-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Admin</span>
            <span className="max-w-[9rem] truncate">{who}</span>
            <LiveCount keys={["admin"]} initial={adminTotal(b)} />
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-mute transition group-open:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" /></svg>
          </summary>
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
            <p className="truncate px-3 py-2 text-xs text-mute">{user.email} · team KeyRent</p>
            <MenuLink href="/admin" label="Area admin" keys={["admin_reviews", "admin_orgs"]} n={b.admin_reviews + b.admin_orgs} />
            <MenuLink href="/admin/messaggi" label="Messaggi al team" keys={["admin_support"]} n={b.admin_support} />
            <Link href="/account/password" className="flex items-center rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-navy-50">Cambia password</Link>
            <form action="/esci" method="post" className="mt-1 border-t border-line pt-1">
              <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Esci</button>
            </form>
          </div>
        </details>
        <MenuCloser />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {staff && <Link href="/admin" className={linkCls}>Admin<LiveCount keys={["admin"]} initial={adminTotal(b)} /></Link>}
      <Link href={pro ? "/pro/messaggi" : "/messaggi"} className={linkCls}>Messaggi<LiveCount keys={["messages"]} initial={b.messages} /></Link>
      {pro && <Link href="/account" className={linkCls}>Le mie prenotazioni<LiveCount keys={["customer_bookings"]} initial={b.customer_bookings} /></Link>}
      <details data-menu className="group relative">
        <summary className="btn-ghost cursor-pointer list-none gap-2 py-2 [&::-webkit-details-marker]:hidden">
          {!pro ? (
            /* cliente: niente etichetta di ruolo, avatar con iniziali */
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-[11px] font-bold text-white">{initials}</span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pro ? "bg-navy-900 text-white" : "bg-teal-50 text-teal-600"}`}>
              {pro ? "Noleggiatore" : "Cliente"}
            </span>
          )}
          <span className="max-w-[9rem] truncate">{who}</span>
          <LiveCount keys={pro ? ["provider"] : ["customer_bookings", "support"]} initial={pro ? providerTotal(b) : b.customer_bookings + b.support} className="hidden sm:inline-flex" />
          <LiveCount keys={["messages", "customer_bookings", ...(memberships.length ? ["provider"] : ["support"]), ...(staff ? ["admin"] : [])]} initial={total} className="sm:hidden" />
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-mute transition group-open:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" /></svg>
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          <p className="truncate px-3 py-2 text-xs text-mute">{user.email}</p>
          {pro && <MenuLink href="/pro" label="Area noleggiatore" keys={["provider"]} n={providerTotal(b)} />}
          <MenuLink href={pro ? "/pro/messaggi" : "/messaggi"} label="Messaggi" keys={["messages"]} n={b.messages} />
          <MenuLink href="/account" label={pro ? "Le mie prenotazioni" : "Il mio account"} keys={["customer_bookings"]} n={b.customer_bookings} />
          <MenuLink href={pro ? "/pro/assistenza" : "/assistenza"} label="Assistenza KeyRent" keys={["support"]} n={b.support} />
          {staff && <MenuLink href="/admin" label="Admin" keys={["admin"]} n={adminTotal(b)} />}
          <Link href="/account/password" className="flex items-center rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-navy-50">Cambia password</Link>
          <form action="/esci" method="post" className="mt-1 border-t border-line pt-1">
            <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Esci</button>
          </form>
        </div>
      </details>
      <MenuCloser />
    </div>
  );
}

function MenuLink({ href, label, n, keys }: { href: string; label: string; n: number; keys: string[] }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-navy-50">
      {label}<LiveCount keys={keys} initial={n} />
    </Link>
  );
}
