import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportThread } from "@/components/support/Support";

export const metadata = { title: "Messaggio" };

export default function Page({ params, searchParams }: PageProps<"/admin/messaggi/[id]">) {
  return <Suspense fallback={<Skeleton />}><SupportThread params={params} searchParams={searchParams} base="/admin/messaggi" mode="staff" /></Suspense>;
}
