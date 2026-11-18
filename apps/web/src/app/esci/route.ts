import { NextResponse, type NextRequest } from "next/server";
import { userDb } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const db = await userDb();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
