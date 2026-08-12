"use client"

import { useMemo, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { createBooking, type PublicSlot } from "@/app/actions"

const TIMES = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function BookingForm({ bookedSlots }: { bookedSlots: PublicSlot[] }) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [car, setCar] = useState("")
  const [problem, setProblem] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const takenForDate = useMemo(() => {
    return new Set(bookedSlots.filter((s) => s.booking_date === date).map((s) => s.booking_time))
  }, [bookedSlots, date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!date || !time) {
      setError("Bitte wählen Sie Datum und Uhrzeit.")
      return
    }
    setPending(true)
    const res = await createBooking({ booking_date: date, booking_time: time, name, contact, car, problem })
    setPending(false)
    if (res.ok) {
      setDone(true)
    } else {
      setError(res.error ?? "Etwas ist schiefgelaufen.")
    }
  }

  if (done) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--ok)]" strokeWidth={1.5} />
        <h3 className="mt-6 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Anfrage gesendet
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Vielen Dank, {name || "geschätzter Kunde"}. Ihre Terminanfrage ist bei uns eingegangen. Wir melden uns zur
          Bestätigung über {contact || "Ihre angegebene Kontaktmöglichkeit"}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-card p-6 md:p-10">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Datum</span>
          <input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setTime("")
            }}
            required
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Ihr Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Max Mustermann"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>
      </div>

      <div className="mt-6">
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Uhrzeit</span>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-8">
          {TIMES.map((t) => {
            const taken = takenForDate.has(t)
            const active = time === t
            return (
              <button
                type="button"
                key={t}
                disabled={taken || !date}
                onClick={() => setTime(t)}
                className={[
                  "border px-2 py-3 font-display text-sm tracking-wide transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-secondary",
                  taken || !date ? "cursor-not-allowed opacity-30 hover:bg-transparent" : "",
                ].join(" ")}
              >
                {t}
              </button>
            )
          })}
        </div>
        {!date && <p className="mt-2 text-xs text-muted-foreground">Bitte zuerst ein Datum wählen.</p>}
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
            required
            placeholder="0170 1234567"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Fahrzeug</span>
          <input
            type="text"
            value={car}
            onChange={(e) => setCar(e.target.value)}
            required
            placeholder="VW Golf VII, 2018"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />
        </label>
      </div>

      <label className="mt-6 block">
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Problem / Anliegen</span>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          required
          rows={4}
          placeholder="Beschreiben Sie kurz, worum es geht…"
          className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
        />
      </label>

<label className="mt-6 block">
  <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
    Bilder hinzufügen <span className="opacity-50">(optional)</span>
  </span>

  <input
    type="file"
    accept="image/*"
    multiple
    className="mt-2 w-full border border-input bg-background px-4 py-3 text-foreground file:mr-4 file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
  />

  <p className="mt-2 text-xs text-muted-foreground">
    Du kannst mehrere Bilder hochladen, z. B. Fotos vom Schaden.
  </p>
</label>

{error && <p className="mt-4 text-sm text-[var(--bad)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full bg-primary px-8 py-4 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Wird gesendet…" : "Termin anfragen"}
      </button>
    </form>
  )
}
