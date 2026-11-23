import { Suspense } from "react";
import { ProfileView } from "@/components/ProfileView";
import { Skeleton } from "@/components/ProPage";

export const metadata = { title: "Il mio profilo" };

/* Stessa pagina del profilo, dentro l'area noleggiatore (menu a sinistra). */
export default function Page() {
  return <div className="max-w-2xl"><Suspense fallback={<Skeleton />}><ProfileView base="/pro" /></Suspense></div>;
}
