import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportThread } from "@/components/support/Support";

export const metadata = { title: "Assistenza" };

export default function Page({ params, searchParams }: PageProps<"/assistenza/[id]">) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><SupportThread params={params} searchParams={searchParams} base="/assistenza" mode="user" /></Suspense></div>;
}
