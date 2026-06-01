import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Privacy-friendly Plausible analytics. Only loads when the env var is set —
// set NEXT_PUBLIC_PLAUSIBLE_DOMAIN (e.g. "swells.app") in the Production
// environment only, so local dev and preview deploys aren't tracked.
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://swells.app"),
  title: {
    default: "Swells — Sense what's shifting before it becomes obvious",
    template: "%s | Swells",
  },
  description:
    "A platform for observations, signals, and reflections. Helping individuals, organisations, and systems sense what's emerging — before it becomes obvious.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Swells",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${dmSans.variable} ${cormorant.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
