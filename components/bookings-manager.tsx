"use client"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  CalendarDays,
  Check,
  Clock,
  Mail,
  Phone,
  Trash2,
  X,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react"

import {
  deleteBooking,
  updateBookingStatus,
  type Booking,
  type BookingStatus,
} from "@/app/actions"

import { createClient } from "@/lib/supabase/client"

// ============================================================
// FILTER
// ============================================================

const FILTERS: {
  key: BookingStatus | "all"
  label: string
}[] = [
  {
    key: "all",
    label: "Alle",
  },
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
    label: "Storniert",
  },
]

// ============================================================
// PROPS
// ============================================================

type BookingsManagerProps = {
  bookings: Booking[]
}

// ============================================================
// SUPABASE
// ============================================================

const STORAGE_BUCKET = "Kunden-Bilder"

// ============================================================
// COMPONENT
// ============================================================

export function BookingsManager({
  bookings,
}: BookingsManagerProps) {
  // ==========================================================
  // SICHERHEIT
  // ==========================================================

  const safeBookings = Array.isArray(bookings)
    ? bookings
    : []

  // ==========================================================
  // SUPABASE CLIENT
  // ==========================================================

  const supabase = createClient()

  // ==========================================================
  // STATE
  // ==========================================================

  const [filter, setFilter] =
    useState<BookingStatus | "all">("all")

  const [search, setSearch] =
    useState("")

  const [processingId, setProcessingId] =
    useState<string | null>(null)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  // ==========================================================
  // BILD-URLS
  //
  // Hier werden die Bilder DIREKT aus dem öffentlichen
  // Supabase Storage Bucket geladen.
  // ==========================================================

  const [imageUrls, setImageUrls] =
    useState<Record<string, string>>({})

  // ==========================================================
  // BILDER AUS SUPABASE LADEN
  // ==========================================================

  useEffect(() => {
    async function loadImages() {
      const urls: Record<string, string> = {}

      for (const booking of safeBookings) {
        if (
          !Array.isArray(
            booking.image_urls,
          )
        ) {
          continue
        }

        for (
          const fileName of booking.image_urls
        ) {
          if (
            typeof fileName !== "string" ||
            !fileName.trim()
          ) {
            continue
          }

          const cleanFileName =
            fileName.trim()

          // ==================================================
          // DIREKT AUS SUPABASE STORAGE
          // ==================================================

          const {
            data,
          } =
            supabase.storage
              .from(
                STORAGE_BUCKET,
              )
              .getPublicUrl(
                cleanFileName,
              )

          if (
            data?.publicUrl
          ) {
            urls[
              cleanFileName
            ] = data.publicUrl
          }
        }
      }

      setImageUrls(urls)
    }

    loadImages()
  }, [safeBookings, supabase])

  // ==========================================================
  // FILTERED BOOKINGS
  // ==========================================================

  const filteredBookings =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return safeBookings
        .filter((booking) => {
          if (
            filter === "all"
          ) {
            return true
          }

          return (
            booking.status ===
            filter
          )
        })
        .filter((booking) => {
          if (!query) {
            return true
          }

          return [
            booking.name,
            booking.email,
            booking.phone,
            booking.car,
            booking.problem,
            booking.booking_date,
            booking.booking_time,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query),
            )
        })
    }, [
      safeBookings,
      filter,
      search,
    ])

  // ==========================================================
  // STATUS ÄNDERN
  // ==========================================================

  async function handleStatus(
    bookingId: string,
    status: BookingStatus,
  ) {
    setError(null)
    setProcessingId(bookingId)

    try {
      const result =
        await updateBookingStatus(
          bookingId,
          status,
        )

      if (!result.ok) {
        setError(
          result.error ||
            "Die Buchung konnte nicht aktualisiert werden.",
        )
      }
    } catch (error) {
      console.error(
        "Status Fehler:",
        error,
      )

      setError(
        "Beim Aktualisieren ist ein Fehler aufgetreten.",
      )
    } finally {
      setProcessingId(null)
    }
  }

  // ==========================================================
  // LÖSCHEN
  // ==========================================================

  async function handleDelete(
    bookingId: string,
  ) {
    const confirmed =
      window.confirm(
        "Möchtest du diese Buchung wirklich löschen?",
      )

    if (!confirmed) {
      return
    }

    setError(null)
    setDeletingId(bookingId)

    try {
      const result =
        await deleteBooking(
          bookingId,
        )

      if (!result.ok) {
        setError(
          result.error ||
            "Die Buchung konnte nicht gelöscht werden.",
        )
      }
    } catch (error) {
      console.error(
        "Delete Fehler:",
        error,
      )

      setError(
        "Beim Löschen ist ein Fehler aufgetreten.",
      )
    } finally {
      setDeletingId(null)
    }
  }

  // ==========================================================
  // STATUS LABEL
  // ==========================================================

  function getStatusLabel(
    status: BookingStatus,
  ) {
    switch (status) {
      case "confirmed":
        return "Bestätigt"

      case "rejected":
        return "Storniert"

      case "pending":
      default:
        return "Offen"
    }
  }

  // ==========================================================
  // STATUS STYLE
  // ==========================================================

  function getStatusClass(
    status: BookingStatus,
  ) {
    switch (status) {
      case "confirmed":
        return [
          "border-green-500/30",
          "bg-green-500/10",
          "text-green-600",
        ].join(" ")

      case "rejected":
        return [
          "border-red-500/30",
          "bg-red-500/10",
          "text-red-600",
        ].join(" ")

      case "pending":
      default:
        return [
          "border-yellow-500/30",
          "bg-yellow-500/10",
          "text-yellow-600",
        ].join(" ")
    }
  }

  // ==========================================================
  // DATUM FORMATIEREN
  // ==========================================================

  function formatDate(
    value: string,
  ) {
    if (!value) {
      return "-"
    }

    const date =
      new Date(
        `${value}T00:00:00`,
      )

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return value
    }

    return new Intl.DateTimeFormat(
      "de-CH",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    ).format(date)
  }

  // ==========================================================
  // STATISTIK
  // ==========================================================

  const pendingCount =
    safeBookings.filter(
      (booking) =>
        booking.status ===
        "pending",
    ).length

  const confirmedCount =
    safeBookings.filter(
      (booking) =>
        booking.status ===
        "confirmed",
    ).length

  const rejectedCount =
    safeBookings.filter(
      (booking) =>
        booking.status ===
        "rejected",
    ).length

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* ====================================================
          STATISTIK
      ==================================================== */}

      <div className="grid gap-4 sm:grid-cols-3">

        {/* OFFEN */}

        <div className="border border-border bg-card p-5">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Offen
              </p>

              <p className="mt-2 text-3xl font-bold">
                {pendingCount}
              </p>

            </div>

            <Clock className="h-7 w-7 text-yellow-500" />

          </div>

        </div>

        {/* BESTÄTIGT */}

        <div className="border border-border bg-card p-5">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Bestätigt
              </p>

              <p className="mt-2 text-3xl font-bold">
                {confirmedCount}
              </p>

            </div>

            <Check className="h-7 w-7 text-green-500" />

          </div>

        </div>

        {/* STORNIERT */}

        <div className="border border-border bg-card p-5">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Storniert
              </p>

              <p className="mt-2 text-3xl font-bold">
                {rejectedCount}
              </p>

            </div>

            <X className="h-7 w-7 text-red-500" />

          </div>

        </div>

      </div>

      {/* ====================================================
          FILTER + SUCHE
      ==================================================== */}

      <div className="border border-border bg-card p-4">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex flex-wrap gap-2">

            {FILTERS.map(
              (item) => {

                const active =
                  filter ===
                  item.key

                return (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    onClick={() =>
                      setFilter(
                        item.key,
                      )
                    }
                    className={[
                      "border px-4 py-2 text-xs font-bold uppercase tracking-wider transition",

                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary",
                    ].join(
                      " ",
                    )}
                  >
                    {
                      item.label
                    }
                  </button>
                )
              },
            )}

          </div>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buchung suchen..."
            className="w-full border border-input bg-background px-4 py-2 text-sm outline-none lg:max-w-xs"
          />

        </div>

      </div>

      {/* ====================================================
          FEHLER
      ==================================================== */}

      {error && (

        <div className="border border-red-500/30 bg-red-500/10 p-4">

          <p className="text-sm text-red-600">
            {error}
          </p>

        </div>

      )}

      {/* ====================================================
          KEINE BUCHUNGEN
      ==================================================== */}

      {filteredBookings.length === 0 && (

        <div className="border border-border bg-card p-12 text-center">

          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />

          <h3 className="mt-4 font-display text-lg font-bold uppercase">
            Keine Buchungen
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            Es wurden keine passenden
            Buchungen gefunden.
          </p>

        </div>

      )}

      {/* ====================================================
          BUCHUNGEN
      ==================================================== */}

      <div className="space-y-4">

        {filteredBookings.map(
          (booking) => {

            const processing =
              processingId ===
              booking.id

            const deleting =
              deletingId ===
              booking.id

            // ================================================
            // BILDER DER BUCHUNG
            // ================================================

            const images =
              Array.isArray(
                booking.image_urls,
              )
                ? booking.image_urls.filter(
                    (image) =>
                      typeof image ===
                        "string" &&
                      image.trim()
                        .length > 0,
                  )
                : []

            return (

              <div
                key={
                  booking.id
                }
                className="border border-border bg-card p-5 md:p-6"
              >

                {/* ==========================================
                    HEADER
                ========================================== */}

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                  <div>

                    <div className="flex flex-wrap items-center gap-3">

                      <h3 className="text-lg font-bold">
                        {
                          booking.name
                        }
                      </h3>

                      <span
                        className={[
                          "border px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
                          getStatusClass(
                            booking.status,
                          ),
                        ].join(
                          " ",
                        )}
                      >
                        {
                          getStatusLabel(
                            booking.status,
                          )
                        }
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">

                      <span>
                        {formatDate(
                          booking.booking_date,
                        )}
                      </span>

                      <span>
                        {
                          booking.booking_time
                        }
                      </span>

                    </div>

                  </div>

                  {/* LÖSCHEN */}

                  <button
                    type="button"
                    disabled={
                      deleting ||
                      processing
                    }
                    onClick={() =>
                      handleDelete(
                        booking.id,
                      )
                    }
                    className="flex items-center gap-2 self-start border border-red-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
                  >

                    <Trash2 className="h-4 w-4" />

                    {deleting
                      ? "Löschen..."
                      : "Löschen"}

                  </button>

                </div>

                {/* ==========================================
                    KUNDENDATEN
                ========================================== */}

                <div className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-2">

                  {/* TELEFON */}

                  <div>

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Telefon
                    </p>

                    <a
                      href={`tel:${booking.phone}`}
                      className="mt-1 flex items-center gap-2 text-sm font-medium hover:underline"
                    >

                      <Phone className="h-4 w-4" />

                      {
                        booking.phone
                      }

                    </a>

                  </div>

                  {/* EMAIL */}

                  <div>

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      E-Mail
                    </p>

                    <a
                      href={`mailto:${booking.email}`}
                      className="mt-1 flex items-center gap-2 break-all text-sm font-medium hover:underline"
                    >

                      <Mail className="h-4 w-4" />

                      {
                        booking.email
                      }

                    </a>

                  </div>

                  {/* FAHRZEUG */}

                  <div>

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Fahrzeug
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {
                        booking.car
                      }
                    </p>

                  </div>

                  {/* TERMIN */}

                  <div>

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Termin
                    </p>

                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">

                      <CalendarDays className="h-4 w-4" />

                      {formatDate(
                        booking.booking_date,
                      )}

                      {" "}um{" "}

                      {
                        booking.booking_time
                      }

                    </p>

                  </div>

                </div>

                {/* ==========================================
                    PROBLEM
                ========================================== */}

                <div className="mt-5 border-t border-border pt-5">

                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Problem / Anliegen
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {
                      booking.problem
                    }
                  </p>

                </div>

                {/* ==========================================
                    KUNDEN-BILDER
                ========================================== */}

                <div className="mt-5 border-t border-border pt-5">

                  <div className="flex items-center gap-2">

                    <ImageIcon className="h-5 w-5" />

                    <p className="text-xs font-bold uppercase tracking-widest">
                      Kunden-Bilder
                    </p>

                    {images.length > 0 && (

                      <span className="text-xs text-muted-foreground">
                        ({images.length})
                      </span>

                    )}

                  </div>

                  {/* ========================================
                      KEINE BILDER
                  ======================================== */}

                  {images.length === 0 ? (

                    <div className="mt-4 border border-dashed border-border p-6 text-center">

                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />

                      <p className="mt-2 text-sm text-muted-foreground">
                        Keine Bilder hochgeladen.
                      </p>

                    </div>

                  ) : (

                    /* ======================================
                       BILDER
                    ====================================== */

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">

                      {images.map(
                        (
                          image,
                          index,
                        ) => {

                          const cleanFileName =
                            image.trim()

                          // =================================
                          // DIREKTE SUPABASE PUBLIC URL
                          // =================================

                          const imageUrl =
                            imageUrls[
                              cleanFileName
                            ]

                          return (

                            <div
                              key={`${cleanFileName}-${index}`}
                              className="overflow-hidden border border-border bg-background"
                            >

                              {/* BILD */}

                              <div className="relative aspect-square overflow-hidden bg-secondary">

                                {imageUrl ? (

                                  <a
                                    href={
                                      imageUrl
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block h-full w-full"
                                  >

                                    <img
                                      src={
                                        imageUrl
                                      }
                                      alt={`Kundenbild ${
                                        index +
                                        1
                                      }`}
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                      loading="lazy"
                                      onError={(
                                        event,
                                      ) => {

                                        console.error(
                                          "SUPABASE BILD FEHLER:",
                                          imageUrl,
                                        )

                                        event.currentTarget.style.display =
                                          "none"
                                      }}
                                    />

                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">

                                      <ExternalLink className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" />

                                    </div>

                                  </a>

                                ) : (

                                  <div className="flex h-full w-full items-center justify-center">

                                    <div className="text-center">

                                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />

                                      <p className="mt-2 text-xs text-muted-foreground">
                                        Bild wird geladen...
                                      </p>

                                    </div>

                                  </div>

                                )}

                              </div>

                              {/* DATEINAME */}

                              <div className="border-t border-border px-3 py-2">

                                <p className="truncate text-xs font-medium">
                                  Bild{" "}
                                  {index +
                                    1}
                                </p>

                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {
                                    cleanFileName
                                  }
                                </p>

                              </div>

                            </div>

                          )
                        },
                      )}

                    </div>

                  )}

                </div>

                {/* ==========================================
                    AKTIONEN
                ========================================== */}

                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">

                  {/* BESTÄTIGEN */}

                  <button
                    type="button"
                    disabled={
                      processing ||
                      deleting ||
                      booking.status ===
                        "confirmed"
                    }
                    onClick={() =>
                      handleStatus(
                        booking.id,
                        "confirmed",
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-2 bg-green-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >

                    <Check className="h-4 w-4" />

                    {processing &&
                    processingId ===
                      booking.id
                      ? "Wird gespeichert..."
                      : "Bestätigen"}

                  </button>

                  {/* STORNIEREN */}

                  <button
                    type="button"
                    disabled={
                      processing ||
                      deleting ||
                      booking.status ===
                        "rejected"
                    }
                    onClick={() =>
                      handleStatus(
                        booking.id,
                        "rejected",
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-2 border border-red-500/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >

                    <X className="h-4 w-4" />

                    Stornieren

                  </button>

                  {/* WIEDER ÖFFNEN */}

                  {booking.status !==
                    "pending" && (

                    <button
                      type="button"
                      disabled={
                        processing ||
                        deleting
                      }
                      onClick={() =>
                        handleStatus(
                          booking.id,
                          "pending",
                        )
                      }
                      className="flex flex-1 items-center justify-center gap-2 border border-border px-4 py-3 text-xs font-bold uppercase tracking-widest transition hover:bg-secondary disabled:opacity-40"
                    >

                      <Clock className="h-4 w-4" />

                      Wieder öffnen

                    </button>

                  )}

                </div>

              </div>

            )
          },
        )}

      </div>

    </div>
  )
}
