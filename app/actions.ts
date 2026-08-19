"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"

export type CreateBookingData = {
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
}

export async function createBooking(data: CreateBookingData) {
  try {
    const supabase = await createClient()

    // -----------------------------
    // 1. Eingaben prüfen
    // -----------------------------

    if (!data) {
      return {
        ok: false,
        error: "Keine Buchungsdaten erhalten.",
      }
    }

    const booking_date = String(data.booking_date ?? "").trim()
    const booking_time = String(data.booking_time ?? "").trim()
    const name = String(data.name ?? "").trim()
    const phone = String(data.phone ?? "").trim()
    const email = String(data.email ?? "").trim().toLowerCase()
    const car = String(data.car ?? "").trim()
    const problem = String(data.problem ?? "").trim()

    if (
      !booking_date ||
      !booking_time ||
      !name ||
      !phone ||
      !email ||
      !car ||
      !problem
    ) {
      return {
        ok: false,
        error: "Bitte fülle alle Pflichtfelder aus.",
      }
    }

    // -----------------------------
    // 2. Datum prüfen
    // Format: YYYY-MM-DD
    // -----------------------------

    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
      return {
        ok: false,
        error: "Das Datum ist ungültig.",
      }
    }

    const selectedDate = new Date(`${booking_date}T00:00:00`)
    const today = new Date()

    today.setHours(0, 0, 0, 0)

    if (Number.isNaN(selectedDate.getTime())) {
      return {
        ok: false,
        error: "Das Datum ist ungültig.",
      }
    }

    if (selectedDate < today) {
      return {
        ok: false,
        error: "Ein Termin in der Vergangenheit ist nicht möglich.",
      }
    }

    // -----------------------------
    // 3. Uhrzeit prüfen
    // Nur volle Stunden
    // -----------------------------

    if (!/^\d{2}:\d{2}$/.test(booking_time)) {
      return {
        ok: false,
        error: "Die Uhrzeit ist ungültig.",
      }
    }

    const [hourString, minuteString] = booking_time.split(":")

    const hour = Number(hourString)
    const minute = Number(minuteString)

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      minute !== 0 ||
      hour < 15 ||
      hour > 22
    ) {
      return {
        ok: false,
        error: "Bitte wähle eine gültige Terminzeit zwischen 15:00 und 22:00 Uhr.",
      }
    }

    // -----------------------------
    // 4. Maximale Textlänge
    // -----------------------------

    const fields = [
      { name: "Name", value: name },
      { name: "Telefonnummer", value: phone },
      { name: "E-Mail", value: email },
      { name: "Fahrzeug", value: car },
      { name: "Problem", value: problem },
    ]

    for (const field of fields) {
      if (field.value.length > 1000) {
        return {
          ok: false,
          error: `${field.name} ist zu lang.`,
        }
      }
    }

    // -----------------------------
    // 5. E-Mail prüfen
    // -----------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
      return {
        ok: false,
        error: "Bitte gib eine gültige E-Mail-Adresse ein.",
      }
    }

    // -----------------------------
    // 6. Prüfen, ob Termin bereits vergeben
    // -----------------------------

    const { data: existingBooking, error: existingError } =
      await supabase
        .from("bookings")
        .select("id, status")
        .eq("booking_date", booking_date)
        .eq("booking_time", booking_time)
        .in("status", ["pending", "confirmed"])
        .maybeSingle()

    if (existingError) {
      console.error(
        "Fehler beim Prüfen des Termins:",
        existingError
      )

      return {
        ok: false,
        error: "Der Termin konnte nicht geprüft werden.",
      }
    }

    if (existingBooking) {
      return {
        ok: false,
        error: "Dieser Termin ist bereits vergeben.",
      }
    }

    // -----------------------------
    // 7. Buchung erstellen
    // -----------------------------

    const { data: booking, error: insertError } =
      await supabase
        .from("bookings")
        .insert({
          booking_date,
          booking_time,
          name,
          phone,
          email,
          car,
          problem,
          status: "pending",
          image_urls: [],
        })
        .select("*")
        .single()

    // -----------------------------
    // 8. Supabase Fehler behandeln
    // -----------------------------

    if (insertError) {
      console.error(
        "Fehler beim Erstellen der Buchung:",
        insertError
      )

      // PostgreSQL Unique-Constraint
      if (insertError.code === "23505") {
        return {
          ok: false,
          error: "Dieser Termin wurde gerade von jemand anderem gebucht.",
        }
      }

      return {
        ok: false,
        error:
          insertError.message ||
          "Die Buchung konnte nicht erstellt werden.",
      }
    }

    // -----------------------------
    // 9. Seiten aktualisieren
    // -----------------------------

    revalidatePath("/")
    revalidatePath("/besitzer")

    // -----------------------------
    // 10. Erfolgreiche Antwort
    // -----------------------------

    return {
      ok: true,
      bookingId: booking.id,
      booking,
    }
  } catch (error) {
    console.error("createBooking Fehler:", error)

    return {
      ok: false,
      error: "Ein unerwarteter Fehler ist aufgetreten.",
    }
  }
}
