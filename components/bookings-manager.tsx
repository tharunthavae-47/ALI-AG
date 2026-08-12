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

const FILTERS: { key: BookingStatus | "all"; label: string }[] = [
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

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00")

  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function BookingsManager({
  initialBookings,
}: {
  initialBookings: Booking[]
}) {
  const [bookings, setBookings] = useState(initialBookings)
  const [filter, setFilter] = useState<BookingStatus | "all">("pending")
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = bookings.filter((b) =>
    filter === "all" ? true : b.status === filter
  )

  const counts = {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    rejected: bookings.filter((b) => b.status === "rejected").length,
  }

  function handleUpdate(
    id: string,
    status: Exclude<BookingStatus, "pending">
  ) {
    setBusyId(id)

    startTransition(async () => {
      try {
        const res = await updateBookingStatus(id, status)

        if (res.ok) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status } : b
            )
          )
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren:", error)
      } finally {
        setBusyId(null)
      }
    })
  }

  function getImageUrl(path: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!supabaseUrl || !path) {
      return ""
    }

    return `${supabaseUrl}/storage/v1/object/public/kunden-bilder/${path}`
  }

  function getImagePaths(imageUrls: Booking["image_urls"]): string[] {
    if (!imageUrls) {
      return []
    }

    // Bereits ein Array
    if (Array.isArray(imageUrls)) {
      return imageUrls.filter(
        (path): path is string =>
          typeof path === "string" && path.length > 0
      )
    }

    // Falls Supabase einen String zurückgibt
    if (typeof imageUrls === "string") {
      try {
        const parsed = JSON.parse(imageUrls)

        if (Array.isArray(parsed)) {
          return parsed.filter(
            (path): path is string =>
              typeof path === "string" && path.length > 0
          )
        }

        // "{}" oder andere ungültige Formate
        return []
      } catch {
        return []
      }
    }

    return []
  }

  return (
    <div>
      {/* Statistik */}
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

      {/* Filter */}
      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              "border px-4 py-2 font-display text-xs uppercase tracking-widest transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Buchungen */}
      <div className="mt-6 space-y-px">
        {visible.length === 0 && (
          <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Keine Einträge in dieser Ansicht.
          </p>
        )}

        {visible.map((b) => {
          const imagePaths = getImagePaths(b.image_urls)

          return (
            <article
              key={b.id}
              className="border border-border bg-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="w-full">
                  {/* Name + Status */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
                      {b.name}
                    </h3>

                    <span
                      className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                        statusStyles[b.status]
                      }`}
                    >
                      {statusLabels[b.status]}
                    </span>
                  </div>

                  {/* Termin Informationen */}
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Calendar
                        className="h-4 w-4"
                        strokeWidth={1.5}
                      />
                      {formatDate(b.booking_date)}
                    </span>

                    <span className="flex items-center gap-2">
                      <Clock
                        className="h-4 w-4"
                        strokeWidth={1.5}
                      />
                      {b.booking_time}
                    </span>

                    <span className="flex items-center gap-2">
                      <Phone
                        className="h-4 w-4"
                        strokeWidth={1.5}
                      />
                      {b.contact}
                    </span>

                    <span className="flex items-center gap-2">
                      <Car
                        className="h-4 w-4"
                        strokeWidth={1.5}
                      />
                      {b.car}
                    </span>
                  </div>

                  {/* Problem */}
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/90">
                    {b.problem}
                  </p>

                  {/* Kundenbilder */}
                  {imagePaths.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                        Kundenbilder ({imagePaths.length})
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {imagePaths.map((imagePath, index) => {
                          const imageUrl = getImageUrl(imagePath)

                          if (!imageUrl) {
                            return null
                          }

                          return (
                            <a
                              key={`${imagePath}-${index}`}
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative aspect-square overflow-hidden border border-border bg-background"
                            >
                              <img
                                src={imageUrl}
                                alt={`Kundenbild ${index + 1}`}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />

                              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-[10px] uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
                                Bild öffnen
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Keine Bilder */}
                  {imagePaths.length === 0 && (
                    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      Keine Kundenbilder vorhanden
                    </div>
                  )}

                  {/* Buttons */}
                  {b.status === "pending" && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdate(b.id, "confirmed")
                        }
                        disabled={
                          isPending && busyId === b.id
                        }
                        className="flex items-center gap-2 border border-[var(--ok)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--ok)] transition-colors hover:bg-[var(--ok)] hover:text-background disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Bestätigen
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdate(b.id, "rejected")
                        }
                        disabled={
                          isPending && busyId === b.id
                        }
                        className="flex items-center gap-2 border border-[var(--bad)] px-4 py-2 font-display text-xs uppercase tracking-widest text-[var(--bad)] transition-colors hover:bg-[var(--bad)] hover:text-background disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Ablehnen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
