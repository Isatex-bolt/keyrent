import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { Thread } from "@/components/messages/Thread";

export const metadata = { title: "Conversazione" };

export default function Page({ params, searchParams }: PageProps<"/messaggi/[id]">) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Thread params={params} searchParams={searchParams} /></Suspense></div>;
}
