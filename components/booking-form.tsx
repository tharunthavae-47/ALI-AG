"use client"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  CheckCircle2,
  ImagePlus,
  X,
} from "lucide-react"

import {
  createBooking,
  saveBookingImages,
  type BookedSlot,
} from "@/app/actions"

import { createClient } from "@/lib/supabase/client"

// ============================================================
// ZEITEN
// ============================================================

const TIMES = [
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
]

// ============================================================
// HEUTIGES DATUM
// ============================================================

function todayISO() {
  return new Date()
    .toISOString()
    .slice(0, 10)
}

// ============================================================
// BOOKING FORM
// ============================================================

export function BookingForm({
  bookedSlots,
}: {
  bookedSlots: BookedSlot[]
}) {
  // ==========================================================
  // SICHERHEIT: IMMER ARRAY VERWENDEN
  // ==========================================================

  const safeBookedSlots = Array.isArray(bookedSlots)
    ? bookedSlots
    : []

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [car, setCar] = useState("")
  const [problem, setProblem] = useState("")

  const [images, setImages] = useState<File[]>([])

  const [error, setError] =
    useState<string | null>(null)

  const [pending, setPending] =
    useState(false)

  const [done, setDone] =
    useState(false)

  // ==========================================================
  // BELEGTE ZEITEN FÜR AUSGEWÄHLTES DATUM
  // ==========================================================

  const takenForDate = useMemo(() => {
    if (!date) {
      return new Set<string>()
    }

    return new Set(
      safeBookedSlots
        .filter(
          (slot) =>
            slot.booking_date === date,
        )
        .map(
          (slot) =>
            slot.booking_time,
        ),
    )
  }, [
    safeBookedSlots,
    date,
  ])

  // ==========================================================
  // BILD-PREVIEW URLS
  // ==========================================================

  const imagePreviews = useMemo(() => {
    return images.map((image) =>
      URL.createObjectURL(image),
    )
  }, [images])

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [imagePreviews])

  // ==========================================================
  // BILDER AUSWÄHLEN
  // ==========================================================

  function handleImages(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    setError(null)

    const selected = Array.from(
      e.target.files ?? [],
    )

    const validImages = selected.filter(
      (file) => {
        // Nur Bilder
        if (!file.type.startsWith("image/")) {
          return false
        }

        // Maximal 10 MB
        if (
          file.size >
          10 * 1024 * 1024
        ) {
          return false
        }

        return true
      },
    )

    if (
      validImages.length !==
      selected.length
    ) {
      setError(
        "Einige Dateien wurden entfernt. Nur Bilder bis maximal 10 MB sind erlaubt.",
      )
    }

    // Maximal 5 Bilder
    setImages(
      validImages.slice(0, 5),
    )

    // Input zurücksetzen
    e.target.value = ""
  }

  // ==========================================================
  // BILD ENTFERNEN
  // ==========================================================

  function removeImage(
    index: number,
  ) {
    setImages((previous) =>
      previous.filter(
        (_, i) => i !== index,
      ),
    )
  }

  // ==========================================================
  // FORM ABSENDEN
  // ==========================================================

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault()

    setError(null)

    // ========================================================
    // VALIDIERUNG
    // ========================================================

    if (!date) {
      setError(
        "Bitte wählen Sie ein Datum.",
      )
      return
    }

    if (!time) {
      setError(
        "Bitte wählen Sie eine Uhrzeit.",
      )
      return
    }

    if (!name.trim()) {
      setError(
        "Bitte geben Sie Ihren Namen ein.",
      )
      return
    }

    if (!phone.trim()) {
      setError(
        "Bitte geben Sie Ihre Telefonnummer ein.",
      )
      return
    }

    if (!email.trim()) {
      setError(
        "Bitte geben Sie Ihre E-Mail-Adresse ein.",
      )
      return
    }

    if (!car.trim()) {
      setError(
        "Bitte geben Sie Ihr Fahrzeug ein.",
      )
      return
    }

    if (!problem.trim()) {
      setError(
        "Bitte beschreiben Sie Ihr Anliegen.",
      )
      return
    }

    // ========================================================
    // TERMIN NOCH FREI?
    // ========================================================

    if (
      takenForDate.has(time)
    ) {
      setError(
        "Dieser Termin ist leider bereits vergeben.",
      )
      return
    }

    // ========================================================
    // BILDER
    // ========================================================

    if (images.length === 0) {
      setError(
        "Bitte laden Sie mindestens ein Bild hoch.",
      )
      return
    }

    if (images.length > 5) {
      setError(
        "Maximal 5 Bilder sind erlaubt.",
      )
      return
    }

    // ========================================================
    // START
    // ========================================================

    setPending(true)

    try {
      // ======================================================
      // 1. BUCHUNG ERSTELLEN
      // ======================================================

      const result =
        await createBooking({
          booking_date: date,
          booking_time: time,
          name: name.trim(),
          phone: phone.trim(),
          email:
            email.trim().toLowerCase(),
          car: car.trim(),
          problem: problem.trim(),
        })

      if (
        !result.ok ||
        !result.bookingId
      ) {
        setError(
          result.error ??
            "Der Termin konnte nicht erstellt werden.",
        )

        setPending(false)

        return
      }

      const bookingId =
        result.bookingId

      // ======================================================
      // 2. SUPABASE CLIENT
      // ======================================================

      const supabase =
        createClient()

      const uploadedImages: string[] =
        []

      // ======================================================
      // 3. BILDER HOCHLADEN
      // ======================================================

      for (
        let index = 0;
        index < images.length;
        index++
      ) {
        const image =
          images[index]

        const extension =
          image.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "jpg"

        const safeName =
          name
            .trim()
            .replace(
              /[^a-zA-Z0-9äöüÄÖÜß]/g,
              "-",
            )
            .replace(
              /-+/g,
              "-",
            )

        const timestamp =
          Date.now()

        const random =
          Math.random()
            .toString(36)
            .substring(
              2,
              8,
            )

        const fileName =
          `${safeName}-${timestamp}-${random}-${index + 1}.${extension}`

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              "Kunden-Bilder",
            )
            .upload(
              fileName,
              image,
              {
                cacheControl:
                  "3600",

                upsert: false,

                contentType:
                  image.type,
              },
            )

        if (uploadError) {
          console.error(
            "Bild Upload Fehler:",
            uploadError,
          )

          throw uploadError
        }

        uploadedImages.push(
          fileName,
        )
      }

      // ======================================================
      // 4. BILDER MIT BUCHUNG VERKNÜPFEN
      // ======================================================

      const imageResult =
        await saveBookingImages(
          bookingId,
          uploadedImages,
        )

      if (!imageResult.ok) {
        setError(
          imageResult.error ??
            "Die Bilder konnten nicht gespeichert werden.",
        )

        setPending(false)

        return
      }

      // ======================================================
      // 5. ERFOLGREICH
      // ======================================================

      setPending(false)

      setDone(true)

    } catch (error) {
      console.error(
        "Booking Fehler:",
        error,
      )

      setPending(false)

      setError(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      )
    }
  }

  // ==========================================================
  // ERFOLGSANZEIGE
  // ==========================================================

  if (done) {
    return (
      <div className="border border-border bg-card p-10 text-center">

        <CheckCircle2
          className="mx-auto h-12 w-12 text-[var(--ok)]"
          strokeWidth={1.5}
        />

        <h3 className="mt-6 font-display text-2xl font-bold uppercase tracking-wide">
          Anfrage gesendet
        </h3>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Vielen Dank, {name}.
          <br />
          Ihre Terminanfrage wurde
          erfolgreich übermittelt.
        </p>

      </div>
    )
  }

  // ==========================================================
  // FORMULAR
  // ==========================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border bg-card p-6 md:p-10"
    >

      {/* ====================================================
          DATUM + NAME
      ==================================================== */}

      <div className="grid gap-6 md:grid-cols-2">

        <label>
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Datum *
          </span>

          <input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(
                e.target.value,
              )

              setTime("")

              setError(null)
            }}
            className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none"
          />
        </label>

        <label>
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Name *
          </span>

          <input
            type="text"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value,
              )
            }
            placeholder="Vor- und Nachname"
            className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none"
          />
        </label>

      </div>

      {/* ====================================================
          UHRZEIT
      ==================================================== */}

      <div className="mt-6">

        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Uhrzeit *
        </span>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-8">

          {TIMES.map(
            (currentTime) => {

              const taken =
                takenForDate.has(
                  currentTime,
                )

              const active =
                time ===
                currentTime

              return (
                <button
                  key={
                    currentTime
                  }
                  type="button"
                  disabled={
                    taken ||
                    !date
                  }
                  onClick={() => {
                    setTime(
                      currentTime,
                    )

                    setError(null)
                  }}
                  className={[
                    "border px-3 py-3 text-sm transition",

                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",

                    taken ||
                    !date
                      ? "cursor-not-allowed opacity-30"
                      : "hover:bg-secondary",
                  ].join(
                    " ",
                  )}
                >
                  {currentTime}
                </button>
              )
            },
          )}

        </div>

        {!date && (
          <p className="mt-2 text-xs text-muted-foreground">
            Bitte zuerst ein Datum auswählen.
          </p>
        )}

      </div>

      {/* ====================================================
          TELEFON + EMAIL
      ==================================================== */}

      <div className="mt-6 grid gap-6 md:grid-cols-2">

        <label>
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Telefonnummer *
          </span>

          <input
            type="tel"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value,
              )
            }
            placeholder="079 123 45 67"
            className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none"
          />
        </label>

        <label>
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            E-Mail *
          </span>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value,
              )
            }
            placeholder="name@beispiel.ch"
            className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none"
          />
        </label>

      </div>

      {/* ====================================================
          FAHRZEUG
      ==================================================== */}

      <label className="mt-6 block">

        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Fahrzeug *
        </span>

        <input
          type="text"
          value={car}
          onChange={(e) =>
            setCar(
              e.target.value,
            )
          }
          placeholder="z. B. BMW 320i"
          className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none"
        />

      </label>

      {/* ====================================================
          PROBLEM
      ==================================================== */}

      <label className="mt-6 block">

        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Problem / Anliegen *
        </span>

        <textarea
          value={problem}
          onChange={(e) =>
            setProblem(
              e.target.value,
            )
          }
          placeholder="Beschreiben Sie bitte kurz das Problem..."
          rows={5}
          className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 outline-none"
        />

      </label>

      {/* ====================================================
          BILDER
      ==================================================== */}

      <div className="mt-6">

        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">

          Bilder hinzufügen{" "}

          <span className="text-[var(--bad)]">
            (Pflicht)
          </span>

        </span>

        <label className="mt-2 flex cursor-pointer items-center justify-center border border-dashed border-border px-6 py-8 text-center hover:bg-secondary">

          <div>

            <ImagePlus
              className="mx-auto h-8 w-8 text-muted-foreground"
            />

            <p className="mt-3 text-sm font-medium">
              Bilder auswählen
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Max. 5 Bilder,
              jeweils bis 10 MB
            </p>

          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={
              handleImages
            }
            className="hidden"
          />

        </label>

        {/* ==================================================
            BILD PREVIEWS
        ================================================== */}

        {images.length >
          0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">

            {images.map(
              (
                image,
                index,
              ) => (

                <div
                  key={`${image.name}-${image.size}-${index}`}
                  className="relative aspect-square overflow-hidden border border-border"
                >

                  <img
                    src={
                      imagePreviews[
                        index
                      ]
                    }
                    alt={`Bild ${
                      index + 1
                    }`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeImage(
                        index,
                      )
                    }
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center bg-black/70 text-white"
                  >

                    <X className="h-4 w-4" />

                  </button>

                </div>

              ),
            )}

          </div>
        )}

      </div>

      {/* ====================================================
          FEHLER
      ==================================================== */}

      {error && (
        <div className="mt-4 border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-3">

          <p className="text-sm text-[var(--bad)]">
            {error}
          </p>

        </div>
      )}

      {/* ====================================================
          ABSENDEN
      ==================================================== */}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >

        {pending
          ? "Wird gesendet..."
          : "Termin anfragen"}

      </button>

    </form>
  )
}
ALTER TABLE appointments
ADD COLUMN images text[] DEFAULT '{}';