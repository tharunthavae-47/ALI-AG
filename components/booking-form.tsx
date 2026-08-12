"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ImagePlus, X } from "lucide-react"
import { createBooking, type PublicSlot } from "@/app/actions"
import { createClient } from "@/lib/supabase/client"

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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function BookingForm({
  bookedSlots,
}: {
  bookedSlots: PublicSlot[]
}) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [car, setCar] = useState("")
  const [problem, setProblem] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const takenForDate = useMemo(() => {
    return new Set(
      bookedSlots
        .filter((slot) => slot.booking_date === date)
        .map((slot) => slot.booking_time),
    )
  }, [bookedSlots, date])

  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])

    const validImages = selected.filter((file) => {
      if (!file.type.startsWith("image/")) {
        return false
      }

      if (file.size > 10 * 1024 * 1024) {
        return false
      }

      return true
    })

    if (validImages.length !== selected.length) {
      setError(
        "Einige Dateien wurden entfernt. Nur Bilder bis maximal 10 MB sind erlaubt.",
      )
    } else {
      setError(null)
    }

    setImages(validImages.slice(0, 5))
  }

  function removeImage(index: number) {
    setImages((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index),
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setError(null)

    if (!date || !time) {
      setError("Bitte wählen Sie Datum und Uhrzeit.")
      return
    }

    if (!name || !contact || !car || !problem) {
      setError("Bitte füllen Sie alle Felder aus.")
      return
    }

    if (takenForDate.has(time)) {
      setError("Dieser Termin ist leider bereits vergeben.")
      return
    }

    setPending(true)

    try {
      /*
       * 1. Termin erstellen
       */
      const result = await createBooking({
        booking_date: date,
        booking_time: time,
        name,
        contact,
        car,
        problem,
      })

      if (!result.ok || !result.bookingId) {
        setError(
          result.error ?? "Der Termin konnte nicht erstellt werden.",
        )
        setPending(false)
        return
      }

      const bookingId = result.bookingId

      /*
      /*
 * 2. Bilder hochladen
 */
if (images.length > 0) {
  const supabase = createClient()
  const uploadedImages: string[] = []

  console.log("BOOKING ID:", bookingId)
  console.log("ANZAHL BILDER:", images.length)

  for (const image of images) {
    const extension =
      image.name.split(".").pop()?.toLowerCase() || "jpg"

    const fileName = `${crypto.randomUUID()}.${extension}`
    const filePath = `${bookingId}/${fileName}`

    console.log("UPLOAD:", filePath)

    const { error: uploadError } = await supabase.storage
      .from("Kunden-Bilder")
      .upload(filePath, image, {
        cacheControl: "3600",
        upsert: false,
        contentType: image.type,
      })

    if (uploadError) {
      console.error("BILD UPLOAD FEHLER:", uploadError)

      setError(
        "Der Termin wurde erstellt, aber das Bild konnte nicht hochgeladen werden.",
      )

      setPending(false)
      return
    }

    uploadedImages.push(filePath)
  }

  console.log("HOCHGELADENE BILDER:", uploadedImages)

  /*
   * 3. Bildpfade in bookings speichern
   */
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({
      image_urls: uploadedImages,
    })
    .eq("id", bookingId)
    .select("id, image_urls")
    .single()

  console.log("UPDATE ERGEBNIS:", updatedBooking)
  console.log("UPDATE FEHLER:", updateError)

  if (updateError) {
    setError(
      `Bilder wurden hochgeladen, aber konnten nicht gespeichert werden: ${updateError.message}`,
    )

    setPending(false)
    return
  }

  console.log("IMAGE_URLS GESPEICHERT:", updatedBooking?.image_urls)
}

setPending(false)
setDone(true)
  if (done) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-[var(--ok)]"
          strokeWidth={1.5}
        />

        <h3 className="mt-6 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Anfrage gesendet
        </h3>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Vielen Dank, {name || "geschätzter Kunde"}. Ihre Terminanfrage ist
          bei uns eingegangen. Wir melden uns zur Bestätigung über{" "}
          {contact || "Ihre angegebene Kontaktmöglichkeit"}.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border bg-card p-6 md:p-10"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Datum
          </span>

          <input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setTime("")
            }}
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-ring"
          />
        </label>

        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Ihr Name
          </span>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vor- und Nachname"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>
      </div>

      <div className="mt-6">
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Uhrzeit
        </span>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-8">
          {TIMES.map((currentTime) => {
            const taken = takenForDate.has(currentTime)
            const active = time === currentTime

            return (
              <button
                key={currentTime}
                type="button"
                disabled={taken || !date}
                onClick={() => setTime(currentTime)}
                className={[
                  "border px-3 py-3 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-secondary",
                  taken || !date
                    ? "cursor-not-allowed opacity-30 hover:bg-transparent"
                    : "",
                ].join(" ")}
              >
                {currentTime}
              </button>
            )
          })}
        </div>

        {!date && (
          <p className="mt-2 text-xs text-muted-foreground">
            Bitte zuerst ein Datum wählen.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Kontakt (Tel. / E-Mail)
          </span>

          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Telefon oder E-Mail"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>

        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Fahrzeug
          </span>

          <input
            type="text"
            value={car}
            onChange={(e) => setCar(e.target.value)}
            placeholder="z. B. BMW 320i"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>
      </div>

      <label className="mt-6 block">
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Problem / Anliegen
        </span>

        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Beschreiben Sie bitte kurz das Problem..."
          rows={5}
          className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
        />
      </label>

      <div className="mt-6">
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Bilder hinzufügen{" "}
          <span className="opacity-50">(optional)</span>
        </span>

        <label className="mt-2 flex cursor-pointer items-center justify-center border border-dashed border-border bg-background px-6 py-8 text-center transition-colors hover:bg-secondary">
          <div>
            <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 text-sm font-medium">
              Bilder auswählen
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Max. 5 Bilder, jeweils bis 10 MB
            </p>
          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleImages}
            className="hidden"
          />
        </label>

        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {images.map((image, index) => (
              <div
                key={`${image.name}-${index}`}
                className="relative aspect-square overflow-hidden border border-border"
              >
                <img
                  src={URL.createObjectURL(image)}
                  alt={`Ausgewähltes Bild ${index + 1}`}
                  className="h-full w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center bg-black/70 text-white"
                  aria-label="Bild entfernen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Du kannst Fotos vom Schaden hinzufügen.
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Wird gesendet..." : "Termin anfragen"}
      </button>
    </form>
  )
}
