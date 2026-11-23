import { Suspense } from "react";
import { Guide } from "@/components/guide/Guide";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Guida per noleggiatori", description: "Come pubblicare i tuoi mezzi e gestire flotta, disponibilità e prenotazioni con KeyRent." };

export default function Page() {
  return (
    <Suspense fallback={<Guide path="noleggiatore" viewer={{ loggedIn: false, provider: false }} />}>
      <WithViewer />
    </Suspense>
  );
}

async function WithViewer() {
  return <Guide path="noleggiatore" viewer={await getViewer()} />;
}
