import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DemoBar } from "@/components/DemoBar";
import { DemoInvite } from "@/components/DemoInvite";
import { BottomNav } from "@/components/v2/customer/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://keyrent.it"),
  title: { default: "KeyRent · Noleggio auto, moto, bici, camper e barche", template: "%s · KeyRent" },
  description: "Trova e prenota mezzi a noleggio da operatori professionali verificati: auto, moto, bici, camper, barche, furgoni.",
};

export const viewport: Viewport = { themeColor: "#011938", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <Suspense fallback={null}><DemoBar /></Suspense>
        <Suspense fallback={null}><DemoInvite /></Suspense>
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Suspense><BottomNav /></Suspense>
      </body>
    </html>
  );
}
