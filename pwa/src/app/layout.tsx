import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultMusic",
  description: "Google Drive の音楽を、通信なしで聴く PWA",
  manifest: "/manifest.webmanifest",
  applicationName: "VaultMusic",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VaultMusic",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
