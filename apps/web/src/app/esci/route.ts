import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const db = await userDb();
  await db.auth.signOut();
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safe, request.url), { status: 303 });
}
