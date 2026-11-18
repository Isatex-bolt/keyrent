import Link from "next/link";
import { getUser, getMemberships, getStaffRole } from "@/lib/auth";
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
  return (
    <div className="flex items-center gap-1">
      {staff && <Link href="/admin" className={linkCls}>Admin<Count n={adminTotal(b)} /></Link>}
      {memberships.length > 0 && <Link href="/pro" className={linkCls}>Area noleggiatore<Count n={providerTotal(b)} /></Link>}
      <Link href="/messaggi" className={linkCls}>Messaggi<Count n={b.messages} /></Link>
      <Link href="/account" className="btn-ghost">
        Il mio account
        <Count n={b.customer_bookings} className="hidden sm:inline-flex" />
        <Count n={total} className="sm:hidden" />
      </Link>
    </div>
  );
}
