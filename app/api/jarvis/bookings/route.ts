import { NextResponse } from "next/server"
import {
  getBookingsForDate,
  getOpenBookings,
} from "@/lib/jarvis"
import { createAdminClient } from "@/lib/supabase/admin"

const OPEN_HOUR = 15
const CLOSE_HOUR = 22

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidTime(value: string) {
  const match = /^(\d{2}):00$/.exec(value)

  if (!match) {
    return false
  }

  const hour = Number(match[1])

  return hour >= OPEN_HOUR && hour <= CLOSE_HOUR
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| ?date=2026-08-20
| → Gibt die Buchungen für diesen Tag zurück
|
| ?open=true
| → Gibt offene Buchungen zurück
|
| ?available=true&date=2026-08-20
| → Gibt freie Uhrzeiten zurück
|
*/

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const date = searchParams.get("date")
    const open = searchParams.get("open")
    const available = searchParams.get("available")

    /*
    |--------------------------------------------------------------------------
    | Offene Buchungen
    |--------------------------------------------------------------------------
    */

    if (open === "true") {
      const bookings = await getOpenBookings()

      return NextResponse.json({
        success: true,
        bookings,
      })
    }

    /*
    |--------------------------------------------------------------------------
    | Freie Termine
    |--------------------------------------------------------------------------
    */

    if (available === "true") {
      if (!date || !isValidDate(date)) {
        return NextResponse.json(
          {
            success: false,
            error: "Ungültiges Datum.",
          },
          {
            status: 400,
          },
        )
      }

      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from("bookings")
        .select("booking_time")
        .eq("booking_date", date)
        .neq("status", "rejected")
        .order("booking_time", {
          ascending: true,
        })

      if (error) {
        console.error(
          "JARVIS AVAILABLE SLOTS ERROR:",
          error,
        )

        return NextResponse.json(
          {
            success: false,
            error:
              "Freie Termine konnten nicht geladen werden.",
          },
          {
            status: 500,
          },
        )
      }

      const bookedTimes = new Set(
        (data ?? []).map(
          (booking) => booking.booking_time,
        ),
      )

      const availableSlots: string[] = []

      for (
        let hour = OPEN_HOUR;
        hour <= CLOSE_HOUR;
        hour++
      ) {
        const time = `${String(hour).padStart(
          2,
          "0",
        )}:00`

        if (!bookedTimes.has(time)) {
          availableSlots.push(time)
        }
      }

      return NextResponse.json({
        success: true,
        date,
        availableSlots,
      })
    }

    /*
    |--------------------------------------------------------------------------
    | Buchungen eines Tages
    |--------------------------------------------------------------------------
    */

    if (!date) {
      return NextResponse.json(
        {
          error: "Datum fehlt.",
        },
        {
          status: 400,
        },
      )
    }

    const bookings =
      await getBookingsForDate(date)

    return NextResponse.json({
      success: true,
      bookings,
    })
  } catch (error) {
    console.error(
      "JARVIS BOOKINGS ERROR:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          "Termine konnten nicht geladen werden.",
      },
      {
        status: 500,
      },
    )
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| Erstellt eine neue Terminanfrage.
|
*/

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const booking_date =
      typeof body?.booking_date === "string"
        ? body.booking_date.trim()
        : ""

    const booking_time =
      typeof body?.booking_time === "string"
        ? body.booking_time.trim()
        : ""

    const name =
      typeof body?.name === "string"
        ? body.name.trim()
        : ""

    const phone =
      typeof body?.phone === "string"
        ? body.phone.trim()
        : ""

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : ""

    const car =
      typeof body?.car === "string"
        ? body.car.trim()
        : ""

    const problem =
      typeof body?.problem === "string"
        ? body.problem.trim()
        : ""

    /*
    |--------------------------------------------------------------------------
    | Validierung
    |--------------------------------------------------------------------------
    */

    if (
      !booking_date ||
      !isValidDate(booking_date)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültiges Datum.",
        },
        {
          status: 400,
        },
      )
    }

    if (
      !booking_time ||
      !isValidTime(booking_time)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültige Uhrzeit.",
        },
        {
          status: 400,
        },
      )
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Name fehlt.",
        },
        {
          status: 400,
        },
      )
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Telefonnummer fehlt.",
        },
        {
          status: 400,
        },
      )
    }

    if (
      !email ||
      !isValidEmail(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ungültige E-Mail-Adresse.",
        },
        {
          status: 400,
        },
      )
    }

    if (!car) {
      return NextResponse.json(
        {
          success: false,
          error: "Fahrzeug fehlt.",
        },
        {
          status: 400,
        },
      )
    }

    if (!problem) {
      return NextResponse.json(
        {
          success: false,
          error: "Anliegen fehlt.",
        },
        {
          status: 400,
        },
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Vergangenes Datum verhindern
    |--------------------------------------------------------------------------
    */

    const today = new Date()
      .toISOString()
      .slice(0, 10)

    if (booking_date < today) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Das Datum liegt in der Vergangenheit.",
        },
        {
          status: 400,
        },
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Supabase
    |--------------------------------------------------------------------------
    */

    const supabase =
      createAdminClient()

    /*
    |--------------------------------------------------------------------------
    | Prüfen, ob Termin noch frei ist
    |--------------------------------------------------------------------------
    */

    const { data: existingBooking, error: checkError } =
      await supabase
        .from("bookings")
        .select("id")
        .eq("booking_date", booking_date)
        .eq("booking_time", booking_time)
        .neq("status", "rejected")
        .maybeSingle()

    if (checkError) {
      console.error(
        "JARVIS BOOKING CHECK ERROR:",
        checkError,
      )

      return NextResponse.json(
        {
          success: false,
          error:
            "Die Verfügbarkeit konnte nicht geprüft werden.",
        },
        {
          status: 500,
        },
      )
    }

    if (existingBooking) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dieser Termin ist leider bereits vergeben.",
        },
        {
          status: 409,
        },
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Buchung erstellen
    |--------------------------------------------------------------------------
    */

    const { data, error } =
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
        .select("id")
        .single()

    if (error) {
      console.error(
        "JARVIS CREATE BOOKING ERROR:",
        error,
      )

      return NextResponse.json(
        {
          success: false,
          error:
            "Die Terminanfrage konnte nicht gespeichert werden.",
        },
        {
          status: 500,
        },
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Erfolgreich
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,
      bookingId: data.id,
      status: "pending",
      message:
        "Die Terminanfrage wurde erfolgreich erstellt.",
    })
  } catch (error) {
    console.error(
      "JARVIS POST BOOKING ERROR:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler.",
      },
      {
        status: 500,
      },
    )
  }
}