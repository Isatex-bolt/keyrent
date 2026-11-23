"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_V2_COOKIE } from "@/lib/v2/flag";

/** Accende/spegne l'anteprima V2 dell'header cliente solo su questo browser. */
export async function setPreviewV2(f: FormData) {
  const on = f.get("on") === "1";
  const jar = await cookies();
  if (on) jar.set(PREVIEW_V2_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  else jar.delete(PREVIEW_V2_COOKIE);
  redirect("/preview/customer-header-v2");
}
