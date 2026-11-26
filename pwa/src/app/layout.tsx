import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "VaultMusic",
  description: "Google Drive の音楽を、通信なしで聴く PWA",
  manifest: `${basePath}/manifest.webmanifest`,
  applicationName: "VaultMusic",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VaultMusic",
  },
  icons: { icon: `${basePath}/icon.svg` },
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
      <head>
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://content.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://drive.usercontent.google.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
