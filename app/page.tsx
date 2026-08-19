export const dynamic = "force-dynamic"

import { SiteNav } from "@/components/site-nav"
import { Hero } from "@/components/hero"
import { Services } from "@/components/services"
import { About } from "@/components/about"
import { BookingForm } from "@/components/booking-form"
import { SiteFooter } from "@/components/site-footer"
import { MobileActionBar } from "@/components/components/mobile-action-bar"
import { getBookedSlots } from "@/app/actions"

export default async function HomePage() {
  const bookedSlots = await getBookedSlots()

  return (
    <main className="min-h-screen bg-background">
      <SiteNav />

      <Hero />

      <Services />

      <section
        id="termin"
        className="border-t border-border px-[6%] py-24"
      >
        <div className="mx-auto max-w-3xl">

          <div className="text-center">
            <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">
              Online buchen
            </p>

            <h2 className="mt-4 text-balance font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
              Termin vereinbaren
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-pretty leading-relaxed text-muted-foreground">
              Wählen Sie einen freien Termin und schildern Sie Ihr Anliegen.
              Wir bestätigen Ihre Anfrage schnellstmöglich.
            </p>
          </div>

          <div className="mt-12">
            <BookingForm bookedSlots={bookedSlots} />
          </div>

        </div>
      </section>

      <About />

      <SiteFooter />

      {/* Nur auf Handy sichtbar */}
      <MobileActionBar />

    </main>
  )
}
