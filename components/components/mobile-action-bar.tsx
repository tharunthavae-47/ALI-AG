"use client"

import { Phone, CalendarDays } from "lucide-react"

export function MobileActionBar() {
  const scrollToBooking = () => {
    const booking = document.getElementById("buchung")

    if (booking) {
      booking.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-black/95 backdrop-blur-md md:hidden">
      {/* ANRUFEN */}
      <a
        href="tel:DEINE-TELEFONNUMMER"
        className="flex flex-1 items-center justify-center gap-2 border-r border-border px-4 py-4 text-sm font-semibold uppercase tracking-wide text-white transition-colors active:bg-white active:text-black"
      >
        <Phone className="h-5 w-5" />
        Anrufen
      </a>

      {/* JETZT BUCHEN */}
      <button
        type="button"
        onClick={scrollToBooking}
        className="flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-semibold uppercase tracking-wide text-white transition-colors active:bg-white active:text-black"
      >
        <CalendarDays className="h-5 w-5" />
        Jetzt buchen
      </button>
    </div>
  )
}
