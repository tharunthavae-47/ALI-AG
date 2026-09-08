import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"
import { Jarvis } from "@/components/jarvis"
import { JarvisElevenLabs } from "@/components/jarvis-elevenlabs"
import { PushNotifications } from "@/components/push-notifications"
import { SupplierReturnsV2 } from "@/components/supplier-returns-v2"

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

export const metadata: Metadata = {
  title: "MB Performance – Auto Reparatur & Service",
  description:
    "Persönlicher, zuverlässiger und professioneller Service rund um Ihr Fahrzeug. Vereinbaren Sie online einen Termin bei MB Performance.",
  generator: "v0.app",
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
    <html lang="de" className={`${inter.variable} ${oswald.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <SupplierReturnsV2 />
        <JarvisElevenLabs />
        <Jarvis />
        <PushNotifications />
        {process.env.NODE_ENV === "production" && <Analytics />}
        <SpeedInsights />
      </body>
    </html>
  )
}
