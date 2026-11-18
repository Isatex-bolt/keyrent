import Link from "next/link";
import { accountType, getUser, getMemberships, getStaffRole } from "@/lib/auth";
import { getBadges, providerTotal, adminTotal } from "@/lib/badges";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { Count } from "./Count";

const linkCls = "hidden items-center rounded-lg px-3 py-2 text-sm font-medium text-mute hover:text-navy-900 sm:inline-flex";

export async function AccountButton() {
  if (!isSupabaseConfigured()) return <Link href="/accedi" className="btn-ghost">Accedi</Link>;
  const user = await getUser();
  if (!user) return <Link href="/accedi" className="btn-ghost">Accedi</Link>;
  const [memberships, staff, b] = await Promise.all([getMemberships(), getStaffRole(), getBadges()]);
  const total = b.messages + b.customer_bookings + (memberships.length ? providerTotal(b) : 0) + (staff ? adminTotal(b) : 0);
  const pro = accountType(user, memberships) === "provider";
  const who = (user.user_metadata?.first_name as string | undefined) || user.email?.split("@")[0] || "";
  return (
    <div className="flex items-center gap-1">
      {staff && <Link href="/admin" className={linkCls}>Admin<Count n={adminTotal(b)} /></Link>}
      <Link href="/messaggi" className={linkCls}>Messaggi<Count n={b.messages} /></Link>
      {pro && <Link href="/account" className={linkCls}>Le mie prenotazioni<Count n={b.customer_bookings} /></Link>}
      <Link href={pro ? "/pro" : "/account"} className="btn-ghost gap-2 py-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pro ? "bg-navy-900 text-white" : "bg-teal-50 text-teal-600"}`}>
          {pro ? "Noleggiatore" : "Cliente"}
        </span>
        <span className="max-w-[9rem] truncate">{who}</span>
        <Count n={pro ? providerTotal(b) : b.customer_bookings} className="hidden sm:inline-flex" />
        <Count n={total} className="sm:hidden" />
      </Link>
    </div>
  );
}
