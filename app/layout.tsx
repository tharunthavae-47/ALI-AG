import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"
import { Jarvis } from "@/components/jarvis"
import { JarvisElevenLabs } from "@/components/jarvis-elevenlabs"
import { PushNotifications } from "@/components/push-notifications"
import { SupplierReturnsRouteGuard } from "@/components/supplier-returns-route-guard"
import { MbPerformanceStructuredData } from "./seo-schema"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["500", "600", "700"],
  display: "swap",
})

const siteUrl = "https://www.mb-performance.ch"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MB Performance – Auto Reparatur & Service",
    template: "%s | MB Performance",
  },
  description:
    "MB Performance – persönliche und zuverlässige Autoreparatur, Fahrzeugdiagnose, Inspektion, Wartung, MFK, Ölwechsel und Reifenservice in der Schweiz.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: siteUrl,
    siteName: "MB Performance",
    title: "MB Performance – Auto Reparatur & Service",
    description:
      "Persönlicher, zuverlässiger und professioneller Service rund um Ihr Fahrzeug.",
  },
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090909",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de-CH" className={`${inter.variable} ${oswald.variable} bg-background`}>
      <body className="font-sans antialiased">
        <MbPerformanceStructuredData />
        {children}
        <SupplierReturnsRouteGuard />
        <JarvisElevenLabs />
        <Jarvis />
        <PushNotifications />
        {process.env.NODE_ENV === "production" && <Analytics />}
        <SpeedInsights />
      </body>
    </html>
  )
}
