"use client"

import { useState, useTransition } from "react"
import {
  Check,
  X,
  Phone,
  Mail,
  Car,
  Calendar,
  Clock,
  Image as ImageIcon,
} from "lucide-react"

import { BookingCalendar } from "@/components/components/booking-calendar"

import {
  updateBookingStatus,
  type Booking,
  type BookingStatus,
} from "@/app/actions"

// =====================================================
// FILTER
// =====================================================

const FILTERS: {
  key: BookingStatus | "all"
  label: string
}[] = [
  {
    key: "pending",
    label: "Offen",
  },
  {
    key: "confirmed",
    label: "Bestätigt",
  },
  {
    key: "rejected",
    label: "Abgelehnt",
  },
  {
    key: "all",
    label: "Alle",
  },
]

// =====================================================
// STATUS STYLES
// =====================================================

const statusStyles: Record<BookingStatus, string> = {
  pending:
    "text-[var(--warn)] border-[var(--warn)]",

  confirmed:
    "text-[var(--ok)] border-[var(--ok)]",

  rejected:
    "text-[var(--bad)] border-[var(--bad)]",
}

// =====================================================
// STATUS LABELS
// =====================================================

const statusLabels: Record<BookingStatus, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
}

// =====================================================
// DATUM FORMATIEREN
// =====================================================

function formatDate(iso: string) {
  return new Date(
    iso + "T00:00:00",
  ).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// =====================================================
// BILDER AUS SUPABASE
// =====================================================

function getImagePaths(
  imageUrls: unknown,
): string[] {
  if (!imageUrls) {
    return []
  }

  // Array
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim() !== "",
    )
  }

  // String
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

    // JSON-String aus Supabase
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

// =====================================================
// BILD URL ERSTELLEN
// =====================================================

function getImageUrl(path: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl || !path) {
    return ""
  }

  const cleanPath = path
    .trim()
    .replace(/^\/+/, "")

  // Bereits komplette URL
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

// =====================================================
// BOOKINGS MANAGER
// =====================================================

export function BookingsManager({
  initialBookings,
}: {
  initialBookings: Booking[]
}) {
  // ===================================================
  // STATE
  // ===================================================

  const [bookings, setBookings] =
    useState<Booking[]>(initialBookings)

  const [filter, setFilter] =
    useState<BookingStatus | "all">("pending")

  const [isPending, startTransition] =
    useTransition()

  const [busyId, setBusyId] =
    useState<string | null>(null)

  // ===================================================
  // SICHTBARE BUCHUNGEN
  // ===================================================

  const visible = [...bookings]
    .filter((booking) =>
      filter === "all"
        ? true
        : booking.status === filter,
    )
    .sort((a, b) => {
      // Offene Anfragen:
      // Neueste Anfrage zuerst
      if (filter === "pending") {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        )
      }

      // Alle:
      // Termin nach Datum
      if (filter === "all") {
        const dateA =
          `${a.booking_date} ${a.booking_time}`

        const dateB =
          `${b.booking_date} ${b.booking_time}`

        return dateA.localeCompare(dateB)
      }

      // Bestätigt / Abgelehnt
      const dateA =
        `${a.booking_date} ${a.booking_time}`

      const dateB =
        `${b.booking_date} ${b.booking_time}`

      return dateA.localeCompare(dateB)
    })

  // ===================================================
  // STATISTIK
  // ===================================================

  const counts = {
    pending: bookings.filter(
      (booking) =>
        booking.status === "pending",
    ).length,

    confirmed: bookings.filter(
      (booking) =>
        booking.status === "confirmed",
    ).length,

    rejected: bookings.filter(
      (booking) =>
        booking.status === "rejected",
    ).length,
  }

  // ===================================================
  // STATUS ÄNDERN
  // ===================================================

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

        // Erfolgreich
        if (result.ok) {
          setBookings((previous) =>
            previous.map((booking) =>
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
        console.error(
          "Status update error:",
          error,
        )

        alert(
          "Aktualisierung fehlgeschlagen.",
        )
      } finally {
        setBusyId(null)
      }
    })
  }

  // ===================================================
  // RETURN
  // ===================================================

  return (
    <div>

      {/* =================================================
          STATISTIK
      ================================================= */}

      <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">

        {/* OFFEN */}

        <div className="bg-card p-5">
          <div className="font-display text-3xl font-bold text-[var(--warn)]">
            {counts.pending}
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Offen
          </div>
        </div>

        {/* BESTÄTIGT */}

        <div className="bg-card p-5">
          <div className="font-display text-3xl font-bold text-[var(--ok)]">
            {counts.confirmed}
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Bestätigt
          </div>
        </div>

        {/* ABGELEHNT */}

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
          KALENDER
      ================================================= */}

      <div className="mt-8">
        <BookingCalendar
          bookings={bookings}
        />
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
              setFilter(item.key)
            }
            className={[
              "border px-4 py-2",
              "font-display text-xs",
              "uppercase tracking-widest",
              "transition-colors",

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
          BUCHUNGEN
      ================================================= */}

      <div className="mt-6 space-y-4">

        {/* KEINE BUCHUNGEN */}

        {visible.length === 0 && (
          <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Keine Einträge in dieser Ansicht.
          </p>
        )}

        {/* BUCHUNGEN */}

        {visible.map((booking) => {
          const imagePaths =
            getImagePaths(
              booking.image_urls,
            )

          return (
            <article
              key={booking.id}
              className="border border-border bg-card p-6"
            >

              {/* =========================================
                  NAME + STATUS
              ========================================= */}

              <div className="flex flex-wrap items-center gap-3">

                <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                  {booking.name}
                </h3>

                <span
                  className={[
                    "border px-2 py-0.5",
                    "text-[10px]",
                    "uppercase tracking-widest",
                    statusStyles[
                      booking.status
                    ],
                  ].join(" ")}
                >
                  {
                    statusLabels[
                      booking.status
                    ]
                  }
                </span>

              </div>

              {/* =========================================
                  DATUM / UHRZEIT
              ========================================= */}

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

              {/* =========================================
                  KONTAKT
              ========================================= */}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                {/* TELEFON */}

                <a
                  href={`tel:${booking.phone}`}
                  className="flex items-center gap-2 text-sm text-foreground hover:underline"
                >
                  <Phone className="h-4 w-4" />

                  {booking.phone}
                </a>

                {/* E-MAIL */}

                <a
                  href={`mailto:${booking.email}`}
                  className="flex items-center gap-2 text-sm text-foreground hover:underline"
                >
                  <Mail className="h-4 w-4" />

                  {booking.email}
                </a>

              </div>

              {/* =========================================
                  FAHRZEUG
              ========================================= */}

              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">

                <Car className="h-4 w-4" />

                {booking.car}

              </div>

              {/* =========================================
                  PROBLEM
              ========================================= */}

              <div className="mt-5 border-t border-border pt-5">

                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Problem / Anliegen
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {booking.problem}
                </p>

              </div>

              {/* =========================================
                  BILDER
              ========================================= */}

              <div className="mt-6 border-t border-border pt-5">

                <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted-foreground">

                  <ImageIcon className="h-4 w-4" />

                  Kundenbilder

                  {imagePaths.length > 0 &&
                    ` (${imagePaths.length})`}

                </div>

                {/* KEINE BILDER */}

                {imagePaths.length === 0 ? (

                  <div className="mt-3 border border-border p-5 text-center">

                    <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />

                    <p className="mt-2 text-xs text-muted-foreground">
                      Keine Kundenbilder vorhanden
                    </p>

                  </div>

                ) : (

                  /* BILDER */

                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">

                    {imagePaths.map(
                      (path, index) => {

                        const url =
                          getImageUrl(path)

                        if (!url) {
                          return null
                        }

                        return (
                          <a
                            key={`${path}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block aspect-square overflow-hidden border border-border bg-background"
                          >

                            <img
                              src={url}
                              alt={`Kundenbild ${index + 1}`}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(event) => {
                                console.error(
                                  "Bild konnte nicht geladen werden:",
                                  url,
                                )

                                event.currentTarget.style.display =
                                  "none"
                              }}
                            />

                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-2 text-center text-[10px] uppercase tracking-wider text-white">
                              Bild {index + 1}
                            </div>

                          </a>
                        )
                      },
                    )}

                  </div>
                )}

              </div>

              {/* =========================================
                  BUTTONS
              ========================================= */}

              {booking.status ===
                "pending" && (

                <div className="mt-6 flex flex-wrap gap-2">

                  {/* BESTÄTIGEN */}

                  <button
                    type="button"
                    disabled={
                      isPending &&
                      busyId === booking.id
                    }
                    onClick={() =>
                      handleUpdate(
                        booking.id,
                        "confirmed",
                      )
                    }
                    className="flex items-center gap-2 border border-[var(--ok)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--ok)] transition-colors hover:bg-[var(--ok)] hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    <Check className="h-4 w-4" />

                    {isPending &&
                    busyId === booking.id
                      ? "Wird verarbeitet..."
                      : "Bestätigen"}

                  </button>

                  {/* ABLEHNEN */}

                  <button
                    type="button"
                    disabled={
                      isPending &&
                      busyId === booking.id
                    }
                    onClick={() =>
                      handleUpdate(
                        booking.id,
                        "rejected",
                      )
                    }
                    className="flex items-center gap-2 border border-[var(--bad)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--bad)] transition-colors hover:bg-[var(--bad)] hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    <X className="h-4 w-4" />

                    {isPending &&
                    busyId === booking.id
                      ? "Wird verarbeitet..."
                      : "Ablehnen"}

                  </button>

                </div>
              )}

            </article>
          )
        })}

      </div>

    </div>
  )
}
