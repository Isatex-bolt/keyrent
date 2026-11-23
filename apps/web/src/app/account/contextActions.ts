"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CTX_COOKIE, getBusinessProfiles, requireUser } from "@/lib/auth";

/** Sceglie per chi prenota il cliente: personale ("") o una delle sue aziende. */
export async function setBookingContext(f: FormData) {
  await requireUser();
  const id = String(f.get("ctx") ?? "");
  const back = String(f.get("back") ?? "/account");
  const jar = await cookies();
  const orgs = id ? await getBusinessProfiles() : [];
  if (id && orgs.some((o) => o.id === id)) jar.set(CTX_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  else jar.delete(CTX_COOKIE);
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/account");
}
