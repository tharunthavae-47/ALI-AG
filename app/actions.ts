"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Resend } from "resend"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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
// HTML SICHER MACHEN
// =====================================================

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
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
    input.email?.trim() ?? ""

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
  // NAME
  // ===================================================

  if (!name) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihren Namen ein.",
    }
  }

  // ===================================================
  // TELEFON
  // ===================================================

  if (!phone) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihre Telefonnummer ein.",
    }
  }

  // ===================================================
  // E-MAIL
  // ===================================================

  if (!email) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihre E-Mail-Adresse ein.",
    }
  }

  // ===================================================
  // FAHRZEUG
  // ===================================================

  if (!car) {
    return {
      ok: false,
      error:
        "Bitte geben Sie Ihr Fahrzeug ein.",
    }
  }

  // ===================================================
  // PROBLEM
  // ===================================================

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
  // VERGANGENES DATUM VERHINDERN
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
  // MAXIMALE LÄNGEN
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
  // BUCHUNG SPEICHERN
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
  // FEHLER
  // ===================================================

  if (error) {
    console.error(
      "createBooking error:",
      error,
    )

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
  // SEITEN AKTUALISIEREN
  // ===================================================

  revalidatePath("/")
  revalidatePath("/besitzer")

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

  // Nur gültige Strings
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
  // BILDER SPEICHERN
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

  return (
    (data ?? []) as Booking[]
  )
}

// =====================================================
// TERMIN BESTÄTIGEN / ABLEHNEN
// =====================================================
//
// BESTÄTIGEN:
// → Status wird auf confirmed gesetzt
// → automatische E-Mail wird verschickt
//
// ABLEHNEN:
// → Status wird auf rejected gesetzt
// → KEINE E-Mail
// → KEINE SMS
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
  // 1. BESITZER PRÜFEN
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
  // 2. STATUS PRÜFEN
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
  // 3. BUCHUNG HOLEN
  // ===================================================

  const supabase =
    createAdminClient()

  const {
    data: booking,
    error: bookingError,
  } =
    await supabase
      .from("bookings")
      .select(
        `
          id,
          booking_date,
          booking_time,
          name,
          phone,
          email,
          car,
          problem,
          status
        `,
      )
      .eq(
        "id",
        id,
      )
      .single()

  if (
    bookingError ||
    !booking
  ) {
    console.error(
      "Buchung nicht gefunden:",
      bookingError?.message,
    )

    return {
      ok: false,
      error:
        "Buchung wurde nicht gefunden.",
    }
  }

  // ===================================================
  // 4. STATUS ÄNDERN
  // ===================================================

  const {
    error: updateError,
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

  if (updateError) {
    console.error(
      "updateBookingStatus error:",
      updateError,
    )

    return {
      ok: false,
      error:
        "Aktualisierung fehlgeschlagen.",
    }
  }

  // ===================================================
  // 5. E-MAIL NUR BEI BESTÄTIGUNG
  // ===================================================

  if (
    status === "confirmed"
  ) {
    try {
      // ===============================================
      // RESEND API KEY
      // ===============================================

      const apiKey =
        process.env.RESEND_API_KEY

      if (!apiKey) {
        console.error(
          "RESEND_API_KEY fehlt in den Vercel Environment Variables.",
        )
      } else {
        // =============================================
        // RESEND CLIENT
        // =============================================

        const resend =
          new Resend(apiKey)

        // =============================================
        // DATUM FORMATIEREN
        // =============================================

        const formattedDate =
          new Date(
            booking.booking_date +
              "T00:00:00",
          ).toLocaleDateString(
            "de-CH",
            {
              weekday:
                "long",

              day: "2-digit",

              month: "2-digit",

              year: "numeric",
            },
          )

        // =============================================
        // E-MAIL SENDEN
        // =============================================

        const {
          data: emailData,
          error: emailError,
        } =
          await resend.emails.send({
            from:
              "MB Performance <onboarding@resend.dev>",

            to: [booking.email],

            subject:
              "Ihr Termin bei MB Performance wurde bestätigt",

            html: `
              <!DOCTYPE html>

              <html lang="de">

                <head>
                  <meta charset="UTF-8" />
                  <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                  />

                  <title>
                    Termin bestätigt
                  </title>
                </head>

                <body
                  style="
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                    font-family: Arial, Helvetica, sans-serif;
                  "
                >

                  <div
                    style="
                      max-width: 600px;
                      margin: 40px auto;
                      background: #ffffff;
                      padding: 40px;
                    "
                  >

                    <h1
                      style="
                        margin: 0 0 10px;
                        font-size: 28px;
                        color: #111111;
                      "
                    >
                      MB Performance
                    </h1>

                    <p
                      style="
                        color: #666666;
                        margin-bottom: 30px;
                      "
                    >
                      Auto Reparatur & Service
                    </p>

                    <h2
                      style="
                        font-size: 24px;
                        color: #111111;
                      "
                    >
                      Ihr Termin wurde bestätigt
                    </h2>

                    <p
                      style="
                        font-size: 16px;
                        line-height: 1.6;
                        color: #333333;
                      "
                    >
                      Hallo
                      <strong>
                        ${escapeHtml(
                          booking.name,
                        )}
                      </strong>,
                    </p>

                    <p
                      style="
                        font-size: 16px;
                        line-height: 1.6;
                        color: #333333;
                      "
                    >
                      Ihr Termin bei
                      <strong>
                        MB Performance
                      </strong>
                      wurde erfolgreich bestätigt.
                    </p>

                    <div
                      style="
                        margin: 30px 0;
                        padding: 20px;
                        background: #f5f5f5;
                        border-left: 4px solid #111111;
                      "
                    >

                      <p
                        style="
                          margin: 0 0 15px;
                          color: #333333;
                        "
                      >
                        <strong>
                          Datum
                        </strong>
                        <br />

                        ${escapeHtml(
                          formattedDate,
                        )}
                      </p>

                      <p
                        style="
                          margin: 0 0 15px;
                          color: #333333;
                        "
                      >
                        <strong>
                          Uhrzeit
                        </strong>
                        <br />

                        ${escapeHtml(
                          booking.booking_time,
                        )}
                      </p>

                      <p
                        style="
                          margin: 0;
                          color: #333333;
                        "
                      >
                        <strong>
                          Fahrzeug
                        </strong>
                        <br />

                        ${escapeHtml(
                          booking.car,
                        )}
                      </p>

                    </div>

                    <p
                      style="
                        font-size: 16px;
                        line-height: 1.6;
                        color: #333333;
                      "
                    >
                      Vielen Dank für Ihr Vertrauen.
                    </p>

                    <p
                      style="
                        font-size: 16px;
                        line-height: 1.6;
                        color: #333333;
                      "
                    >
                      Freundliche Grüsse
                      <br />

                      <strong>
                        MB Performance
                      </strong>
                    </p>

                  </div>

                </body>

              </html>
            `,
          })

        // =============================================
        // E-MAIL FEHLER
        // =============================================

        if (emailError) {
          console.error(
            "Resend E-Mail Fehler:",
            emailError,
          )
        } else {
          console.log(
            "Bestätigungs-E-Mail erfolgreich gesendet:",
            emailData,
          )
        }
      }
    } catch (error) {
      console.error(
        "Fehler beim Senden der Bestätigungs-E-Mail:",
        error,
      )
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
