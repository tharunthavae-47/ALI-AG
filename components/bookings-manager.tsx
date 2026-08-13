"use client"

import { useState, useTransition } from "react"
import {
  Check,
  X,
  Phone,
  Car,
  Calendar,
  Clock,
  Image as ImageIcon,
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
  pending:
    "text-[var(--warn)] border-[var(--warn)]",

  confirmed:
    "text-[var(--ok)] border-[var(--ok)]",

  rejected:
    "text-[var(--bad)] border-[var(--bad)]",
}

const statusLabels: Record<BookingStatus, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00")

  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * image_urls kann aus Supabase z.B. so kommen:
 *
 * ["Max-1.jpg","Max-2.jpg"]
 *
 * oder:
 *
 * '["Max-1.jpg","Max-2.jpg"]'
 *
 * oder:
 *
 * "Max-1.jpg"
 */
function getImagePaths(
  imageUrls: Booking["image_urls"],
): string[] {
  if (!imageUrls) {
    return []
  }

  // Bereits ein Array
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(
      (path): path is string =>
        typeof path === "string" &&
        path.trim() !== "" &&
        path.trim() !== "[]",
    )
  }

  // String
  if (typeof imageUrls === "string") {
    const value = imageUrls.trim()

    if (
      value === "" ||
      value === "[]" ||
      value === "{}" ||
      value === "null"
    ) {
      return []
    }

    // Versuche JSON zu lesen
    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (path): path is string =>
            typeof path === "string" &&
            path.trim() !== "" &&
            path.trim() !== "[]",
        )
      }
    } catch {
      // Kein JSON -> normaler Dateipfad
    }

    return [value]
  }

  return []
}

/**
 * Erstellt die öffentliche URL
 * für den Bucket "Kunden-Bilder".
 */
function getImageUrl(path: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl || !path) {
    return ""
  }

  let cleanPath = path.trim()

  // Falls versehentlich eine komplette URL gespeichert wurde
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath
  }

  // Führende / entfernen
  cleanPath = cleanPath.replace(/^\/+/, "")

  if (
    !cleanPath ||
    cleanPath === "[]" ||
    cleanPath === "null"
  ) {
    return ""
  }

  return `${supabaseUrl}/storage/v1/object/public/Kunden-Bilder/${cleanPath}`
}

export function BookingsManager({
  initialBookings,
}: {
  initialBookings: Booking[]
}) {
  const [bookings, setBookings] =
    useState<Booking[]>(initialBookings)

  const [filter, setFilter] =
    useState<BookingStatus | "all">("pending")

  const [isPending, startTransition] =
    useTransition()

  const [busyId, setBusyId] =
    useState<string | null>(null)

  const visible = bookings.filter((booking) =>
    filter === "all"
      ? true
      : booking.status === filter,
  )

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
          console.error(
            "Fehler beim Aktualisieren:",
            result,
          )
        }
      } catch (error) {
        console.error(
          "Fehler beim Aktualisieren:",
          error,
        )
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <div>
      {/* ===================================== */}
      {/* STATISTIK */}
      {/* ===================================== */}

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

      {/* ===================================== */}
      {/* FILTER */}
      {/* ===================================== */}

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((filterItem) => (
          <button
            key={filterItem.key}
            type="button"
            onClick={() =>
              setFilter(filterItem.key)
            }
            className={[
              "border px-4 py-2 font-display text-xs uppercase tracking-widest transition-colors",

              filter === filterItem.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {filterItem.label}
          </button>
        ))}
      </div>

      {/* ===================================== */}
      {/* BUCHUNGEN */}
      {/* ===================================== */}

      <div className="mt-6 space-y-px">
        {visible.length === 0 && (
          <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Keine Einträge in dieser Ansicht.
          </p>
        )}

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
              <div className="w-full">

                {/* ================================= */}
                {/* NAME + STATUS */}
                {/* ================================= */}

                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
                    {booking.name}
                  </h3>

                  <span
                    className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusStyles[booking.status]}`}
                  >
                    {statusLabels[booking.status]}
                  </span>
                </div>

                {/* ================================= */}
                {/* TERMIN INFORMATIONEN */}
                {/* ================================= */}

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">

                  <span className="flex items-center gap-2">
                    <Calendar
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />

                    {formatDate(
                      booking.booking_date,
                    )}
                  </span>

                  <span className="flex items-center gap-2">
                    <Clock
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />

                    {booking.booking_time}
                  </span>

                  <span className="flex items-center gap-2">
                    <Phone
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />

                    {booking.contact}
                  </span>

                  <span className="flex items-center gap-2">
                    <Car
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />

                    {booking.car}
                  </span>
                </div>

                {/* ================================= */}
                {/* PROBLEM */}
                {/* ================================= */}

                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/90">
                  {booking.problem}
                </p>

                {/* ================================= */}
                {/* KUNDENBILDER */}
                {/* ================================= */}

                <div className="mt-6">

                  <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
                    <ImageIcon
                      className="h-4 w-4"
                    />

                    Kundenbilder

                    {imagePaths.length > 0 &&
                      ` (${imagePaths.length})`}
                  </div>

                  {imagePaths.length === 0 ? (

                    <div className="mt-3 border border-border bg-background p-5 text-center">

                      <ImageIcon
                        className="mx-auto h-6 w-6 text-muted-foreground"
                      />

                      <p className="mt-2 text-xs text-muted-foreground">
                        Keine Kundenbilder vorhanden
                      </p>

                      {/* DEBUG */}
                      <p className="mt-2 break-all text-[10px] text-muted-foreground/50">
                        image_urls:{" "}
                        {JSON.stringify(
                          booking.image_urls,
                        )}
                      </p>

                    </div>

                  ) : (

                    <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">

                      {imagePaths.map(
                        (
                          imagePath,
                          index,
                        ) => {

                          const imageUrl =
                            getImageUrl(
                              imagePath,
                            )

                          console.log(
                            "Kundenbild:",
                            {
                              imagePath,
                              imageUrl,
                            },
                          )

                          if (!imageUrl) {
                            return null
                          }

                          return (
                            <div
                              key={`${imagePath}-${index}`}
                              className="group relative overflow-hidden border border-border bg-background"
                            >

                              {/* BILD */}

                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block aspect-square"
                              >

                                <img
                                  src={imageUrl}
                                  alt={`Kundenbild ${index + 1}`}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  onError={(event) => {
                                    console.error(
                                      "BILD FEHLER:",
                                      imageUrl,
                                    )

                                    event.currentTarget.style.display =
                                      "none"
                                  }}
                                />

                              </a>

                              {/* NUMMER */}

                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-2 text-center text-[10px] uppercase tracking-wider text-white">
                                Bild{" "}
                                {index + 1}
                              </div>

                            </div>
                          )
                        },
                      )}

                    </div>
                  )}

                </div>

                {/* ================================= */}
                {/* BUTTONS */}
                {/* ================================= */}

                {booking.status ===
                  "pending" && (

                  <div className="mt-6 flex flex-wrap gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          booking.id,
                          "confirmed",
                        )
                      }
                      disabled={
                        isPending &&
                        busyId ===
                          booking.id
                      }
                      className="flex items-center gap-2 border border-[var(--ok)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--ok)] transition-colors hover:bg-[var(--ok)] hover:text-background disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />

                      Bestätigen
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          booking.id,
                          "rejected",
                        )
                      }
                      disabled={
                        isPending &&
                        busyId ===
                          booking.id
                      }
                      className="flex items-center gap-2 border border-[var(--bad)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--bad)] transition-colors hover:bg-[var(--bad)] hover:text-background disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />

                      Ablehnen
                    </button>

                  </div>
                )}

              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
