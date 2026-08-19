"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Resend } from "resend"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// =====================================================
// KONFIGURATION
// =====================================================

const COMPANY_EMAIL = "mb-performance1@outlook.com"

const OPEN_HOUR = 15
const CLOSE_HOUR = 22

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
// HILFSFUNKTIONEN
// =====================================================

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime())
}

function isValidTime(value: string) {
  if (!/^\d{2}:00$/.test(value)) {
    return false
  }

  const hour = Number(value.slice(0, 2))

  return hour >= OPEN_HOUR && hour <= CLOSE_HOUR
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// =====================================================
// ABMELDEN
// =====================================================

export async function signOut() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect("/auth/login")
}

// =====================================================
// BELEGTE TERMINE ABRUFEN
// =====================================================

export async function getBookedSlots(): Promise<
  PublicSlot[]
> {
  const supabase = createAdminClient()

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_date, booking_time")
    .neq("status", "rejected")
    .gte("booking_date", today)

  if (error) {
    console.error(
      "getBookedSlots error:",
      error,
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
  // DATEN BEREINIGEN
  // ===================================================

  const bookingDate =
    input.booking_date?.trim() ?? ""

  const bookingTime =
    input.booking_time?.trim() ?? ""

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
  // DATUM
  // ===================================================

  if (!isValidDate(bookingDate)) {
    return {
      ok: false,
      error: "Ungültiges Datum.",
    }
  }

  // ===================================================
  // UHRZEIT
  // ===================================================

  if (!isValidTime(bookingTime)) {
    return {
      ok: false,
      error:
        "Ungültige Uhrzeit. Termine sind zwischen 15:00 und 22:00 Uhr möglich.",
    }
  }

  // ===================================================
  // PFLICHTFELDER
  // ===================================================

  if (!name) {
    return {
      ok: false,
      error: "Bitte gib deinen Namen an.",
    }
  }

  if (!phone) {
    return {
      ok: false,
      error:
        "Bitte gib deine Telefonnummer an.",
    }
  }

  if (!email) {
    return {
      ok: false,
      error:
        "Bitte gib deine E-Mail-Adresse an.",
    }
  }

  if (!car) {
    return {
      ok: false,
      error:
        "Bitte gib dein Fahrzeug an.",
    }
  }

  if (!problem) {
    return {
      ok: false,
      error:
        "Bitte beschreibe, was an deinem Fahrzeug gemacht werden soll.",
    }
  }

  // ===================================================
  // E-MAIL VALIDIEREN
  // ===================================================

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    return {
      ok: false,
      error:
        "Bitte gib eine gültige E-Mail-Adresse ein.",
    }
  }

  // ===================================================
  // TELEFON VALIDIEREN
  // ===================================================

  const phoneDigits =
    phone.replace(/\D/g, "")

  if (phoneDigits.length < 7) {
    return {
      ok: false,
      error:
        "Bitte gib eine gültige Telefonnummer ein.",
    }
  }

  // ===================================================
  // VERGANGENES DATUM
  // ===================================================

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  if (bookingDate < today) {
    return {
      ok: false,
      error:
        "Der Termin darf nicht in der Vergangenheit liegen.",
    }
  }

  // ===================================================
  // LÄNGEN
  // ===================================================

  if (name.length > 200) {
    return {
      ok: false,
      error: "Der Name ist zu lang.",
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
  // SUPABASE ADMIN
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // SICHERHEIT:
  // PRÜFEN OB TERMIN BEREITS EXISTIERT
  // ===================================================

  const {
    data: existingBooking,
    error: existingError,
  } = await supabase
    .from("bookings")
    .select("id")
    .eq(
      "booking_date",
      bookingDate,
    )
    .eq(
      "booking_time",
      bookingTime,
    )
    .neq("status", "rejected")
    .maybeSingle()

  if (existingError) {
    console.error(
      "Terminprüfung fehlgeschlagen:",
      existingError,
    )

    return {
      ok: false,
      error:
        "Der Termin konnte nicht geprüft werden.",
    }
  }

  if (existingBooking) {
    return {
      ok: false,
      error:
        "Dieser Termin ist leider bereits vergeben.",
    }
  }

  // ===================================================
  // TERMIN SPEICHERN
  // ===================================================

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .insert({
      booking_date: bookingDate,
      booking_time: bookingTime,
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

  if (error) {
    console.error(
      "createBooking insert error:",
      error,
    )

    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "Dieser Termin ist leider bereits vergeben.",
      }
    }

    return {
      ok: false,
      error:
        "Die Terminanfrage konnte nicht gespeichert werden.",
    }
  }

  // ===================================================
  // E-MAILS
  // ===================================================

  try {
    const apiKey =
      process.env.RESEND_API_KEY

    const fromEmail =
      process.env.RESEND_FROM_EMAIL

    if (!apiKey) {
      console.error(
        "RESEND_API_KEY fehlt.",
      )
    } else if (!fromEmail) {
      console.error(
        "RESEND_FROM_EMAIL fehlt.",
      )
    } else {
      const resend =
        new Resend(apiKey)

      // =================================================
      // KUNDEN E-MAIL
      // =================================================

      const customerHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terminanfrage MB-Performance</title>
</head>

<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px;">

<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:12px;">

<h1>Vielen Dank, ${escapeHtml(
        name,
      )}! 🚗</h1>

<p>
Wir haben deine Terminanfrage erhalten.
</p>

<p>
Deine Anfrage wartet nun auf die Bestätigung durch MB-Performance.
</p>

<h2>Termin</h2>

<p>
<strong>Datum:</strong>
${escapeHtml(bookingDate)}
</p>

<p>
<strong>Uhrzeit:</strong>
${escapeHtml(bookingTime)}
</p>

<h2>Fahrzeug</h2>

<p>
${escapeHtml(car)}
</p>

<h2>Anliegen</h2>

<p>
${escapeHtml(problem).replace(
  /\n/g,
  "<br>",
)}
</p>

<hr>

<p>
<strong>MB-Performance</strong>
</p>

<p>
Freundliche Grüsse
</p>

</div>

</body>
</html>
`

      const customerResult =
        await resend.emails.send({
          from: fromEmail,
          to: email,
          replyTo: COMPANY_EMAIL,
          subject:
            "Ihre Terminanfrage bei MB-Performance",
          html: customerHtml,
        })

      if (customerResult.error) {
        console.error(
          "Kunden-E-Mail Fehler:",
          customerResult.error,
        )
      }

      // =================================================
      // MB-PERFORMANCE E-MAIL
      // =================================================

      const companyHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Neue Terminanfrage</title>
</head>

<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px;">

<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:12px;">

<h1>🔔 Neue Terminanfrage</h1>

<p>
JARVIS bzw. die MB-Performance Website hat eine neue Terminanfrage erstellt.
</p>

<hr>

<h2>Kunde</h2>

<p>
<strong>Name:</strong>
${escapeHtml(name)}
</p>

<p>
<strong>Telefon:</strong>
${escapeHtml(phone)}
</p>

<p>
<strong>E-Mail:</strong>
${escapeHtml(email)}
</p>

<h2>Termin</h2>

<p>
<strong>Datum:</strong>
${escapeHtml(bookingDate)}
</p>

<p>
<strong>Uhrzeit:</strong>
${escapeHtml(bookingTime)}
</p>

<h2>Fahrzeug</h2>

<p>
${escapeHtml(car)}
</p>

<h2>Anliegen</h2>

<p>
${escapeHtml(problem).replace(
  /\n/g,
  "<br>",
)}
</p>

<hr>

<p>
<strong>Status:</strong>
Wartet auf Bestätigung
</p>

</div>

</body>
</html>
`

      const companyResult =
        await resend.emails.send({
          from: fromEmail,
          to: COMPANY_EMAIL,
          replyTo: email,
          subject:
            "🔔 Neue Terminanfrage – " +
            name,
          html: companyHtml,
        })

      if (companyResult.error) {
        console.error(
          "MB-Performance E-Mail Fehler:",
          companyResult.error,
        )
      }
    }
  } catch (error) {
    console.error(
      "Resend Fehler:",
      error,
    )
  }

  // ===================================================
  // SEITEN AKTUALISIEREN
  // ===================================================

  revalidatePath("/")
  revalidatePath("/besitzer")

  // ===================================================
  // ERFOLG
  // ===================================================

  return {
    ok: true,
    bookingId: data.id,
  }
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
  if (!bookingId) {
    return {
      ok: false,
      error:
        "Buchungs-ID fehlt.",
    }
  }

  if (!Array.isArray(imageUrls)) {
    return {
      ok: false,
      error:
        "Ungültige Bilddaten.",
    }
  }

  if (imageUrls.length > 5) {
    return {
      ok: false,
      error:
        "Maximal 5 Bilder sind erlaubt.",
    }
  }

  const validUrls =
    imageUrls.filter(
      (url): url is string =>
        typeof url === "string" &&
        url.trim() !== "",
    )

  const supabase =
    createAdminClient()

  const { error } =
    await supabase
      .from("bookings")
      .update({
        image_urls: validUrls,
      })
      .eq("id", bookingId)

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

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}

// =====================================================
// ALLE BUCHUNGEN
// =====================================================

export async function listBookings(): Promise<
  Booking[]
> {
  const auth =
    await createClient()

  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) {
    return []
  }

  const supabase =
    createAdminClient()

  const {
    data,
    error,
  } = await supabase
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

  return (data ?? []) as Booking[]
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
  // BESITZER AUTHENTIFIZIEREN
  // ===================================================

  const auth =
    await createClient()

  const {
    data: { user },
  } = await auth.auth.getUser()

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
  // ADMIN CLIENT
  // ===================================================

  const supabase =
    createAdminClient()

  // ===================================================
  // BUCHUNG LADEN
  // ===================================================

  const {
    data: booking,
    error:
      bookingError,
  } = await supabase
    .from("bookings")
    .select(
      "id, booking_date, booking_time, name, email, car, problem",
    )
    .eq("id", id)
    .single()

  if (
    bookingError ||
    !booking
  ) {
    console.error(
      "Buchung nicht gefunden:",
      bookingError,
    )

    return {
      ok: false,
      error:
        "Die Buchung wurde nicht gefunden.",
    }
  }

  // ===================================================
  // STATUS ÄNDERN
  // ===================================================

  const {
    error,
  } = await supabase
    .from("bookings")
    .update({
      status,
    })
    .eq("id", id)

  if (error) {
    console.error(
      "updateBookingStatus error:",
      error,
    )

    return {
      ok: false,
      error:
        "Der Status konnte nicht geändert werden.",
    }
  }

  // ===================================================
  // E-MAIL AN KUNDEN
  // ===================================================

  try {
    const apiKey =
      process.env.RESEND_API_KEY

    const fromEmail =
      process.env.RESEND_FROM_EMAIL

    if (
      !apiKey ||
      !fromEmail ||
      !booking.email
    ) {
      console.error(
        "E-Mail-Konfiguration fehlt.",
      )
    } else {
      const resend =
        new Resend(apiKey)

      let subject = ""
      let html = ""

      // =================================================
      // BESTÄTIGT
      // =================================================

      if (
        status === "confirmed"
      ) {
        subject =
          "Termin bei MB-Performance bestätigt ✅"

        html = `
<!DOCTYPE html>
<html lang="de">

<body style="font-family:Arial;background:#f5f5f5;padding:30px;">

<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:12px;">

<h1>Termin bestätigt ✅</h1>

<p>
Hallo ${escapeHtml(
          booking.name,
        )},
</p>

<p>
dein Termin bei <strong>MB-Performance</strong> wurde bestätigt.
</p>

<h2>Dein Termin</h2>

<p>
<strong>Datum:</strong>
${escapeHtml(
  booking.booking_date,
)}
</p>

<p>
<strong>Uhrzeit:</strong>
${escapeHtml(
  booking.booking_time,
)}
</p>

<p>
<strong>Fahrzeug:</strong>
${escapeHtml(
  booking.car,
)}
</p>

<hr>

<p>
Wir freuen uns auf deinen Besuch.
</p>

<p>
<strong>MB-Performance</strong>
</p>

</div>

</body>
</html>
`
      }

      // =================================================
      // ABGELEHNT
      // =================================================

      if (
        status === "rejected"
      ) {
        subject =
          "Terminanfrage bei MB-Performance"

        html = `
<!DOCTYPE html>
<html lang="de">

<body style="font-family:Arial;background:#f5f5f5;padding:30px;">

<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:12px;">

<h1>Terminanfrage</h1>

<p>
Hallo ${escapeHtml(
          booking.name,
        )},
</p>

<p>
leider konnten wir deine Terminanfrage nicht bestätigen.
</p>

<h2>Angefragter Termin</h2>

<p>
<strong>Datum:</strong>
${escapeHtml(
  booking.booking_date,
)}
</p>

<p>
<strong>Uhrzeit:</strong>
${escapeHtml(
  booking.booking_time,
)}
</p>

<p>
<strong>Fahrzeug:</strong>
${escapeHtml(
  booking.car,
)}
</p>

<hr>

<p>
Bitte kontaktiere uns gerne für einen anderen Termin.
</p>

<p>
<strong>MB-Performance</strong>
</p>

</div>

</body>
</html>
`
      }

      // =================================================
      // E-MAIL SENDEN
      // =================================================

      if (subject && html) {
        const result =
          await resend.emails.send({
            from: fromEmail,
            to: booking.email,
            replyTo:
              COMPANY_EMAIL,
            subject,
            html,
          })

        if (result.error) {
          console.error(
            "Status-E-Mail Fehler:",
            result.error,
          )
        }
      }
    }
  } catch (error) {
    console.error(
      "Status-E-Mail Fehler:",
      error,
    )
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
