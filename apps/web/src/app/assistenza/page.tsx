import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportInbox } from "@/components/support/Support";

export const metadata = { title: "Assistenza" };

export default function Page({ searchParams }: PageProps<"/assistenza">) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><SupportInbox base="/assistenza" mode="user" searchParams={searchParams} /></Suspense></div>;
}
