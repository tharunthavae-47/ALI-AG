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
  contact: string
  car: string
  problem: string
  status: BookingStatus
  created_at: string
  image_urls: string[]
}

// =====================================================
// ÖFFNUNGSZEITEN
// =====================================================

const OPEN_HOUR = 8
const CLOSE_HOUR = 22

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
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

// HTML-Zeichen für E-Mail absichern
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// =====================================================
// BUCHUNGEN FÜR ÖFFENTLICHEN KALENDER
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
    .select(
      "booking_date, booking_time",
    )
    .neq("status", "rejected")
    .gte("booking_date", today)

  if (error) {
    console.log(
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
  contact: string
  car: string
  problem: string
}): Promise<{
  ok: boolean
  bookingId?: string
  error?: string
}> {
  const name =
    input.name?.trim()

  const contact =
    input.contact?.trim()

  const car =
    input.car?.trim()

  const problem =
    input.problem?.trim()

  // Datum prüfen
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

  // Uhrzeit prüfen
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

  // Pflichtfelder prüfen
  if (
    !name ||
    !contact ||
    !car ||
    !problem
  ) {
    return {
      ok: false,
      error:
        "Bitte füllen Sie alle Felder aus.",
    }
  }

  // Vergangenes Datum verhindern
  if (
    input.booking_date <
    new Date()
      .toISOString()
      .slice(0, 10)
  ) {
    return {
      ok: false,
      error:
        "Bitte wählen Sie ein Datum in der Zukunft.",
    }
  }

  // Maximale Länge
  if (
    [name, contact, car, problem].some(
      (value) => value.length > 1000,
    )
  ) {
    return {
      ok: false,
      error: "Eingabe zu lang.",
    }
  }

  // Supabase Admin
  const supabase =
    createAdminClient()

  const { data, error } =
    await supabase
      .from("bookings")
      .insert({
        booking_date:
          input.booking_date,

        booking_time:
          input.booking_time,

        name,

        contact,

        car,

        problem,

        status: "pending",

        // Wichtig für deine Bilder
        image_urls: [],
      })
      .select("id")
      .single()

  if (error) {
    if (
      error.code === "23505"
    ) {
      return {
        ok: false,
        error:
          "Dieser Termin ist leider bereits vergeben.",
      }
    }

    console.log(
      "createBooking error:",
      error.message,
    )

    return {
      ok: false,
      error:
        "Anfrage konnte nicht gespeichert werden.",
    }
  }

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
    bookingId: data.id,
  }
}

// =====================================================
// ALLE BUCHUNGEN FÜR BESITZER
// =====================================================

export async function listBookings(): Promise<
  Booking[]
> {
  // Benutzer prüfen
  const auth =
    await createClient()

  const {
    data: { user },
  } =
    await auth.auth.getUser()

  if (!user) {
    return []
  }

  // Admin Client
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
    console.log(
      "listBookings error:",
      error.message,
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
      error: "Nicht autorisiert.",
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
      error: "Ungültiger Status.",
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
          contact,
          car,
          problem,
          status
        `,
      )
      .eq("id", id)
      .single()

  if (
    bookingError ||
    !booking
  ) {
    console.log(
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
  // 4. STATUS IN SUPABASE ÄNDERN
  // ===================================================

  const {
    error: updateError,
  } = await supabase
    .from("bookings")
    .update({
      status,
    })
    .eq("id", id)

  if (updateError) {
    console.log(
      "Status Update Fehler:",
      updateError.message,
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
    const contact =
      booking.contact?.trim() ??
      ""

    // Prüfen, ob Kontakt eine E-Mail ist
    const isEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        contact,
      )

    if (isEmail) {
      try {
        const apiKey =
          process.env.RESEND_API_KEY

        // Kein API-Key
        if (!apiKey) {
          console.error(
            "RESEND_API_KEY fehlt in den Environment Variables.",
          )
        } else {
          const resend =
            new Resend(apiKey)

          // Datum formatieren
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

          // E-Mail senden
          const {
            error: emailError,
          } =
            await resend.emails.send({
              from:
                "MB Performance <onboarding@resend.dev>",

              to: [contact],

              subject:
                "Termin bei MB Performance bestätigt",

              html: `
                <div
                  style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #111;
                  "
                >

                  <h1>
                    MB Performance
                  </h1>

                  <h2>
                    Ihr Termin wurde bestätigt
                  </h2>

                  <p>
                    Hallo ${escapeHtml(
                      booking.name,
                    )},
                  </p>

                  <p>
                    Ihr Termin bei
                    <strong>
                      MB Performance
                    </strong>
                    wurde erfolgreich bestätigt.
                  </p>

                  <div
                    style="
                      background: #f5f5f5;
                      padding: 20px;
                      margin: 20px 0;
                    "
                  >

                    <p>
                      <strong>
                        Datum:
                      </strong>
                      <br>
                      ${escapeHtml(
                        formattedDate,
                      )}
                    </p>

                    <p>
                      <strong>
                        Uhrzeit:
                      </strong>
                      <br>
                      ${escapeHtml(
                        booking.booking_time,
                      )}
                    </p>

                    <p>
                      <strong>
                        Fahrzeug:
                      </strong>
                      <br>
                      ${escapeHtml(
                        booking.car,
                      )}
                    </p>

                  </div>

                  <p>
                    Vielen Dank für Ihre Anfrage.
                  </p>

                  <p>
                    Freundliche Grüsse
                    <br>
                    <strong>
                      MB Performance
                    </strong>
                  </p>

                </div>
              `,
            })

          if (emailError) {
            console.error(
              "E-Mail Fehler:",
              emailError,
            )
          } else {
            console.log(
              "Bestätigungs-E-Mail gesendet an:",
              contact,
            )
          }
        }
      } catch (error) {
        console.error(
          "Fehler beim Senden der E-Mail:",
          error,
        )
      }
    } else {
      // =================================================
      // TELEFONNUMMER
      // SMS KOMMT ALS NÄCHSTER SCHRITT
      // =================================================

      console.log(
        "Kontakt ist keine E-Mail. SMS kann später gesendet werden:",
        contact,
      )
    }
  }

  // ===================================================
  // 6. SEITEN AKTUALISIEREN
  // ===================================================

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}
