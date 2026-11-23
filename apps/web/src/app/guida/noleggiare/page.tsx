import { Suspense } from "react";
import { Guide } from "@/components/guide/Guide";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Guida per noleggiare", description: "Come cercare, prenotare e pagare un noleggio su KeyRent, in pochi passaggi." };

export default function Page() {
  return (
    <Suspense fallback={<Guide path="cliente" viewer={{ loggedIn: false, provider: false }} />}>
      <WithViewer />
    </Suspense>
  );
}

async function WithViewer() {
  return <Guide path="cliente" viewer={await getViewer()} />;
}
