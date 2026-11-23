import type { Metadata } from "next";

/* Area di prova: non indicizzata e non collegata dal sito. */
export const metadata: Metadata = { title: "Preview checkout V2", robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
