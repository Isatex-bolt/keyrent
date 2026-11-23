import { Suspense } from "react";
import { Dati } from "@/components/AccountDati";

export const metadata = { title: "Profilo privato" };

export default function Page({ searchParams }: PageProps<"/account/dati">) {
  return <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Dati searchParams={searchParams} base="/account" /></Suspense></div>;
}
