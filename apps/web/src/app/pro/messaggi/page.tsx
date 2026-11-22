import { Suspense } from "react";
import { Skeleton } from "@/components/ProPage";
import { Inbox } from "@/components/messages/Inbox";

export const metadata = { title: "Messaggi" };

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Inbox base="/pro/messaggi" /></Suspense>;
}
