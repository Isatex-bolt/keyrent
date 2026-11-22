import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { SupportThread } from "@/components/support/Support";

export const metadata = { title: "Assistenza KeyRent" };

export default function Page({ params, searchParams }: PageProps<"/pro/assistenza/[id]">) {
  return <Suspense fallback={<Skeleton />}><SupportThread params={params} searchParams={searchParams} base="/pro/assistenza" mode="user" /></Suspense>;
}
