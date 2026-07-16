import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://useclasp.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Clasp — Connect apps to Fiber wallets. Never hand over the keys.",
  description:
    "Clasp is the secure application-to-wallet session layer for Fiber Network: pair, review, approve, and pay with limited, user-edited, time-boxed, revocable authority — no private keys, no permanent credentials.",
  openGraph: {
    title: "Clasp — the app-to-wallet session layer for Fiber",
    description:
      "Limited, user-edited, time-boxed, revocable wallet authority. Pair → Review → Approve → Pay → Block the attack → Revoke.",
    type: "website",
    url: siteUrl,
    siteName: "Clasp",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clasp — Connect apps to Fiber wallets. Never hand over the keys.",
    description: "The secure app-to-wallet session layer for Fiber — limited, user-edited, revocable authority.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
