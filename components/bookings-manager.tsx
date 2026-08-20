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
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import {
  deleteBooking,
  updateBookingStatus,
  type Booking,
  type BookingStatus,
} from "@/app/actions"

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
// SUPABASE STORAGE
// ============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://cfiumzbuavfbahctzknr.supabase.co"

const STORAGE_BUCKET = "Kunden-Bilder"

// ============================================================
// BILD URL
// ============================================================

function getSupabaseImageUrl(
  fileName: string,
) {
  if (!fileName) {
    return ""
  }

  const cleanFileName =
    fileName.trim()

  if (!cleanFileName) {
    return ""
  }

  // Bereits komplette URL
  if (
    cleanFileName.startsWith("http://") ||
    cleanFileName.startsWith("https://")
  ) {
    return cleanFileName
  }

  // Supabase Storage Pfad
  const encodedPath =
    cleanFileName
      .split("/")
      .map((part) =>
        encodeURIComponent(part),
      )
      .join("/")

  return (
    `${SUPABASE_URL}` +
    `/storage/v1/object/public/` +
    `${encodeURIComponent(STORAGE_BUCKET)}/` +
    `${encodedPath}`
  )
}

// ============================================================
// COMPONENT
// ============================================================

export function BookingsManager({
  bookings,
}: BookingsManagerProps) {
  // ==========================================================
  // SAFE BOOKINGS
  // ==========================================================

  const safeBookings =
    Array.isArray(bookings)
      ? bookings
      : []

  // ==========================================================
  // STATE
  // ==========================================================

  const [filter, setFilter] =
    useState<
      BookingStatus | "all"
    >("all")

  const [search, setSearch] =
    useState("")

  const [processingId, setProcessingId] =
    useState<string | null>(null)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  // ==========================================================
  // BILD MODAL
  // ==========================================================

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null)

  const [selectedImageIndex, setSelectedImageIndex] =
    useState(0)

  const [selectedImages, setSelectedImages] =
    useState<string[]>([])

  // ==========================================================
  // BILD ÖFFNEN
  // ==========================================================

  function openImage(
    images: string[],
    index: number,
  ) {
    if (
      !images.length ||
      !images[index]
    ) {
      return
    }

    setSelectedImages(images)
    setSelectedImageIndex(index)
    setSelectedImage(images[index])
  }

  // ==========================================================
  // BILD SCHLIESSEN
  // ==========================================================

  function closeImage() {
    setSelectedImage(null)
    setSelectedImages([])
    setSelectedImageIndex(0)
  }

  // ==========================================================
  // VORHERIGES BILD
  // ==========================================================

  function previousImage() {
    if (
      selectedImages.length <= 1
    ) {
      return
    }

    const newIndex =
      selectedImageIndex === 0
        ? selectedImages.length - 1
        : selectedImageIndex - 1

    setSelectedImageIndex(
      newIndex,
    )

    setSelectedImage(
      selectedImages[newIndex],
    )
  }

  // ==========================================================
  // NÄCHSTES BILD
  // ==========================================================

  function nextImage() {
    if (
      selectedImages.length <= 1
    ) {
      return
    }

    const newIndex =
      selectedImageIndex ===
      selectedImages.length - 1
        ? 0
        : selectedImageIndex + 1

    setSelectedImageIndex(
      newIndex,
    )

    setSelectedImage(
      selectedImages[newIndex],
    )
  }

  // ==========================================================
  // ESC + BODY SCROLL
  // ==========================================================

  useEffect(() => {
    if (!selectedImage) {
      return
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        closeImage()
      }

      if (event.key === "ArrowLeft") {
        previousImage()
      }

      if (event.key === "ArrowRight") {
        nextImage()
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    )

    const originalOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      "hidden"

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      )

      document.body.style.overflow =
        originalOverflow
    }
  }, [
    selectedImage,
    selectedImageIndex,
    selectedImages,
  ])

  // ==========================================================
  // FILTER
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
  // STATUS
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
  // DELETE
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

      default:
        return [
          "border-yellow-500/30",
          "bg-yellow-500/10",
          "text-yellow-600",
        ].join(" ")
    }
  }

  // ==========================================================
  // DATUM
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
    <>
      <div className="space-y-6">

        {/* ====================================================
            STATISTIK
        ==================================================== */}

        <div className="grid gap-4 sm:grid-cols-3">

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
            FILTER
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
                      ].join(" ")}
                    >
                      {item.label}
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
            ERROR
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

              // ==================================================
              // BILDER
              // ==================================================

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

              const imageUrls =
                images
                  .map(
                    (image) =>
                      getSupabaseImageUrl(
                        image,
                      ),
                  )
                  .filter(Boolean)

              return (
                <div
                  key={
                    booking.id
                  }
                  className="border border-border bg-card p-5 md:p-6"
                >

                  {/* ==================================================
                      HEADER
                  ================================================== */}

                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                    <div>

                      <div className="flex flex-wrap items-center gap-3">

                        <h3 className="text-lg font-bold">
                          {booking.name}
                        </h3>

                        <span
                          className={[
                            "border px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
                            getStatusClass(
                              booking.status,
                            ),
                          ].join(" ")}
                        >
                          {getStatusLabel(
                            booking.status,
                          )}
                        </span>

                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">

                        <span>
                          {formatDate(
                            booking.booking_date,
                          )}
                        </span>

                        <span>
                          {booking.booking_time}
                        </span>

                      </div>

                    </div>

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

                  {/* ==================================================
                      KUNDENDATEN
                  ================================================== */}

                  <div className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-2">

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Telefon
                      </p>

                      <a
                        href={`tel:${booking.phone}`}
                        className="mt-1 flex items-center gap-2 text-sm font-medium hover:underline"
                      >

                        <Phone className="h-4 w-4" />

                        {booking.phone}

                      </a>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        E-Mail
                      </p>

                      <a
                        href={`mailto:${booking.email}`}
                        className="mt-1 flex items-center gap-2 break-all text-sm font-medium hover:underline"
                      >

                        <Mail className="h-4 w-4" />

                        {booking.email}

                      </a>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Fahrzeug
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {booking.car}
                      </p>
                    </div>

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

                        {booking.booking_time}

                      </p>
                    </div>

                  </div>

                  {/* ==================================================
                      PROBLEM
                  ================================================== */}

                  <div className="mt-5 border-t border-border pt-5">

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Problem / Anliegen
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {booking.problem}
                    </p>

                  </div>

                  {/* ==================================================
                      KUNDEN-BILDER
                  ================================================== */}

                  <div className="mt-5 border-t border-border pt-5">

                    <div className="flex items-center gap-2">

                      <ImageIcon className="h-5 w-5" />

                      <p className="text-xs font-bold uppercase tracking-widest">
                        Kunden-Bilder
                      </p>

                      {imageUrls.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({imageUrls.length})
                        </span>
                      )}

                    </div>

                    {/* ==================================================
                        KEINE BILDER
                    ================================================== */}

                    {imageUrls.length === 0 ? (

                      <div className="mt-4 border border-dashed border-border p-6 text-center">

                        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />

                        <p className="mt-2 text-sm text-muted-foreground">
                          Keine Bilder hochgeladen.
                        </p>

                      </div>

                    ) : (

                      /* ==================================================
                         BILDER
                      ================================================== */

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">

                        {imageUrls.map(
                          (
                            imageUrl,
                            index,
                          ) => {

                            return (
                              <button
                                key={`${imageUrl}-${index}`}
                                type="button"
                                onClick={() =>
                                  openImage(
                                    imageUrls,
                                    index,
                                  )
                                }
                                className="group relative overflow-hidden border border-border bg-background text-left focus:outline-none focus:ring-2 focus:ring-primary"
                              >

                                {/* BILD */}

                                <div className="relative aspect-square overflow-hidden bg-secondary">

                                  <img
                                    src={
                                      imageUrl
                                    }
                                    alt={`Kundenbild ${
                                      index +
                                      1
                                    }`}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    loading="lazy"
                                    onLoad={() => {
                                      console.log(
                                        "SUPABASE BILD GELADEN:",
                                        imageUrl,
                                      )
                                    }}
                                    onError={() => {
                                      console.error(
                                        "SUPABASE BILD KONNTE NICHT GELADEN WERDEN:",
                                        imageUrl,
                                      )
                                    }}
                                  />

                                  {/* OVERLAY */}

                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition duration-300 group-hover:bg-black/40">

                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition duration-300 group-hover:opacity-100">

                                      <Maximize2 className="h-5 w-5 text-black" />

                                    </div>

                                  </div>

                                </div>

                                {/* BESCHRIFTUNG */}

                                <div className="border-t border-border px-3 py-2">

                                  <p className="truncate text-xs font-bold">
                                    Bild{" "}
                                    {index + 1}
                                  </p>

                                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                    Vergrössern
                                  </p>

                                </div>

                              </button>
                            )
                          },
                        )}

                      </div>
                    )}

                  </div>

                  {/* ==================================================
                      AKTIONEN
                  ================================================== */}

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

                      {processing
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

      {/* ========================================================
          BILD MODAL / LIGHTBOX
      ======================================================== */}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeImage()
            }
          }}
        >

          {/* ====================================================
              SCHLIESSEN
          ==================================================== */}

          <button
            type="button"
            aria-label="Bild schließen"
            onClick={closeImage}
            className="absolute right-4 top-4 z-[110] flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >

            <X className="h-6 w-6" />

          </button>

          {/* ====================================================
              BILD NUMMER
          ==================================================== */}

          {selectedImages.length > 0 && (
            <div className="absolute left-4 top-4 z-[110] rounded-full bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">

              Bild{" "}
              {selectedImageIndex + 1}
              {" / "}
              {selectedImages.length}

            </div>
          )}

          {/* ====================================================
              VORHERIGES BILD
          ==================================================== */}

          {selectedImages.length > 1 && (
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={previousImage}
              className="absolute left-3 top-1/2 z-[110] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
            >

              <ChevronLeft className="h-7 w-7" />

            </button>
          )}

          {/* ====================================================
              NÄCHSTES BILD
          ==================================================== */}

          {selectedImages.length > 1 && (
            <button
              type="button"
              aria-label="Nächstes Bild"
              onClick={nextImage}
              className="absolute right-3 top-1/2 z-[110] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
            >

              <ChevronRight className="h-7 w-7" />

            </button>
          )}

          {/* ====================================================
              GROSSES BILD
          ==================================================== */}

          <div className="flex max-h-[90vh] max-w-[92vw] items-center justify-center">

            <img
              src={selectedImage}
              alt={`Kundenbild ${
                selectedImageIndex + 1
              }`}
              className="max-h-[90vh] max-w-[92vw] rounded-sm object-contain shadow-2xl"
            />

          </div>

        </div>
      )}
    </>
  )
}
