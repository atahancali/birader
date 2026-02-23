import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://birader.app"),
  title: "Birader",
  description: "Bugün ne içtin? Bira log'la, puanla, ısı haritanda gör.",
  openGraph: {
    title: "Birader",
    description: "Bira log'la, puanla, ısı haritanda gör.",
    url: "https://birader.app",
    siteName: "Birader",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Birader",
    description: "Bira log'la, puanla, ısı haritanda gör.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
