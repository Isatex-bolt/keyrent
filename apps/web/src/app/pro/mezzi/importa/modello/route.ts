import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { buildTemplate } from "@/lib/importSheet";
import { importCats } from "../cats";

export async function GET() {
  const { membership } = await requireProvider("/pro/mezzi/importa");
  if (!membership) return new Response("Nessuna attività", { status: 403 });
  const db = await userDb();
  const { data: locations } = await db.from("locations").select("id, name, city")
    .eq("organization_id", membership.organization_id).eq("active", true).order("created_at");
  const buf = await buildTemplate(locations ?? [], await importCats());
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="KeyRent-mezzi.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
