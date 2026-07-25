import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { BootSequence } from "@/components/BootSequence";
import { SegmentGlowDefs } from "@/components/SegmentDisplay";

export const metadata: Metadata = {
  title: "音域アタック",
  description:
    "自分の音域を測定して、歌いたい曲の最適キーを知る。高音トレーニングで音域を広げるカラオケ攻略アプリ。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "音域アタック",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#15171C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <SegmentGlowDefs />
        <BootSequence />
        <div className="app-shell">{children}</div>
        <Nav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
