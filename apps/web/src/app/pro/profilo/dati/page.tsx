import { Suspense } from "react";
import { Dati } from "@/components/AccountDati";
import { Skeleton } from "@/components/ProPage";

export const metadata = { title: "Dati account" };

export default function Page({ searchParams }: PageProps<"/pro/profilo/dati">) {
  return <div className="max-w-xl"><Suspense fallback={<Skeleton />}><Dati searchParams={searchParams} base="/pro" /></Suspense></div>;
}
