import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { Thread } from "@/components/messages/Thread";

export const metadata = { title: "Conversazione" };

export default function Page({ params, searchParams }: PageProps<"/pro/messaggi/[id]">) {
  return <Suspense fallback={<Skeleton />}><Thread params={params} searchParams={searchParams} base="/pro/messaggi" /></Suspense>;
}
