"use client"

import Link from "next/link"
import { ChangeEvent, FormEvent, useState } from "react"

export default function VerkaufenPage() {
  const [photos, setPhotos] = useState<File[]>([])
  const [submitted, setSubmitted] = useState(false)

  const [formData, setFormData] = useState({
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
  })

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

    if (files.length === 0) return

    const remainingSlots = 10 - photos.length
    const selectedFiles = files.slice(0, remainingSlots)

    setPhotos((prev) => [...prev, ...selectedFiles])

    e.target.value = ""
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (photos.length < 1) {
      alert("Bitte lade mindestens ein Foto deines Fahrzeugs hoch.")
      return
    }

    setSubmitted(true)

    // Später:
    // Hier wird das Formular an deine Supabase-/API-Route gesendet.
  }

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
              Vielen Dank für deine Fahrzeuganfrage. Wir prüfen die Angaben
              und melden uns so schnell wie möglich bei dir.
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
          <span className="text-zinc-500">bei MB Performance</span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl leading-7 text-zinc-400">
          Fülle das Formular vollständig aus und lade bis zu 10 aussagekräftige
          Fotos deines Fahrzeugs hoch. Je genauer deine Angaben sind, desto
          besser können wir dein Fahrzeug beurteilen.
        </p>
      </section>

      {/* Formular */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* Persönliche Daten */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                01
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Deine Kontaktdaten
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Damit wir dich bezüglich deines Fahrzeugs kontaktieren können.
              </p>
            </div>

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
                  value={formData.privatOderFirma}
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

          {/* Fahrzeug */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                02
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Fahrzeugdaten
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Bitte gib die wichtigsten technischen Daten deines Fahrzeugs
                an.
              </p>
            </div>

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

          {/* Zustand */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                03
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Zustand & Historie
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Ehrliche Angaben helfen uns bei einer schnellen Einschätzung.
              </p>
            </div>

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
                value={formData.unfallschaden}
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
                value={formData.letzterService}
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
                Beschreibung / weitere Informationen
              </label>

              <textarea
                name="beschreibung"
                value={formData.beschreibung}
                onChange={handleChange}
                required
                rows={7}
                placeholder="Beschreibe dein Fahrzeug möglichst genau. Zubehör, Umbauten, Mängel, Servicehistorie usw."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30"
              />
            </div>
          </div>

          {/* Preis */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                04
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Preisvorstellung
              </h2>
            </div>

            <Input
              label="Deine Preisvorstellung in CHF"
              name="preisvorstellung"
              type="number"
              placeholder="z. B. 45000"
              value={formData.preisvorstellung}
              onChange={handleChange}
              required
            />
          </div>

          {/* Fotos */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                05
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Fahrzeugfotos
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Lade mindestens 1 und maximal 10 Fotos hoch. Gute Fotos von
                vorne, hinten, beiden Seiten, Innenraum und Motorraum sind
                besonders hilfreich.
              </p>
            </div>

            {/* Upload */}
            {photos.length < 10 && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 px-6 py-12 text-center transition hover:border-white/40 hover:bg-white/[0.03]">
                <span className="text-4xl">+</span>

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

            {/* Foto Vorschau */}
            {photos.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {photos.map((photo, index) => (
                  <div
                    key={`${photo.name}-${index}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black"
                  >
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Fahrzeugfoto ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-sm text-white opacity-100 transition hover:bg-white hover:text-black"
                      aria-label={`Foto ${index + 1} entfernen`}
                    >
                      ×
                    </button>

                    <div className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-1 text-[10px] text-white">
                      {index + 1}/10
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-5 text-xs text-zinc-600">
              Erlaubte Formate: JPG, PNG und WEBP · Maximal 10 Fotos
            </p>
          </div>

          {/* Datenschutz / Absenden */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
            <label className="flex cursor-pointer gap-4">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-white"
              />

              <span className="text-sm leading-6 text-zinc-400">
                Ich bestätige, dass die Angaben korrekt sind und MB
                Performance mich bezüglich meines Fahrzeuges kontaktieren
                darf.
              </span>
            </label>

            <button
              type="submit"
              className="mt-8 w-full rounded-2xl bg-white px-6 py-5 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-200 active:scale-[0.99]"
            >
              Fahrzeug anbieten
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
              Deine Anfrage wird nach dem Absenden von MB Performance
              geprüft.
            </p>
          </div>
        </form>
      </section>
    </main>
  )
}

/* -------------------------------------------------------
   INPUT
------------------------------------------------------- */

type InputProps = {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  required?: boolean
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
        {required && <span className="ml-1 text-zinc-500">*</span>}
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

/* -------------------------------------------------------
   SELECT
------------------------------------------------------- */

type SelectProps = {
  label: string
  name: string
  value: string
  options: string[]
  required?: boolean
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
        {required && <span className="ml-1 text-zinc-500">*</span>}
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

