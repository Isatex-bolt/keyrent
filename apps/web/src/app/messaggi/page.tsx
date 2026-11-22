import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { Inbox } from "@/components/messages/Inbox";

export const metadata = { title: "Messaggi" };

export default function Page() {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Inbox /></Suspense></div>;
}
