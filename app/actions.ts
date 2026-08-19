"use server"

import { createClient } from "@supabase/supabase-js"

/* =====================================================
   SUPABASE
===================================================== */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL fehlt."
  )
}

if (!supabaseServiceKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY fehlt."
  )
}

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )
    : null

/* =====================================================
   TYPES
===================================================== */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"

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
  created_at?: string
}

/* =====================================================
   BOOKING INPUT
===================================================== */

export type CreateBookingInput = {
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
}

/* =====================================================
   CREATE BOOKING
===================================================== */

export async function createBooking(
  booking: CreateBookingInput,
): Promise<{
  ok: boolean
  bookingId?: string
  error?: string
}> {
  try {
    if (!supabase) {
      return {
        ok: false,
        error:
          "Supabase ist nicht korrekt eingerichtet.",
      }
    }

    /* -----------------------------------------------
       Pflichtfelder prüfen
    ------------------------------------------------ */

    if (
      !booking.booking_date ||
      !booking.booking_time ||
      !booking.name ||
      !booking.phone ||
      !booking.email ||
      !booking.car ||
      !booking.problem
    ) {
      return {
        ok: false,
        error:
          "Für den Termin fehlen noch Angaben.",
      }
    }

    /* -----------------------------------------------
       Prüfen, ob Uhrzeit gültig ist
    ------------------------------------------------ */

    const hour = Number(
      booking.booking_time.split(":")[0],
    )

    if (
      Number.isNaN(hour) ||
      hour < 15 ||
      hour > 22
    ) {
      return {
        ok: false,
        error:
          "Termine sind zwischen 15:00 und 22:00 Uhr möglich.",
      }
    }

    /* -----------------------------------------------
       Prüfen, ob Termin bereits existiert
    ------------------------------------------------ */

    const { data: existingBooking, error: checkError } =
      await supabase
        .from("bookings")
        .select("id")
        .eq(
          "booking_date",
          booking.booking_date,
        )
        .eq(
          "booking_time",
          booking.booking_time,
        )
        .neq("status", "rejected")
        .maybeSingle()

    if (checkError) {
      console.error(
        "BOOKING CHECK ERROR:",
        checkError,
      )

      return {
        ok: false,
        error:
          "Der Termin konnte nicht überprüft werden.",
      }
    }

    if (existingBooking) {
      return {
        ok: false,
        error:
          "Diese Uhrzeit ist bereits vergeben.",
      }
    }

    /* -----------------------------------------------
       Termin erstellen
    ------------------------------------------------ */

    const { data, error } =
      await supabase
        .from("bookings")
        .insert({
          booking_date:
            booking.booking_date,

          booking_time:
            booking.booking_time,

          name:
            booking.name,

          phone:
            booking.phone,

          email:
            booking.email,

          car:
            booking.car,

          problem:
            booking.problem,

          status:
            "pending",
        })
        .select("id")
        .single()

    if (error) {
      console.error(
        "CREATE BOOKING ERROR:",
        error,
      )

      return {
        ok: false,
        error:
          error.message ||
          "Der Termin konnte nicht erstellt werden.",
      }
    }

    return {
      ok: true,
      bookingId: data.id,
    }
  } catch (error) {
    console.error(
      "CREATE BOOKING EXCEPTION:",
      error,
    )

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Erstellen des Termins.",
    }
  }
}

/* =====================================================
   GET BOOKED SLOTS
===================================================== */

export async function getBookedSlots(): Promise<
  Array<{
    booking_date: string
    booking_time: string
  }>
> {
  try {
    if (!supabase) {
      return []
    }

    const { data, error } =
      await supabase
        .from("bookings")
        .select(
          "booking_date, booking_time, status",
        )
        .neq("status", "rejected")

    if (error) {
      console.error(
        "GET BOOKED SLOTS ERROR:",
        error,
      )

      return []
    }

    return (
      data?.map((booking) => ({
        booking_date:
          booking.booking_date,

        booking_time:
          booking.booking_time,
      })) || []
    )
  } catch (error) {
    console.error(
      "GET BOOKED SLOTS EXCEPTION:",
      error,
    )

    return []
  }
}

/* =====================================================
   LIST BOOKINGS
===================================================== */

export async function listBookings(): Promise<{
  ok: boolean
  bookings: Booking[]
  error?: string
}> {
  try {
    if (!supabase) {
      return {
        ok: false,
        bookings: [],
        error:
          "Supabase ist nicht eingerichtet.",
      }
    }

    const { data, error } =
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
        "LIST BOOKINGS ERROR:",
        error,
      )

      return {
        ok: false,
        bookings: [],
        error: error.message,
      }
    }

    return {
      ok: true,
      bookings:
        (data as Booking[]) || [],
    }
  } catch (error) {
    console.error(
      "LIST BOOKINGS EXCEPTION:",
      error,
    )

    return {
      ok: false,
      bookings: [],
      error:
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler.",
    }
  }
}

/* =====================================================
   UPDATE BOOKING STATUS
===================================================== */

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    if (!supabase) {
      return {
        ok: false,
        error:
          "Supabase ist nicht eingerichtet.",
      }
    }

    if (
      !bookingId ||
      !["pending", "confirmed", "rejected"].includes(
        status,
      )
    ) {
      return {
        ok: false,
        error:
          "Ungültige Buchungsdaten.",
      }
    }

    const { error } =
      await supabase
        .from("bookings")
        .update({
          status,
        })
        .eq("id", bookingId)

    if (error) {
      console.error(
        "UPDATE BOOKING STATUS ERROR:",
        error,
      )

      return {
        ok: false,
        error: error.message,
      }
    }

    return {
      ok: true,
    }
  } catch (error) {
    console.error(
      "UPDATE BOOKING STATUS EXCEPTION:",
      error,
    )

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler.",
    }
  }
}
