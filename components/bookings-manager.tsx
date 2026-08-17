"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Check,
  X,
  Phone,
  Mail,
  Car,
  Calendar,
  Clock,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import {
  updateBookingStatus,
  type Booking,
  type BookingStatus,
} from "@/app/actions"

const FILTERS: {
  key: BookingStatus | "all"
  label: string
}[] = [
  { key: "pending", label: "Offen" },
  { key: "confirmed", label: "Bestätigt" },
  { key: "rejected", label: "Abgelehnt" },
  { key: "all", label: "Alle" },
]

const statusStyles: Record<BookingStatus, string> = {
  pending: "text-[var(--warn)] border-[var(--warn)]",
  confirmed: "text-[var(--ok)] border-[var(--ok)]",
  rejected: "text-[var(--bad)] border-[var(--bad)]",
}

const statusLabels: Record<BookingStatus, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
}

const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

const weekDays = [
  "Mo",
  "Di",
  "Mi",
  "Do",
  "Fr",
  "Sa",
  "So",
]

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(
    "de-CH",
    {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  )
}

function getImagePaths(imageUrls: unknown): string[] {
  if (!imageUrls) {
    return []
  }

  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim() !== "",
    )
  }

  if (typeof imageUrls === "string") {
    let value = imageUrls.trim()

    if (
      !value ||
      value === "[]" ||
      value === "{}" ||
      value === "null"
    ) {
      return []
    }

    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim() !== "",
        )
      }

      if (typeof parsed === "string") {
        value = parsed
      }
    } catch {
      // Kein JSON
    }

    return value ? [value] : []
  }

  return []
}

function getImageUrl(path: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl || !path) {
    return ""
  }

  const cleanPath = path
    .trim()
    .replace(/^\/+/, "")

  if (
    cleanPath.startsWith("http://") ||
    cleanPath.startsWith("https://")
  ) {
    return cleanPath
  }

  return (
    `${supabaseUrl}/storage/v1/object/public/` +
    `Kunden-Bilder/${encodeURI(cleanPath)}`
  )
}

function toDateKey(
  year: number,
  month: number,
  day: number,
) {
  const monthString = String(month + 1).padStart(2, "0")
  const dayString = String(day).padStart(2, "0")

  return `${year}-${monthString}-${dayString}`
}

function getTodayKey() {
  const today = new Date()

  return toDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
}

function getCalendarDays(
  year: number,
  month: number,
) {
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

  // JavaScript: Sonntag = 0
  // Wir wollen Montag = 0
  const firstWeekDay =
    (firstDay.getDay() + 6) % 7

  const daysInMonth =
    lastDay.getDate()

  const previousMonthDays =
    firstWeekDay

  const days = []

  for (
    let i = previousMonthDays - 1;
    i >= 0;
    i--
  ) {
    const date = new Date(
      year,
      month,
      -i,
    )

    days.push({
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      currentMonth: false,
    })
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    days.push({
      day,
      month,
      year,
      currentMonth: true,
    })
  }

  const remaining =
    42 - days.length

  for (
    let i = 1;
    i <= remaining;
    i++
  ) {
    const date = new Date(
      year,
      month + 1,
      i,
    )

    days.push({
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      currentMonth: false,
    })
  }

  return days
}

export function BookingsManager({
  initialBookings,
}: {
  initialBookings: Booking[]
}) {
  const [bookings, setBookings] =
    useState<Booking[]>(
      initialBookings,
    )

  const [filter, setFilter] =
    useState<BookingStatus | "all">(
      "pending",
    )

  const [isPending, startTransition] =
    useTransition()

  const [busyId, setBusyId] =
    useState<string | null>(null)

  // =====================================================
  // KALENDER
  // =====================================================

  const today = new Date()

  const [calendarMonth, setCalendarMonth] =
    useState(today.getMonth())

  const [calendarYear, setCalendarYear] =
    useState(today.getFullYear())

  const [selectedDate, setSelectedDate] =
    useState<string>(getTodayKey())

  const calendarDays = useMemo(
    () =>
      getCalendarDays(
        calendarYear,
        calendarMonth,
      ),
    [calendarYear, calendarMonth],
  )

  // =====================================================
  // BUCHUNGEN SORTIEREN
  // =====================================================

  const visible = [...bookings]
    .filter((booking) =>
      filter === "all"
        ? true
        : booking.status === filter,
    )
    .sort((a, b) => {
      if (filter === "pending") {
        return (
          new Date(
            b.created_at,
          ).getTime() -
          new Date(
            a.created_at,
          ).getTime()
        )
      }

      const dateA =
        `${a.booking_date} ${a.booking_time}`

      const dateB =
        `${b.booking_date} ${b.booking_time}`

      return dateA.localeCompare(
        dateB,
      )
    })

  // =====================================================
  // BUCHUNGEN FÜR AUSGEWÄHLTEN TAG
  // =====================================================

  const selectedDayBookings =
    useMemo(() => {
      return [...bookings]
        .filter(
          (booking) =>
            booking.booking_date ===
            selectedDate,
        )
        .sort((a, b) =>
          a.booking_time.localeCompare(
            b.booking_time,
          ),
        )
    }, [
      bookings,
      selectedDate,
    ])

  // =====================================================
  // STATISTIK
  // =====================================================

  const counts = {
    pending: bookings.filter(
      (b) =>
        b.status === "pending",
    ).length,

    confirmed: bookings.filter(
      (b) =>
        b.status === "confirmed",
    ).length,

    rejected: bookings.filter(
      (b) =>
        b.status === "rejected",
    ).length,
  }

  // =====================================================
  // STATUS ÄNDERN
  // =====================================================

  function handleUpdate(
    id: string,
    status: Exclude<
      BookingStatus,
      "pending"
    >,
  ) {
    setBusyId(id)

    startTransition(async () => {
      try {
        const result =
          await updateBookingStatus(
            id,
            status,
          )

        if (result.ok) {
          setBookings(
            (previous) =>
              previous.map(
                (booking) =>
                  booking.id === id
                    ? {
                        ...booking,
                        status,
                      }
                    : booking,
              ),
          )
        } else {
          alert(
            result.error ??
              "Aktualisierung fehlgeschlagen.",
          )
        }
      } catch (error) {
        console.error(error)

        alert(
          "Aktualisierung fehlgeschlagen.",
        )
      } finally {
        setBusyId(null)
      }
    })
  }

  // =====================================================
  // MONAT WECHSELN
  // =====================================================

  function previousMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear(
        calendarYear - 1,
      )
    } else {
      setCalendarMonth(
        calendarMonth - 1,
      )
    }
  }

  function nextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear(
        calendarYear + 1,
      )
    } else {
      setCalendarMonth(
        calendarMonth + 1,
      )
    }
  }

  function goToToday() {
    const now = new Date()

    setCalendarMonth(
      now.getMonth(),
    )

    setCalendarYear(
      now.getFullYear(),
    )

    setSelectedDate(
      toDateKey(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ),
    )
  }

  // =====================================================
  // KALENDER STATUS
  // =====================================================

  function getDayBookings(
    dateKey: string,
  ) {
    return bookings.filter(
      (booking) =>
        booking.booking_date ===
        dateKey,
    )
  }

  // =====================================================
  // AUSGEWÄHLTES DATUM FORMATIEREN
  // =====================================================

  function formatSelectedDate(
    dateKey: string,
  ) {
    const date = new Date(
      dateKey + "T00:00:00",
    )

    return date.toLocaleDateString(
      "de-CH",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      },
    )
  }

  return (
    <div>
      {/* =================================================
          STATISTIK
      ================================================= */}

      <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
        <div className="bg-card p-5">
          <div className="font-display text-3xl font-bold text-[var(--warn)]">
            {counts.pending}
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Offen
          </div>
        </div>

        <div className="bg-card p-5">
          <div className="font-display text-3xl font-bold text-[var(--ok)]">
            {counts.confirmed}
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Bestätigt
          </div>
        </div>

        <div className="bg-card p-5">
          <div className="font-display text-3xl font-bold text-[var(--bad)]">
            {counts.rejected}
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Abgelehnt
          </div>
        </div>
      </div>

      {/* =================================================
          FILTER
      ================================================= */}

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() =>
              setFilter(
                item.key,
              )
            }
            className={[
              "border px-4 py-2 font-display text-xs uppercase tracking-widest transition-colors",
              filter === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* =================================================
          HAUPTBEREICH
          LINKS = BUCHUNGEN
          RECHTS = KALENDER
      ================================================= */}

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-start">

        {/* =================================================
            LINKE SEITE – BUCHUNGEN
        ================================================= */}

        <div className="min-w-0">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Buchungen
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                {filter === "all"
                  ? "Alle Termine"
                  : statusLabels[
                      filter
                    ]}
              </h2>
            </div>

            <div className="text-sm text-muted-foreground">
              {visible.length}{" "}
              {visible.length === 1
                ? "Termin"
                : "Termine"}
            </div>
          </div>

          <div className="space-y-4">
            {visible.length ===
              0 && (
              <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Keine Einträge in
                dieser Ansicht.
              </p>
            )}

            {visible.map(
              (booking) => {
                const imagePaths =
                  getImagePaths(
                    booking.image_urls,
                  )

                return (
                  <BookingCard
                    key={
                      booking.id
                    }
                    booking={
                      booking
                    }
                    imagePaths={
                      imagePaths
                    }
                    isPending={
                      isPending
                    }
                    busyId={
                      busyId
                    }
                    onUpdate={
                      handleUpdate
                    }
                  />
                )
              },
            )}
          </div>
        </div>

        {/* =================================================
            RECHTE SEITE – KALENDER
        ================================================= */}

        <aside className="xl:sticky xl:top-6">
          <div className="border border-border bg-card">

            {/* KALENDER HEADER */}

            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between">

                <div>
                  <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Kalender
                  </p>

                  <h2 className="mt-1 font-display text-xl font-bold uppercase">
                    {monthNames[
                      calendarMonth
                    ]}{" "}
                    {calendarYear}
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={
                      previousMonth
                    }
                    className="border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Vorheriger Monat"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={
                      nextMonth
                    }
                    className="border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Nächster Monat"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  goToToday
                }
                className="mt-4 border border-border px-3 py-1.5 font-display text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Heute
              </button>
            </div>

            {/* WOCHENTAGE */}

            <div className="grid grid-cols-7 border-b border-border">
              {weekDays.map(
                (day) => (
                  <div
                    key={day}
                    className="py-3 text-center font-display text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {day}
                  </div>
                ),
              )}
            </div>

            {/* TAGE */}

            <div className="grid grid-cols-7 gap-px bg-border">
              {calendarDays.map(
                (day) => {
                  const dateKey =
                    toDateKey(
                      day.year,
                      day.month,
                      day.day,
                    )

                  const dayBookings =
                    getDayBookings(
                      dateKey,
                    )

                  const hasPending =
                    dayBookings.some(
                      (booking) =>
                        booking.status ===
                        "pending",
                    )

                  const hasConfirmed =
                    dayBookings.some(
                      (booking) =>
                        booking.status ===
                        "confirmed",
                    )

                  const hasRejected =
                    dayBookings.some(
                      (booking) =>
                        booking.status ===
                        "rejected",
                    )

                  const isSelected =
                    selectedDate ===
                    dateKey

                  const isToday =
                    getTodayKey() ===
                    dateKey

                  return (
                    <button
                      key={
                        dateKey
                      }
                      type="button"
                      onClick={() =>
                        setSelectedDate(
                          dateKey,
                        )
                      }
                      className={[
                        "relative min-h-[64px] bg-card p-2 text-left transition-colors",
                        "hover:bg-secondary",
                        !day.currentMonth
                          ? "opacity-35"
                          : "",
                        isSelected
                          ? "ring-2 ring-inset ring-primary"
                          : "",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-7 w-7 items-center justify-center font-display text-sm",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "",
                        ].join(" ")}
                      >
                        {
                          day.day
                        }
                      </span>

                      {/* STATUS-PUNKTE */}

                      {dayBookings.length >
                        0 && (
                        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
                          {hasPending && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                          )}

                          {hasConfirmed && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                          )}

                          {hasRejected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--bad)]" />
                          )}
                        </div>
                      )}

                      {/* ANZAHL */}

                      {dayBookings.length >
                        0 && (
                        <span className="absolute right-2 top-2 text-[9px] text-muted-foreground">
                          {
                            dayBookings.length
                          }
                        </span>
                      )}
                    </button>
                  )
                },
              )}
            </div>

            {/* LEGENDE */}

            <div className="border-t border-border p-4">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--warn)]" />
                  Offen
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--ok)]" />
                  Bestätigt
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--bad)]" />
                  Abgelehnt
                </span>
              </div>
            </div>

            {/* =================================================
                AUSGEWÄHLTER TAG
            ================================================= */}

            <div className="border-t border-border p-5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />

                <div>
                  <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                    Ausgewählter Tag
                  </p>

                  <h3 className="mt-1 font-display text-lg font-semibold capitalize">
                    {formatSelectedDate(
                      selectedDate,
                    )}
                  </h3>
                </div>
              </div>

              {/* BUCHUNGEN DES TAGES */}

              <div className="mt-5 space-y-2">
                {selectedDayBookings.length ===
                  0 && (
                  <div className="border border-border p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Keine Buchungen
                      an diesem Tag.
                    </p>
                  </div>
                )}

                {selectedDayBookings.map(
                  (
                    booking,
                  ) => (
                    <button
                      key={
                        booking.id
                      }
                      type="button"
                      onClick={() => {
                        setFilter(
                          booking.status,
                        )
                      }}
                      className="w-full border border-border p-3 text-left transition-colors hover:bg-secondary"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />

                          <span className="font-display text-sm font-semibold">
                            {
                              booking.booking_time
                            }
                          </span>
                        </div>

                        <span
                          className={`border px-2 py-0.5 text-[9px] uppercase tracking-widest ${statusStyles[booking.status]}`}
                        >
                          {
                            statusLabels[
                              booking.status
                            ]
                          }
                        </span>
                      </div>

                      <p className="mt-2 truncate text-sm">
                        {
                          booking.name
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {
                          booking.car
                        }
                      </p>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// =====================================================
// BUCHUNGSKARTE
// =====================================================

function BookingCard({
  booking,
  imagePaths,
  isPending,
  busyId,
  onUpdate,
}: {
  booking: Booking
  imagePaths: string[]
  isPending: boolean
  busyId: string | null
  onUpdate: (
    id: string,
    status: Exclude<
      BookingStatus,
      "pending"
    >,
  ) => void
}) {
  return (
    <article
      className="border border-border bg-card p-6"
    >
      {/* NAME + STATUS */}

      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
          {booking.name}
        </h3>

        <span
          className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusStyles[booking.status]}`}
        >
          {
            statusLabels[
              booking.status
            ]
          }
        </span>
      </div>

      {/* DATUM / ZEIT */}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />

          {formatDate(
            booking.booking_date,
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />

          {booking.booking_time}
        </div>
      </div>

      {/* KONTAKT */}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={`tel:${booking.phone}`}
          className="flex items-center gap-2 text-sm text-foreground hover:underline"
        >
          <Phone className="h-4 w-4" />

          {booking.phone}
        </a>

        <a
          href={`mailto:${booking.email}`}
          className="flex items-center gap-2 break-all text-sm text-foreground hover:underline"
        >
          <Mail className="h-4 w-4" />

          {booking.email}
        </a>
      </div>

      {/* FAHRZEUG */}

      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Car className="h-4 w-4" />

        {booking.car}
      </div>

      {/* PROBLEM */}

      <div className="mt-5 border-t border-border pt-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Problem / Anliegen
        </p>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {booking.problem}
        </p>
      </div>

      {/* BILDER */}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
          <ImageIcon className="h-4 w-4" />

          Kundenbilder

          {imagePaths.length >
            0 &&
            ` (${imagePaths.length})`}
        </div>

        {imagePaths.length ===
        0 ? (
          <div className="mt-3 border border-border p-5 text-center">
            <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />

            <p className="mt-2 text-xs text-muted-foreground">
              Keine Kundenbilder
              vorhanden
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {imagePaths.map(
              (
                path,
                index,
              ) => {
                const url =
                  getImageUrl(
                    path,
                  )

                if (!url) {
                  return null
                }

                return (
                  <a
                    key={`${path}-${index}`}
                    href={
                      url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-square overflow-hidden border border-border bg-background"
                  >
                    <img
                      src={
                        url
                      }
                      alt={`Kundenbild ${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(
                        e,
                      ) => {
                        console.error(
                          "Bild konnte nicht geladen werden:",
                          url,
                        )

                        e.currentTarget.style.display =
                          "none"
                      }}
                    />

                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-2 text-center text-[10px] uppercase tracking-wider text-white">
                      Bild{" "}
                      {index +
                        1}
                    </div>
                  </a>
                )
              },
            )}
          </div>
        )}
      </div>

      {/* BUTTONS */}

      {booking.status ===
        "pending" && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              isPending &&
              busyId ===
                booking.id
            }
            onClick={() =>
              onUpdate(
                booking.id,
                "confirmed",
              )
            }
            className="flex items-center gap-2 border border-[var(--ok)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--ok)] transition-colors hover:bg-[var(--ok)] hover:text-background disabled:opacity-50"
          >
            <Check className="h-4 w-4" />

            {isPending &&
            busyId ===
              booking.id
              ? "Wird gespeichert..."
              : "Bestätigen"}
          </button>

          <button
            type="button"
            disabled={
              isPending &&
              busyId ===
                booking.id
            }
            onClick={() =>
              onUpdate(
                booking.id,
                "rejected",
              )
            }
            className="flex items-center gap-2 border border-[var(--bad)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--bad)] transition-colors hover:bg-[var(--bad)] hover:text-background disabled:opacity-50"
          >
            <X className="h-4 w-4" />

            {isPending &&
            busyId ===
              booking.id
              ? "Wird gespeichert..."
              : "Ablehnen"}
          </button>
        </div>
      )}
    </article>
  )
}
