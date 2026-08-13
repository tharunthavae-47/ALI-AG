```tsx
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Resend } from "resend"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// =====================================================
// RESEND
// =====================================================

const resend = new Resend(process.env.RESEND_API_KEY)

// =====================================================
// ABMELDEN
// =====================================================

export async function signOut() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect("/auth/login")
}

// =====================================================
// TYPES
// =====================================================

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"

export type PublicSlot = {
  booking_date: string
  booking_time: string
}

export type Booking = {
  id: string

  booking_date: string
  booking_time: string

  name: string

  phone: string
  email: string

  car: string
  problem: string

  status: BookingStatus

  created_at: string

  image_urls: string[]
}

// =====================================================
// ÖFFNUNGSZEITEN
// =====================================================

const OPEN_HOUR = 15
const CLOSE_HOUR = 22

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(value + "T00:00:00")

  return !Number.isNaN(date.getTime())
}

function isValidTime(value: string) {
  const match = /^(\d{2}):00$/.exec(value)

  if (!match) {
    return false
  }

  const hour = Number(match[1])

  return (
    hour >= OPEN_HOUR &&
    hour <= CLOSE_HOUR
  )
}

// =====================================================
// BELEGTE TERMINE
// =====================================================

export async function getBookedSlots(): Promise<
  PublicSlot[]
> {
  const supabase = createAdminClient()

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .select(
      "booking_date, booking_time",
    )
    .neq("status", "rejected")
    .gte("booking_date", today)

  if (error) {
    console.error(
      "getBookedSlots error:",
      error.message,
    )

    return []
  }

  return data ?? []
}

// =====================================================
// TERMIN ERSTELLEN
// =====================================================

export async function createBooking(input: {
  booking_date: string
  booking_time: string

  name: string

  phone: string
  email: string

  car: string
  problem: string
}): Promise<{
  ok: boolean
  bookingId?: string
  error?: string
}> {
  // ===================================================
  // WERTE BEREINIGEN
  // ===================================================

  const name =
    input.name?.trim() ?? ""

  const phone =
    input.phone?.trim() ?? ""

  const email =
    input.email?.trim().toLowerCase() ?? ""

  const car =
    input.car?.trim() ?? ""

  const problem =
    input.problem?.trim() ?? ""

  // ===================================================
  // DATUM PRÜFEN
  // ===================================================

  if (
    !isValidDate(
      input.booking_date,
    )
  ) {
    return {
      ok: false,
      error: "Ungültiges Datum.",
    }
  }

  // ===================================================
  // UHRZEIT PRÜFEN
  // ===================================================

  if (
    !isValidTime(
      input.booking_time,
    )
  ) {
    return {
      ok: false,
      error: "Ungültige Uhrzeit.",
    }
  }

  // ===================================================
  // PFLICHTFELDER
  // ===================================================

  if (!name) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihren Namen ein.",
    }
  }

  if (!phone) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihre Telefonnummer ein.",
    }
  }

  if (!email) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihre E-Mail-Adresse ein.",
    }
  }

  if (!car) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihr Fahrzeug ein.",
    }
  }

  if (!problem) {
    return {
      ok: false,
      error:
        "Bitte beschreiben Sie Ihr Anliegen.",
    }
  }

  // ===================================================
  // E-MAIL PRÜFEN
  // ===================================================

  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )

  if (!emailValid) {
    return {
      ok: false,
      error:
        "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    }
  }

  // ===================================================
  // TELEFON PRÜFEN
  // ===================================================

  const phoneDigits =
    phone.replace(/\D/g, "")

  if (phoneDigits.length < 7) {
    return {
      ok: false,
      error:
        "Bitte geben Sie eine gültige Telefonnummer ein.",
    }
  }

  // ===================================================
  // VERGANGENES DATUM
  // ===================================================

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  if (
    input.booking_date < today
  ) {
    return {
      ok: false,
      error:
        "Bitte wählen Sie ein Datum in der Zukunft.",
    }
  }

  // ===================================================
  // MAXIMALE LÄNGE
  // ===================================================

  if (name.length > 200) {
    return {
      ok: false,
      error:
        "Der Name ist zu lang.",
    }
  }

  if (phone.length > 50) {
    return {
      ok: false,
      error:
        "Die Telefonnummer ist zu lang.",
    }
  }

  if (email.length > 320) {
    return {
      ok: false,
      error:
        "Die E-Mail-Adresse ist zu lang.",
    }
  }

  if (car.length > 200) {
    return {
      ok: false,
      error:
        "Die Fahrzeugangabe ist zu lang.",
    }
  }

  if (problem.length > 2000) {
    return {
      ok: false,
      error:
        "Die Beschreibung ist zu lang.",
    }
  }

  // ===================================================
  // SUPABASE
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // TERMIN SPEICHERN
  // ===================================================

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .insert({
        booking_date:
          input.booking_date,

        booking_time:
          input.booking_time,

        name,

        phone,

        email,

        car,

        problem,

        status: "pending",

        image_urls: [],
      })
      .select("id")
      .single()

  // ===================================================
  // FEHLER BEIM SPEICHERN
  // ===================================================

  if (error) {
    console.error(
      "createBooking error:",
      error,
    )

    // Termin bereits vergeben
    if (
      error.code === "23505"
    ) {
      return {
        ok: false,
        error:
          "Dieser Termin ist leider bereits vergeben.",
      }
    }

    return {
      ok: false,
      error:
        "Anfrage konnte nicht gespeichert werden.",
    }
  }

 // ===================================================
// AUTOMATISCHE E-MAIL AN KUNDEN
// ===================================================

try {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY fehlt.")
  } else if (!process.env.RESEND_FROM_EMAIL) {
    console.error("RESEND_FROM_EMAIL fehlt.")
  } else {
    const htmlContent = [
      "<!DOCTYPE html>",
      '<html lang="de">',
      "<head>",
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      "<title>Terminanfrage ALI AG</title>",
      "</head>",
      '<body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:30px;">',

      '<div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:12px;">',

      `<h1>Vielen Dank, ${escapeHtml(name)}!</h1>`,

      "<p>Wir haben Ihre Terminanfrage erhalten.</p>",

      "<p>Ihre Anfrage wird nun geprüft.</p>",

      "<h2>Ihre Angaben</h2>",

      `<p><strong>Datum:</strong> ${escapeHtml(input.booking_date)}</p>`,

      `<p><strong>Uhrzeit:</strong> ${escapeHtml(input.booking_time)}</p>`,

      `<p><strong>Fahrzeug:</strong> ${escapeHtml(car)}</p>`,

      `<p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>`,

      `<p><strong>E-Mail:</strong> ${escapeHtml(email)}</p>`,

      `<p><strong>Anliegen:</strong><br>${escapeHtml(problem).replace(/\n/g, "<br>")}</p>`,

      "<hr>",

      "<p>Freundliche Grüsse</p>",

      "<p><strong>ALI AG</strong></p>",

      "</div>",
      "</body>",
      "</html>",
    ].join("")

    const { error: emailError } =
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "Ihre Terminanfrage bei ALI AG",
        html: htmlContent,
      })

    if (emailError) {
      console.error(
        "Resend email error:",
        emailError,
      )
    } else {
      console.log(
        "E-Mail erfolgreich gesendet an:",
        email,
      )
    }
  }
} catch (emailError) {
  console.error(
    "E-Mail konnte nicht gesendet werden:",
    emailError,
  )
}

// =====================================================
// HTML SICHER MACHEN
// =====================================================

function escapeHtml(
  value: string,
) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// =====================================================
// BILDER SPEICHERN
// =====================================================

export async function saveBookingImages(
  bookingId: string,
  imageUrls: string[],
): Promise<{
  ok: boolean
  error?: string
}> {
  // ===================================================
  // BUCHUNGS-ID PRÜFEN
  // ===================================================

  if (!bookingId) {
    return {
      ok: false,
      error:
        "Buchungs-ID fehlt.",
    }
  }

  // ===================================================
  // BILDER PRÜFEN
  // ===================================================

  if (!Array.isArray(imageUrls)) {
    return {
      ok: false,
      error:
        "Ungültige Bilddaten.",
    }
  }

  // Maximal 5 Bilder
  if (imageUrls.length > 5) {
    return {
      ok: false,
      error:
        "Es sind maximal 5 Bilder erlaubt.",
    }
  }

  // Nur Strings erlauben
  const validImageUrls =
    imageUrls.filter(
      (url): url is string =>
        typeof url === "string" &&
        url.trim() !== "",
    )

  // ===================================================
  // SUPABASE
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // BILDER IN BUCHUNG SPEICHERN
  // ===================================================

  const {
    error,
  } =
    await supabase
      .from("bookings")
      .update({
        image_urls:
          validImageUrls,
      })
      .eq(
        "id",
        bookingId,
      )

  if (error) {
    console.error(
      "saveBookingImages error:",
      error,
    )

    return {
      ok: false,
      error:
        "Die Bilder konnten nicht gespeichert werden.",
    }
  }

  // ===================================================
  // AKTUALISIEREN
  // ===================================================

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}

// =====================================================
// ALLE BUCHUNGEN FÜR BESITZER
// =====================================================

export async function listBookings(): Promise<
  Booking[]
> {
  // ===================================================
  // BENUTZER PRÜFEN
  // ===================================================

  const auth =
    await createClient()

  const {
    data: { user },
  } =
    await auth.auth.getUser()

  if (!user) {
    return []
  }

  // ===================================================
  // ADMIN CLIENT
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // BUCHUNGEN LADEN
  // ===================================================

  const {
    data,
    error,
  } =
    await supabase
      .from("bookings")
      .select("*")
      .order(
        "booking_date",
        {
          ascending: true,
        },
      )
      .order(
        "booking_time",
        {
          ascending: true,
        },
      )

  if (error) {
    console.error(
      "listBookings error:",
      error,
    )

    return []
  }

  // ===================================================
  // DATEN ZURÜCKGEBEN
  // ===================================================

  return (
    (data ?? []) as Booking[]
  )
}

// =====================================================
// TERMIN BESTÄTIGEN / ABLEHNEN
// =====================================================

export async function updateBookingStatus(
  id: string,
  status: Exclude<
    BookingStatus,
    "pending"
  >,
): Promise<{
  ok: boolean
  error?: string
}> {
  // ===================================================
  // BESITZER PRÜFEN
  // ===================================================

  const auth =
    await createClient()

  const {
    data: { user },
  } =
    await auth.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error:
        "Nicht autorisiert.",
    }
  }

  // ===================================================
  // STATUS PRÜFEN
  // ===================================================

  if (
    status !== "confirmed" &&
    status !== "rejected"
  ) {
    return {
      ok: false,
      error:
        "Ungültiger Status.",
    }
  }

  // ===================================================
  // SUPABASE
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // STATUS ÄNDERN
  // ===================================================

  const {
    error,
  } =
    await supabase
      .from("bookings")
      .update({
        status,
      })
      .eq(
        "id",
        id,
      )

  if (error) {
    console.error(
      "updateBookingStatus error:",
      error,
    )

    return {
      ok: false,
      error:
        "Aktualisierung fehlgeschlagen.",
    }
  }

  // ===================================================
  // SEITEN AKTUALISIEREN
  // ===================================================

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}
```
