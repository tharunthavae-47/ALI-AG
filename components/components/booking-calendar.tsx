"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  Car,
} from "lucide-react"

import type { Booking } from "@/app/actions"

type BookingCalendarProps = {
  bookings: Booking[]
}

const WEEKDAYS = [
  "Mo",
  "Di",
  "Mi",
  "Do",
  "Fr",
  "Sa",
  "So",
]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getMonthName(date: Date) {
  return date.toLocaleDateString("de-CH", {
    month: "long",
    year: "numeric",
  })
}

function getDaysInMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()
}

function getFirstDayOfMonth(date: Date) {
  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  ).getDay()

  // Sonntag = 0 → auf Montag-basierten Kalender umrechnen
  return day === 0 ? 6 : day - 1
}

function formatBookingDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(
    "de-CH",
    {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  )
}

export function BookingCalendar({
  bookings,
}: BookingCalendarProps) {
  const today = new Date()

  const [currentMonth, setCurrentMonth] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    ),
  )

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null)

  const daysInMonth =
    getDaysInMonth(currentMonth)

  const firstDay =
    getFirstDayOfMonth(currentMonth)

  const calendarDays = useMemo(() => {
    const days: Array<number | null> = []

    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }, [firstDay, daysInMonth])

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>()

    for (const booking of bookings) {
      const existing =
        map.get(booking.booking_date) ?? []

      existing.push(booking)

      map.set(
        booking.booking_date,
        existing,
      )
    }

    return map
  }, [bookings])

  const selectedBookings = selectedDate
    ? bookingsByDate.get(selectedDate) ?? []
    : []

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1,
      ),
    )

    setSelectedDate(null)
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1,
      ),
    )

    setSelectedDate(null)
  }

  function goToToday() {
    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ),
    )

    setSelectedDate(formatDate(today))
  }

  return (
    <section className="mt-10 border border-border bg-card">
      {/* HEADER */}

      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-border">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Kalender
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                {getMonthName(currentMonth)}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="border border-border px-3 py-2 font-display text-xs uppercase tracking-widest hover:bg-secondary"
            >
              Heute
            </button>

            <button
              type="button"
              onClick={previousMonth}
              className="flex h-9 w-9 items-center justify-center border border-border hover:bg-secondary"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center border border-border hover:bg-secondary"
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* LEGENDE */}

        <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[var(--warn)]" />
            Offen
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[var(--ok)]" />
            Bestätigt
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-[var(--bad)]" />
            Abgelehnt
          </div>
        </div>
      </div>

      {/* KALENDER */}

      <div className="p-3 sm:p-5">
        {/* WOCHENTAGE */}

        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-3 text-center font-display text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs"
            >
              {day}
            </div>
          ))}
        </div>

        {/* TAGE */}

        <div className="grid grid-cols-7">
          {calendarDays.map(
            (day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[70px] border-b border-r border-border bg-background/40 sm:min-h-[100px]"
                  />
                )
              }

              const date = new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                day,
              )

              const dateString =
                formatDate(date)

              const dayBookings =
                bookingsByDate.get(
                  dateString,
                ) ?? []

              const isToday =
                dateString ===
                formatDate(today)

              const isSelected =
                selectedDate ===
                dateString

              const pendingCount =
                dayBookings.filter(
                  (booking) =>
                    booking.status ===
                    "pending",
                ).length

              const confirmedCount =
                dayBookings.filter(
                  (booking) =>
                    booking.status ===
                    "confirmed",
                ).length

              const rejectedCount =
                dayBookings.filter(
                  (booking) =>
                    booking.status ===
                    "rejected",
                ).length

              return (
                <button
                  key={dateString}
                  type="button"
                  onClick={() =>
                    setSelectedDate(
                      dateString,
                    )
                  }
                  className={[
                    "relative min-h-[70px] border-b border-r border-border p-2 text-left transition-colors hover:bg-secondary sm:min-h-[100px] sm:p-3",
                    isSelected
                      ? "bg-secondary"
                      : "",
                  ].join(" ")}
                >
                  {/* DATUM */}

                  <div
                    className={[
                      "flex h-7 w-7 items-center justify-center font-display text-sm",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "",
                    ].join(" ")}
                  >
                    {day}
                  </div>

                  {/* TERMINE */}

                  {dayBookings.length >
                    0 && (
                    <div className="mt-2 space-y-1">
                      {pendingCount >
                        0 && (
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-[var(--warn)]" />

                          <span className="hidden text-[9px] uppercase text-muted-foreground sm:inline">
                            {pendingCount}
                            {" "}
                            offen
                          </span>
                        </div>
                      )}

                      {confirmedCount >
                        0 && (
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-[var(--ok)]" />

                          <span className="hidden text-[9px] uppercase text-muted-foreground sm:inline">
                            {confirmedCount}
                            {" "}
                            bestätigt
                          </span>
                        </div>
                      )}

                      {rejectedCount >
                        0 && (
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-[var(--bad)]" />

                          <span className="hidden text-[9px] uppercase text-muted-foreground sm:inline">
                            {rejectedCount}
                            {" "}
                            abgelehnt
                          </span>
                        </div>
                      )}

                      {/* MOBILE PUNKTE */}

                      <div className="flex gap-1 sm:hidden">
                        {pendingCount >
                          0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                        )}

                        {confirmedCount >
                          0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                        )}

                        {rejectedCount >
                          0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--bad)]" />
                        )}
                      </div>
                    </div>
                  )}
                </button>
              )
            },
          )}
        </div>
      </div>

      {/* AUSGEWÄHLTER TAG */}

      {selectedDate && (
        <div className="border-t border-border">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Ausgewählter Tag
                </p>

                <h3 className="mt-1 font-display text-xl font-bold uppercase">
                  {formatBookingDate(
                    selectedDate,
                  )}
                </h3>
              </div>

              <div className="text-sm text-muted-foreground">
                {selectedBookings.length}{" "}
                {selectedBookings.length ===
                1
                  ? "Termin"
                  : "Termine"}
              </div>
            </div>

            {selectedBookings.length ===
            0 ? (
              <div className="mt-5 border border-border p-6 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />

                <p className="mt-2 text-sm text-muted-foreground">
                  Für diesen Tag sind keine
                  Termine vorhanden.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {selectedBookings
                  .slice()
                  .sort((a, b) =>
                    a.booking_time.localeCompare(
                      b.booking_time,
                    ),
                  )
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />

                            <span className="font-display text-lg font-bold">
                              {
                                booking.booking_time
                              }
                            </span>

                            <span
                              className={[
                                "border px-2 py-0.5 text-[9px] uppercase tracking-widest",
                                booking.status ===
                                  "pending"
                                  ? "border-[var(--warn)] text-[var(--warn)]"
                                  : "",
                                booking.status ===
                                  "confirmed"
                                  ? "border-[var(--ok)] text-[var(--ok)]"
                                  : "",
                                booking.status ===
                                  "rejected"
                                  ? "border-[var(--bad)] text-[var(--bad)]"
                                  : "",
                              ].join(" ")}
                            >
                              {booking.status ===
                                "pending" &&
                                "Offen"}

                              {booking.status ===
                                "confirmed" &&
                                "Bestätigt"}

                              {booking.status ===
                                "rejected" &&
                                "Abgelehnt"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {booking.name}
                          </div>

                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            {booking.car}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
