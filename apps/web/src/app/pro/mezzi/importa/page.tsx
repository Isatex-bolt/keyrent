import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { ProHeader, Skeleton } from "@/components/ProPage";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Importa da Excel" };
export const maxDuration = 120;

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Import /></Suspense>;
}

async function Import() {
  const { membership } = await requireProvider("/pro/mezzi/importa");
  if (!membership) redirect("/pro");
  if (!canEdit(membership)) redirect("/pro/mezzi");
  return (
    <div className="space-y-5">
      <ProHeader title="Importa mezzi da Excel" subtitle="Per chi ha tanti mezzi: compili un file e trovi tutti gli annunci pronti come bozze."
        action={<Link href="/pro/mezzi" className="btn-ghost">← I miei mezzi</Link>} />
      <ImportClient />
    </div>
  );
}
