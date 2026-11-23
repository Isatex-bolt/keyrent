import { Suspense } from "react";
import { ProfileView } from "@/components/ProfileView";

export const metadata = { title: "Profilo" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><ProfileView /></Suspense>
    </div>
  );
}
