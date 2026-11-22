import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportInbox } from "@/components/support/Support";

export const metadata = { title: "Assistenza KeyRent" };

export default function Page({ searchParams }: PageProps<"/pro/assistenza">) {
  return <Suspense fallback={<Skeleton />}><SupportInbox base="/pro/assistenza" mode="user" searchParams={searchParams} /></Suspense>;
}
