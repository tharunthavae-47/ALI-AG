"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  Car,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

import type {
  Booking,
  BookingStatus,
} from "@/app/actions"

// =====================================================
// TYPES
// =====================================================

type BookingCalendarProps = {
  bookings: Booking[]
}

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function getDateKey(date: Date) {
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  )
}

function getDateFromKey(value: string) {
  const [year, month, day] =
    value.split("-").map(Number)

  return new Date(
    year,
    month - 1,
    day,
  )
}

function formatLongDate(value: string) {
  return getDateFromKey(value).toLocaleDateString(
    "de-CH",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  )
}

function formatShortDate(value: string) {
  return getDateFromKey(value).toLocaleDateString(
    "de-CH",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  )
}

// =====================================================
// STATUS
// =====================================================

const statusLabels: Record<
  BookingStatus,
  string
> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
}

const statusClasses: Record<
  BookingStatus,
  string
> = {
  pending:
    "border-[var(--warn)] text-[var(--warn)]",

  confirmed:
    "border-[var(--ok)] text-[var(--ok)]",

  rejected:
    "border-[var(--bad)] text-[var(--bad)]",
}

function StatusIcon({
  status,
}: {
  status: BookingStatus
}) {
  if (status === "confirmed") {
    return (
      <CheckCircle2 className="h-4 w-4" />
    )
  }

  if (status === "rejected") {
    return (
      <XCircle className="h-4 w-4" />
    )
  }

  return (
    <AlertCircle className="h-4 w-4" />
  )
}

// =====================================================
// KALENDER
// =====================================================

export function BookingCalendar({
  bookings,
}: BookingCalendarProps) {
  // ===================================================
  // HEUTIGES DATUM
  // ===================================================

  const today = new Date()

  const todayKey = getDateKey(today)

  // ===================================================
  // AUSGEWÄHLTER TAG
  // ===================================================

  const [selectedDate, setSelectedDate] =
    useState(todayKey)

  // ===================================================
  // AKTUELLER MONAT
  // ===================================================

  const [currentMonth, setCurrentMonth] =
    useState(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ),
    )

  // ===================================================
  // MONAT NAME
  // ===================================================

  const monthTitle =
    currentMonth.toLocaleDateString(
      "de-CH",
      {
        month: "long",
        year: "numeric",
      },
    )

  // ===================================================
  // TAGE DES MONATS
  // ===================================================

  const calendarDays = useMemo(() => {
    const year =
      currentMonth.getFullYear()

    const month =
      currentMonth.getMonth()

    const firstDay = new Date(
      year,
      month,
      1,
    )

    const lastDay = new Date(
      year,
      month + 1,
      0,
    )

    // Montag = 0
    const firstWeekday =
      (firstDay.getDay() + 6) % 7

    const totalDays =
      lastDay.getDate()

    const days: Array<
      Date | null
    > = []

    // Leere Felder vor dem 1.
    for (
      let i = 0;
      i < firstWeekday;
      i++
    ) {
      days.push(null)
    }

    // Tage
    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      days.push(
        new Date(
          year,
          month,
          day,
        ),
      )
    }

    // Auf volle Wochen auffüllen
    while (days.length % 7 !== 0) {
      days.push(null)
    }

    return days
  }, [currentMonth])

  // ===================================================
  // BUCHUNGEN NACH DATUM
  // ===================================================

  const bookingsByDate = useMemo(() => {
    const map =
      new Map<
        string,
        Booking[]
      >()

    for (const booking of bookings) {
      const existing =
        map.get(
          booking.booking_date,
        ) ?? []

      existing.push(booking)

      map.set(
        booking.booking_date,
        existing,
      )
    }

    for (const [, items] of map) {
      items.sort((a, b) =>
        a.booking_time.localeCompare(
          b.booking_time,
        ),
      )
    }

    return map
  }, [bookings])

  // ===================================================
  // AUSGEWÄHLTE BUCHUNGEN
  // ===================================================

  const selectedBookings =
    bookingsByDate.get(
      selectedDate,
    ) ?? []

  // ===================================================
  // MONAT WECHSELN
  // ===================================================

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1,
      ),
    )
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1,
      ),
    )
  }

  // ===================================================
  // HEUTE
  // ===================================================

  function goToToday() {
    const now = new Date()

    setCurrentMonth(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    )

    setSelectedDate(
      getDateKey(now),
    )
  }

  // ===================================================
  // STATUS DES TAGES
  // ===================================================

  function getStatusesForDate(
    dateKey: string,
  ) {
    const dayBookings =
      bookingsByDate.get(
        dateKey,
      ) ?? []

    const statuses =
      new Set<BookingStatus>()

    for (const booking of dayBookings) {
      statuses.add(
        booking.status,
      )
    }

    return Array.from(statuses)
  }

  // ===================================================
  // RETURN
  // ===================================================

  return (
    <section className="mt-8">

      {/* =================================================
          KALENDER + INFO
      ================================================= */}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* =================================================
            LINKE SEITE
        ================================================= */}

        <div className="border border-border bg-card">

          {/* HEADER */}

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">

            <div>
              <div className="flex items-center gap-2">

                <CalendarDays className="h-5 w-5" />

                <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                  Kalender
                </h2>

              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Termine nach Datum
              </p>
            </div>

            {/* MONATS NAVIGATION */}

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={goToToday}
                className="border border-border px-3 py-2 font-display text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Heute
              </button>

              <button
                type="button"
                onClick={previousMonth}
                aria-label="Vorheriger Monat"
                className="flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Nächster Monat"
                className="flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-secondary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

            </div>
          </div>

          {/* MONAT */}

          <div className="border-b border-border px-5 py-4">

            <h3 className="font-display text-2xl font-bold uppercase tracking-wide">
              {monthTitle}
            </h3>

          </div>

          {/* WOCHENTAGE */}

          <div className="grid grid-cols-7 border-b border-border">

            {[
              "Mo",
              "Di",
              "Mi",
              "Do",
              "Fr",
              "Sa",
              "So",
            ].map((day) => (
              <div
                key={day}
                className="border-r border-border px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground last:border-r-0"
              >
                {day}
              </div>
            ))}

          </div>

          {/* TAGE */}

          <div className="grid grid-cols-7">

            {calendarDays.map(
              (date, index) => {

                // Leeres Feld
                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[90px] border-r border-b border-border bg-background/30"
                    />
                  )
                }

                const dateKey =
                  getDateKey(date)

                const dayBookings =
                  bookingsByDate.get(
                    dateKey,
                  ) ?? []

                const statuses =
                  getStatusesForDate(
                    dateKey,
                  )

                const isToday =
                  dateKey ===
                  todayKey

                const isSelected =
                  dateKey ===
                  selectedDate

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() =>
                      setSelectedDate(
                        dateKey,
                      )
                    }
                    className={[
                      "relative min-h-[90px]",
                      "border-r border-b border-border",
                      "p-2 text-left",
                      "transition-colors",
                      "hover:bg-secondary",

                      isSelected
                        ? "bg-secondary"
                        : "bg-card",
                    ].join(" ")}
                  >

                    {/* TAG */}

                    <div
                      className={[
                        "flex h-7 w-7 items-center justify-center",
                        "text-sm font-semibold",

                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "",

                        isSelected &&
                        !isToday
                          ? "border border-primary"
                          : "",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </div>

                    {/* TERMINE */}

                    {dayBookings.length >
                      0 && (

                      <div className="mt-2">

                        {/* STATUS PUNKTE */}

                        <div className="flex flex-wrap gap-1">

                          {statuses.includes(
                            "pending",
                          ) && (
                            <span
                              title="Offener Termin"
                              className="h-2 w-2 rounded-full bg-[var(--warn)]"
                            />
                          )}

                          {statuses.includes(
                            "confirmed",
                          ) && (
                            <span
                              title="Bestätigter Termin"
                              className="h-2 w-2 rounded-full bg-[var(--ok)]"
                            />
                          )}

                          {statuses.includes(
                            "rejected",
                          ) && (
                            <span
                              title="Abgelehnter Termin"
                              className="h-2 w-2 rounded-full bg-[var(--bad)]"
                            />
                          )}

                        </div>

                        {/* ANZAHL */}

                        <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                          {dayBookings.length}{" "}
                          {dayBookings.length ===
                          1
                            ? "Termin"
                            : "Termine"}
                        </p>

                      </div>
                    )}

                  </button>
                )
              },
            )}

          </div>

          {/* LEGENDE */}

          <div className="flex flex-wrap gap-5 border-t border-border p-4">

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)]" />
              Offen
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ok)]" />
              Bestätigt
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--bad)]" />
              Abgelehnt
            </div>

          </div>

        </div>

        {/* =================================================
            RECHTE SEITE
        ================================================= */}

        <div className="border border-border bg-card">

          {/* HEADER */}

          <div className="border-b border-border p-5">

            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Ausgewählter Tag
            </p>

            <h2 className="mt-2 font-display text-xl font-bold uppercase">
              {formatLongDate(
                selectedDate,
              )}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {selectedBookings.length ===
              0
                ? "Keine Termine"
                : `${selectedBookings.length} ${
                    selectedBookings.length ===
                    1
                      ? "Termin"
                      : "Termine"
                  }`}
            </p>

          </div>

          {/* TERMINE */}

          <div className="max-h-[600px] overflow-y-auto">

            {selectedBookings.length ===
            0 ? (

              <div className="p-8 text-center">

                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 text-sm text-muted-foreground">
                  Keine Termine an diesem Tag.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-border">

                {selectedBookings.map(
                  (booking) => (

                    <div
                      key={booking.id}
                      className="p-5"
                    >

                      {/* ZEIT */}

                      <div className="flex items-center justify-between gap-3">

                        <div className="flex items-center gap-2 font-display text-lg font-bold">

                          <Clock className="h-4 w-4" />

                          {booking.booking_time}

                        </div>

                        {/* STATUS */}

                        <span
                          className={[
                            "flex items-center gap-1",
                            "border px-2 py-1",
                            "text-[9px]",
                            "uppercase tracking-widest",
                            statusClasses[
                              booking.status
                            ],
                          ].join(" ")}
                        >

                          <StatusIcon
                            status={
                              booking.status
                            }
                          />

                          {
                            statusLabels[
                              booking.status
                            ]
                          }

                        </span>

                      </div>

                      {/* NAME */}

                      <div className="mt-4 flex items-center gap-2">

                        <User className="h-4 w-4 text-muted-foreground" />

                        <span className="font-semibold">
                          {booking.name}
                        </span>

                      </div>

                      {/* AUTO */}

                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">

                        <Car className="h-4 w-4" />

                        {booking.car}

                      </div>

                      {/* PROBLEM */}

                      {booking.problem && (

                        <div className="mt-4 border-t border-border pt-4">

                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Anliegen
                          </p>

                          <p className="mt-1 text-sm leading-relaxed">
                            {booking.problem}
                          </p>

                        </div>

                      )}

                      {/* KONTAKT */}

                      <div className="mt-4 flex flex-wrap gap-3">

                        <a
                          href={`tel:${booking.phone}`}
                          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {booking.phone}
                        </a>

                        <a
                          href={`mailto:${booking.email}`}
                          className="max-w-full truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {booking.email}
                        </a>

                      </div>

                    </div>
                  ),
                )}

              </div>
            )}

          </div>

        </div>

      </div>

      {/* =================================================
          AUSGEWÄHLTER TAG UNTER DEM KALENDER
      ================================================= */}

      <div className="mt-6 border border-border bg-card p-5">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>

            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Tagesübersicht
            </p>

            <h3 className="mt-1 font-display text-lg font-semibold uppercase">
              {formatLongDate(
                selectedDate,
              )}
            </h3>

          </div>

          <div className="text-sm text-muted-foreground">
            {formatShortDate(
              selectedDate,
            )}
          </div>

        </div>

        {selectedBookings.length >
        0 && (

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

            {selectedBookings.map(
              (booking) => (

                <div
                  key={booking.id}
                  className="border border-border p-4"
                >

                  <div className="flex items-center justify-between">

                    <span className="font-display text-lg font-bold">
                      {booking.booking_time}
                    </span>

                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full",

                        booking.status ===
                        "pending"
                          ? "bg-[var(--warn)]"
                          : "",

                        booking.status ===
                        "confirmed"
                          ? "bg-[var(--ok)]"
                          : "",

                        booking.status ===
                        "rejected"
                          ? "bg-[var(--bad)]"
                          : "",
                      ].join(" ")}
                    />

                  </div>

                  <p className="mt-2 text-sm font-semibold">
                    {booking.name}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {booking.car}
                  </p>

                </div>

              ),
            )}

          </div>
        )}

      </div>

    </section>
  )
}
