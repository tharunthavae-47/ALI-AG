"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type FormData = {
  vorname: string
  nachname: string
  email: string
  telefon: string
  marke: string
  modell: string
  jahrgang: string
  kilometer: string
  treibstoff: string
  getriebe: string
  leistung: string
  antrieb: string
  tueren: string
  fahrzeugfarbe: string
  preisvorstellung: string
  letzterService: string
  mfk: string
  unfallschaden: string
  beschreibung: string
  zustand: string
  privatOderFirma: string
}

const initialFormData: FormData = {
  vorname: "",
  nachname: "",
  email: "",
  telefon: "",
  marke: "",
  modell: "",
  jahrgang: "",
  kilometer: "",
  treibstoff: "",
  getriebe: "",
  leistung: "",
  antrieb: "",
  tueren: "",
  fahrzeugfarbe: "",
  preisvorstellung: "",
  letzterService: "",
  mfk: "",
  unfallschaden: "",
  beschreibung: "",
  zustand: "",
  privatOderFirma: "",
}

export default function VerkaufenPage() {
  const supabase = createClient()

  const [formData, setFormData] = useState<FormData>(initialFormData)

  const [photos, setPhotos] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)

  const [submitted, setSubmitted] = useState(false)

  const [error, setError] = useState("")

  const [uploadProgress, setUploadProgress] = useState(0)

  /*
   * Objekt-URLs für die Bildvorschau
   */
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo))

    setPreviewUrls(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photos])

  function handleChange(
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handlePhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])

    if (!files.length) return

    setError("")

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ]

    const invalidFiles = files.filter(
      (file) => !allowedTypes.includes(file.type)
    )

    if (invalidFiles.length > 0) {
      setError(
        "Bitte nur JPG-, PNG- oder WEBP-Bilder hochladen."
      )

      e.target.value = ""
      return
    }

    /*
     * Maximal 10 Bilder insgesamt
     */
    const remainingSlots = 10 - photos.length

    if (remainingSlots <= 0) {
      setError("Du kannst maximal 10 Fotos hochladen.")
      e.target.value = ""
      return
    }

    /*
     * Maximal 10 MB pro Bild
     */
    const tooLarge = files.find(
      (file) => file.size > 10 * 1024 * 1024
    )

    if (tooLarge) {
      setError(
        `Das Bild "${tooLarge.name}" ist größer als 10 MB.`
      )

      e.target.value = ""
      return
    }

    const selectedFiles = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      setError(
        `Es wurden nur ${remainingSlots} weitere Fotos hinzugefügt. Maximal 10 Fotos.`
      )
    }

    setPhotos((prev) => [...prev, ...selectedFiles])

    e.target.value = ""
  }

  function removePhoto(index: number) {
    setPhotos((prev) =>
      prev.filter((_, i) => i !== index)
    )

    setError("")
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault()

    setError("")
    setUploadProgress(0)

    /*
     * Mindestens ein Bild
     */
    if (photos.length < 1) {
      setError(
        "Bitte lade mindestens ein Foto deines Fahrzeugs hoch."
      )
      return
    }

    /*
     * Maximal 10 Bilder
     */
    if (photos.length > 10) {
      setError(
        "Du kannst maximal 10 Fotos hochladen."
      )
      return
    }

    setSubmitting(true)

    let occasionRequestId: string | null = null

    try {
      /*
       * ============================================
       * 1. FAHRZEUGANFRAGE ERSTELLEN
       * ============================================
       */

      const { data: request, error: requestError } =
        await supabase
          .from("occasion_requests")
          .insert({
            vorname: formData.vorname,
            nachname: formData.nachname,
            email: formData.email,
            telefon: formData.telefon,

            privat_oder_firma:
              formData.privatOderFirma,

            marke: formData.marke,
            modell: formData.modell,

            jahrgang: Number(formData.jahrgang),

            kilometer: Number(formData.kilometer),

            treibstoff: formData.treibstoff,
            getriebe: formData.getriebe,
            leistung: formData.leistung,
            antrieb: formData.antrieb,
            tueren: formData.tueren,
            fahrzeugfarbe:
              formData.fahrzeugfarbe,

            zustand: formData.zustand,
            unfallschaden:
              formData.unfallschaden,

            letzter_service:
              formData.letzterService || null,

            mfk: formData.mfk || null,

            beschreibung:
              formData.beschreibung,

            preisvorstellung: Number(
              formData.preisvorstellung
            ),

            status: "offen",
          })
          .select("id")
          .single()

      if (requestError) {
        throw new Error(
          `Fahrzeugdaten konnten nicht gespeichert werden: ${requestError.message}`
        )
      }

      if (!request) {
        throw new Error(
          "Die Fahrzeuganfrage konnte nicht erstellt werden."
        )
      }

      occasionRequestId = request.id

      /*
       * ============================================
       * 2. FOTOS IN SUPABASE STORAGE HOCHLADEN
       * ============================================
       */

      const uploadedImages: {
        image_url: string
        image_name: string
        image_position: number
      }[] = []

      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]

        /*
         * Dateiendung bestimmen
         */
        const extension =
          file.name.split(".").pop()?.toLowerCase() ||
          "jpg"

        /*
         * Eindeutiger Dateiname
         *
         * Beispiel:
         *
         * occasion-id/
         * 1-abc123.jpg
         */
        const randomId = crypto.randomUUID()

        const filePath =
          `${occasionRequestId}/${i + 1}-${randomId}.${extension}`

        /*
         * Upload in:
         *
         * occasion-images
         */
        const { error: uploadError } =
          await supabase.storage
            .from("occasion-images")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            })

        if (uploadError) {
          throw new Error(
            `Foto ${i + 1} konnte nicht hochgeladen werden: ${uploadError.message}`
          )
        }

        /*
         * Da der Bucket privat sein kann,
         * speichern wir zunächst den Pfad.
         *
         * Für die Besitzer-Seite können wir später
         * eine Signed URL erzeugen.
         */
        uploadedImages.push({
          image_url: filePath,
          image_name: file.name,
          image_position: i,
        })

        setUploadProgress(
          Math.round(
            ((i + 1) / photos.length) * 100
          )
        )
      }

      /*
       * ============================================
       * 3. FOTODATEN IN occasion_images SPEICHERN
       * ============================================
       */

      if (uploadedImages.length > 0) {
        const imageRows =
          uploadedImages.map((image) => ({
            occasion_request_id:
              occasionRequestId,
            image_url: image.image_url,
            image_name: image.image_name,
            image_position:
              image.image_position,
          }))

        const { error: imagesError } =
          await supabase
            .from("occasion_images")
            .insert(imageRows)

        if (imagesError) {
          throw new Error(
            `Die Fotodaten konnten nicht gespeichert werden: ${imagesError.message}`
          )
        }
      }

      /*
       * ============================================
       * 4. ERFOLG
       * ============================================
       */

      setSubmitted(true)
    } catch (err) {
      console.error(
        "Occasion Verkaufsanfrage Fehler:",
        err
      )

      const message =
        err instanceof Error
          ? err.message
          : "Die Anfrage konnte nicht gesendet werden."

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  /*
   * ============================================
   * ERFOLGSSEITE
   * ============================================
   */

  if (submitted) {
    return (
      <main className="min-h-screen bg-black px-6 py-24 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-3xl border border-white/10 bg-zinc-950 p-10 text-center shadow-2xl md:p-16">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-white/20 text-3xl">
              ✓
            </div>

            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">
              MB Performance
            </p>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Anfrage erhalten
            </h1>

            <p className="mx-auto mt-6 max-w-xl leading-7 text-zinc-400">
              Vielen Dank für deine Fahrzeuganfrage.
              Deine Fahrzeugdaten und Fotos wurden
              erfolgreich übermittelt.
            </p>

            <p className="mt-4 text-sm text-zinc-600">
              Wir prüfen deine Angaben und melden uns
              so schnell wie möglich bei dir.
            </p>

            <Link
              href="/"
              className="mt-10 inline-flex rounded-full border border-white/20 px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] transition hover:bg-white hover:text-black"
            >
              Zur Startseite
            </Link>
          </div>
        </div>
      </main>
    )
  }

  /*
   * ============================================
   * FORMULAR
   * ============================================
   */

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
          <Link
            href="/"
            className="font-bold tracking-[0.2em] transition-opacity hover:opacity-70"
          >
            MB PERFORMANCE
          </Link>

          <Link
            href="/occasion"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            ← Occasion
          </Link>
        </div>
      </header>

      {/* Titel */}
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 text-center md:pt-28">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">
          Fahrzeug verkaufen
        </p>

        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          Dein Fahrzeug
          <br />
          <span className="text-zinc-500">
            bei MB Performance
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl leading-7 text-zinc-400">
          Fülle das Formular vollständig aus und
          lade bis zu 10 aussagekräftige Fotos
          deines Fahrzeugs hoch.
        </p>
      </section>

      {/* Fehler */}
      {error && (
        <div className="mx-auto mb-8 max-w-5xl px-6">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* ========================================
              01 KONTAKTDATEN
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <SectionTitle
              number="01"
              title="Deine Kontaktdaten"
              description="Damit wir dich bezüglich deines Fahrzeugs kontaktieren können."
            />

            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Vorname"
                name="vorname"
                value={formData.vorname}
                onChange={handleChange}
                required
              />

              <Input
                label="Nachname"
                name="nachname"
                value={formData.nachname}
                onChange={handleChange}
                required
              />

              <Input
                label="E-Mail"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <Input
                label="Telefon"
                name="telefon"
                type="tel"
                value={formData.telefon}
                onChange={handleChange}
                required
              />

              <div className="md:col-span-2">
                <Select
                  label="Verkauf als"
                  name="privatOderFirma"
                  value={
                    formData.privatOderFirma
                  }
                  onChange={handleChange}
                  required
                  options={[
                    "Privatperson",
                    "Firma",
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ========================================
              02 FAHRZEUG
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <SectionTitle
              number="02"
              title="Fahrzeugdaten"
              description="Bitte gib die wichtigsten technischen Daten deines Fahrzeugs an."
            />

            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Marke"
                name="marke"
                placeholder="z. B. BMW"
                value={formData.marke}
                onChange={handleChange}
                required
              />

              <Input
                label="Modell"
                name="modell"
                placeholder="z. B. M4 Competition"
                value={formData.modell}
                onChange={handleChange}
                required
              />

              <Input
                label="Jahrgang"
                name="jahrgang"
                type="number"
                placeholder="z. B. 2022"
                value={formData.jahrgang}
                onChange={handleChange}
                required
              />

              <Input
                label="Kilometerstand"
                name="kilometer"
                type="number"
                placeholder="z. B. 45000"
                value={formData.kilometer}
                onChange={handleChange}
                required
              />

              <Select
                label="Treibstoff"
                name="treibstoff"
                value={formData.treibstoff}
                onChange={handleChange}
                required
                options={[
                  "Benzin",
                  "Diesel",
                  "Hybrid",
                  "Plug-in Hybrid",
                  "Elektro",
                  "Andere",
                ]}
              />

              <Select
                label="Getriebe"
                name="getriebe"
                value={formData.getriebe}
                onChange={handleChange}
                required
                options={[
                  "Automatik",
                  "Manuell",
                  "Halbautomatik",
                ]}
              />

              <Input
                label="Leistung"
                name="leistung"
                placeholder="z. B. 510 PS"
                value={formData.leistung}
                onChange={handleChange}
                required
              />

              <Select
                label="Antrieb"
                name="antrieb"
                value={formData.antrieb}
                onChange={handleChange}
                required
                options={[
                  "Vorderradantrieb",
                  "Hinterradantrieb",
                  "Allradantrieb",
                ]}
              />

              <Select
                label="Anzahl Türen"
                name="tueren"
                value={formData.tueren}
                onChange={handleChange}
                required
                options={[
                  "2",
                  "3",
                  "4",
                  "5",
                ]}
              />

              <Input
                label="Fahrzeugfarbe"
                name="fahrzeugfarbe"
                placeholder="z. B. Schwarz"
                value={formData.fahrzeugfarbe}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* ========================================
              03 ZUSTAND
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <SectionTitle
              number="03"
              title="Zustand & Historie"
              description="Ehrliche Angaben helfen uns bei einer schnellen Einschätzung."
            />

            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label="Fahrzeugzustand"
                name="zustand"
                value={formData.zustand}
                onChange={handleChange}
                required
                options={[
                  "Sehr gut",
                  "Gut",
                  "Gebraucht",
                  "Renovierungsbedürftig",
                ]}
              />

              <Select
                label="Unfall-/Schadenshistorie"
                name="unfallschaden"
                value={
                  formData.unfallschaden
                }
                onChange={handleChange}
                required
                options={[
                  "Unfallfrei",
                  "Unfallschaden vorhanden",
                  "Früherer Unfallschaden repariert",
                  "Nicht bekannt",
                ]}
              />

              <Input
                label="Letzter Service"
                name="letzterService"
                placeholder="z. B. 05/2026 bei 42'000 km"
                value={
                  formData.letzterService
                }
                onChange={handleChange}
              />

              <Input
                label="Letzte MFK"
                name="mfk"
                placeholder="z. B. 04/2025"
                value={formData.mfk}
                onChange={handleChange}
              />
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Beschreibung / weitere Informationen *
              </label>

              <textarea
                name="beschreibung"
                value={
                  formData.beschreibung
                }
                onChange={handleChange}
                required
                rows={7}
                placeholder="Beschreibe dein Fahrzeug möglichst genau. Zubehör, Umbauten, Mängel, Servicehistorie usw."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30"
              />
            </div>
          </div>

          {/* ========================================
              04 PREIS
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <SectionTitle
              number="04"
              title="Preisvorstellung"
              description="Welche Preisvorstellung hast du für dein Fahrzeug?"
            />

            <Input
              label="Preisvorstellung in CHF"
              name="preisvorstellung"
              type="number"
              placeholder="z. B. 45000"
              value={
                formData.preisvorstellung
              }
              onChange={handleChange}
              required
            />
          </div>

          {/* ========================================
              05 FOTOS
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <SectionTitle
              number="05"
              title="Fahrzeugfotos"
              description="Lade mindestens 1 und maximal 10 aussagekräftige Fotos hoch."
            />

            {photos.length < 10 && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 px-6 py-12 text-center transition hover:border-white/40 hover:bg-white/[0.03]">
                <span className="text-4xl">
                  +
                </span>

                <span className="mt-4 text-sm font-semibold uppercase tracking-[0.15em]">
                  Fotos hinzufügen
                </span>

                <span className="mt-2 text-xs text-zinc-500">
                  {photos.length}/10 Fotos ausgewählt
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotos}
                  className="hidden"
                />
              </label>
            )}

            {photos.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {photos.map(
                  (photo, index) => (
                    <div
                      key={`${photo.name}-${index}`}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black"
                    >
                      {previewUrls[index] && (
                        <img
                          src={previewUrls[index]}
                          alt={`Fahrzeugfoto ${
                            index + 1
                          }`}
                          className="h-full w-full object-cover"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          removePhoto(index)
                        }
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-sm text-white transition hover:bg-white hover:text-black"
                        aria-label={`Foto ${
                          index + 1
                        } entfernen`}
                      >
                        ×
                      </button>

                      <div className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-1 text-[10px] text-white">
                        {index + 1}/10
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            <p className="mt-5 text-xs text-zinc-600">
              JPG, PNG oder WEBP · maximal 10
              Fotos · maximal 10 MB pro Foto
            </p>
          </div>

          {/* ========================================
              06 ABSENDEN
          ======================================== */}

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <label className="flex cursor-pointer gap-4">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-white"
              />

              <span className="text-sm leading-6 text-zinc-400">
                Ich bestätige, dass die Angaben
                korrekt sind und MB Performance
                mich bezüglich meines Fahrzeuges
                kontaktieren darf.
              </span>
            </label>

            {submitting && (
              <div className="mt-8">
                <div className="mb-2 flex justify-between text-xs text-zinc-500">
                  <span>
                    Fotos werden hochgeladen...
                  </span>

                  <span>
                    {uploadProgress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{
                      width: `${uploadProgress}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 w-full rounded-2xl bg-white px-6 py-5 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Wird gesendet..."
                : "Fahrzeug anbieten"}
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
              Deine Fahrzeugdaten und Fotos werden
              sicher an MB Performance übermittelt.
            </p>
          </div>
        </form>
      </section>
    </main>
  )
}

/*
 * ============================================
 * SECTION TITLE
 * ============================================
 */

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
        {number}
      </p>

      <h2 className="mt-2 text-2xl font-bold">
        {title}
      </h2>

      <p className="mt-2 text-sm text-zinc-500">
        {description}
      </p>
    </div>
  )
}

/*
 * ============================================
 * INPUT
 * ============================================
 */

type InputProps = {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  required?: boolean
  onChange: (
    e: ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) => void
}

function Input({
  label,
  name,
  type = "text",
  placeholder,
  value,
  required = false,
  onChange,
}: InputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && (
          <span className="ml-1 text-zinc-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30"
      />
    </div>
  )
}

/*
 * ============================================
 * SELECT
 * ============================================
 */

type SelectProps = {
  label: string
  name: string
  value: string
  options: string[]
  required?: boolean
  onChange: (
    e: ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) => void
}

function Select({
  label,
  name,
  value,
  options,
  required = false,
  onChange,
}: SelectProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && (
          <span className="ml-1 text-zinc-500">
            *
          </span>
        )}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none transition focus:border-white/30"
      >
        <option value="" disabled>
          Bitte auswählen
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
