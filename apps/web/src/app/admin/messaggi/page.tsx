import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportInbox } from "@/components/support/Support";

export const metadata = { title: "Messaggi" };

export default function Page({ searchParams }: PageProps<"/admin/messaggi">) {
  return <Suspense fallback={<Skeleton />}><SupportInbox base="/admin/messaggi" mode="staff" searchParams={searchParams} /></Suspense>;
}
