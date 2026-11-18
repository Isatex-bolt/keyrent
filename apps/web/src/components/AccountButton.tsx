import Link from "next/link";
import { getUser, getMemberships, getStaffRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/public";

export async function AccountButton() {
  if (!isSupabaseConfigured()) return <Link href="/accedi" className="btn-ghost">Accedi</Link>;
  const user = await getUser();
  if (!user) return <Link href="/accedi" className="btn-ghost">Accedi</Link>;
  const [memberships, staff] = await Promise.all([getMemberships(), getStaffRole()]);
  return (
    <div className="flex items-center gap-1.5">
      {staff && <Link href="/admin" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-mute hover:text-navy-900 sm:block">Admin</Link>}
      {memberships.length > 0 && <Link href="/pro" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-mute hover:text-navy-900 sm:block">Area noleggiatore</Link>}
      <Link href="/account" className="btn-ghost">Il mio account</Link>
    </div>
  );
}
