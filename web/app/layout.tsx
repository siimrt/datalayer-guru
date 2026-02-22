import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const title = "TrackPulse — Ecommerce Tracking Inspector & Event Generator";
const description =
  "Detect CMS, extract ecommerce data, generate & audit GA4, Meta, TikTok and Pinterest tracking events — all from one Chrome side panel. Free Chrome extension.";

export const metadata: Metadata = {
  metadataBase: new URL("https://trackpulse.dev"),
  title,
  description,
  keywords: [
    "tracking audit",
    "GA4 event generator",
    "Meta Pixel debugger",
    "TikTok Pixel",
    "Pinterest Tag",
    "ecommerce tracking",
    "dataLayer inspector",
    "Shopify tracking",
    "WooCommerce tracking",
    "Chrome extension",
    "GTM debugger",
    "tracking inspector",
  ],
  authors: [{ name: "TrackPulse" }],
  creator: "TrackPulse",
  openGraph: {
    title,
    description,
    url: "https://trackpulse.dev",
    siteName: "TrackPulse",
    images: [{ url: "/og-image.png", width: 920, height: 680, alt: title }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "https://trackpulse.dev",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "TrackPulse",
              applicationCategory: "BrowserApplication",
              operatingSystem: "Chrome",
              description,
              url: "https://trackpulse.dev",
              offers: [
                {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                  name: "Free",
                },
                {
                  "@type": "Offer",
                  price: "9",
                  priceCurrency: "USD",
                  name: "Starter",
                  billingIncrement: "P1M",
                },
                {
                  "@type": "Offer",
                  price: "19",
                  priceCurrency: "USD",
                  name: "Pro",
                  billingIncrement: "P1M",
                },
                {
                  "@type": "Offer",
                  price: "49",
                  priceCurrency: "USD",
                  name: "Agency",
                  billingIncrement: "P1M",
                },
              ],
              screenshot: "https://trackpulse.dev/og-image.png",
              featureList:
                "CMS Detection, Event Generation, DataLayer Live, Pixel Detection, Event Audit, Funnel Mode, Push to Custom Pixel",
              softwareVersion: "2.0.0",
              browserRequirements: "Requires Chrome 116+",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Is TrackPulse free?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes! The free plan includes CMS detection, basic GA4 event generation, dataLayer live view, pixel detection, and 5 audits per day.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Which CMS platforms are supported?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "TrackPulse auto-detects Shopify, WooCommerce, PrestaShop, Magento, and Webflow.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is my data safe?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "TrackPulse runs entirely in your browser. No data is sent to external servers.",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased js-animations`}
      >
        {children}
      </body>
    </html>
  );
}
