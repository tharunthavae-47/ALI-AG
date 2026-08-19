"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

// ============================================================
// TYPES
// ============================================================

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"

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
  image_urls?: string[] | null
}

export type PublicSlot = {
  time: string
  available: boolean
}

export type CreateBookingData = {
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
  image_urls?: string[]
}

// ============================================================
// CREATE BOOKING
// ============================================================

export async function createBooking(
  data: CreateBookingData
) {
  try {
    const supabase = await createClient()

    if (!data) {
      return {
        ok: false,
        error: "Keine Buchungsdaten erhalten.",
      }
    }

    const booking_date = String(
      data.booking_date ?? ""
    ).trim()

    const booking_time = String(
      data.booking_time ?? ""
    ).trim()

    const name = String(
      data.name ?? ""
    ).trim()

    const phone = String(
      data.phone ?? ""
    ).trim()

    const email = String(
      data.email ?? ""
    )
      .trim()
      .toLowerCase()

    const car = String(
      data.car ?? ""
    ).trim()

    const problem = String(
      data.problem ?? ""
    ).trim()

    const image_urls = Array.isArray(
      data.image_urls
    )
      ? data.image_urls
      : []

    // ----------------------------------------------------------
    // Pflichtfelder
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Datum prüfen
    // ----------------------------------------------------------

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        booking_date
      )
    ) {
      return {
        ok: false,
        error: "Das Datum ist ungültig.",
      }
    }

    const selectedDate = new Date(
      `${booking_date}T00:00:00`
    )

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return {
        ok: false,
        error: "Das Datum ist ungültig.",
      }
    }

    const today = new Date()

    today.setHours(
      0,
      0,
      0,
      0
    )

    if (selectedDate < today) {
      return {
        ok: false,
        error:
          "Ein Termin in der Vergangenheit ist nicht möglich.",
      }
    }

    // ----------------------------------------------------------
    // Uhrzeit prüfen
    // ----------------------------------------------------------

    if (
      !/^\d{2}:\d{2}$/.test(
        booking_time
      )
    ) {
      return {
        ok: false,
        error: "Die Uhrzeit ist ungültig.",
      }
    }

    const [
      hourString,
      minuteString,
    ] = booking_time.split(":")

    const hour = Number(
      hourString
    )

    const minute = Number(
      minuteString
    )

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return {
        ok: false,
        error: "Die Uhrzeit ist ungültig.",
      }
    }

    // ----------------------------------------------------------
    // E-Mail prüfen
    // ----------------------------------------------------------

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
      return {
        ok: false,
        error:
          "Bitte gib eine gültige E-Mail-Adresse ein.",
      }
    }

    // ----------------------------------------------------------
    // Textlängen
    // ----------------------------------------------------------

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

    if (car.length > 300) {
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
          "Die Problembeschreibung ist zu lang.",
      }
    }

    // ----------------------------------------------------------
    // Prüfen ob Termin bereits vergeben
    // ----------------------------------------------------------

    const {
      data: existingBooking,
      error: existingError,
    } = await supabase
      .from("bookings")
      .select("id, status")
      .eq(
        "booking_date",
        booking_date
      )
      .eq(
        "booking_time",
        booking_time
      )
      .in("status", [
        "pending",
        "confirmed",
      ])
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error(
        "Fehler beim Prüfen des Termins:",
        existingError
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
          "Dieser Termin ist bereits vergeben.",
      }
    }

    // ----------------------------------------------------------
    // Buchung erstellen
    // ----------------------------------------------------------

    const {
      data: booking,
      error: insertError,
    } = await supabase
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
        image_urls,
      })
      .select("*")
      .single()

    if (insertError) {
      console.error(
        "Fehler beim Erstellen der Buchung:",
        insertError
      )

      if (
        insertError.code ===
        "23505"
      ) {
        return {
          ok: false,
          error:
            "Dieser Termin wurde gerade von jemand anderem gebucht.",
        }
      }

      return {
        ok: false,
        error:
          insertError.message ||
          "Die Buchung konnte nicht erstellt werden.",
      }
    }

    revalidatePath("/")
    revalidatePath("/besitzer")

    return {
      ok: true,
      bookingId: booking.id,
      booking:
        booking as Booking,
    }
  } catch (error) {
    console.error(
      "createBooking Fehler:",
      error
    )

    return {
      ok: false,
      error:
        "Ein unerwarteter Fehler ist aufgetreten.",
    }
  }
}

// ============================================================
// SAVE BOOKING IMAGES
// ============================================================

export async function saveBookingImages(
  bookingId: string,
  imageUrls: string[]
) {
  try {
    const supabase =
      await createClient()

    if (!bookingId) {
      return {
        ok: false,
        error:
          "Keine Buchungs-ID angegeben.",
      }
    }

    if (!Array.isArray(imageUrls)) {
      return {
        ok: false,
        error:
          "Ungültige Bilddaten.",
      }
    }

    const cleanImageUrls =
      imageUrls
        .filter(
          (url) =>
            typeof url ===
              "string" &&
            url.trim().length > 0
        )
        .map((url) =>
          url.trim()
        )

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .update({
        image_urls:
          cleanImageUrls,
      })
      .eq(
        "id",
        bookingId
      )
      .select("*")
      .single()

    if (error) {
      console.error(
        "Fehler beim Speichern der Bilder:",
        error
      )

      return {
        ok: false,
        error:
          error.message ||
          "Die Bilder konnten nicht gespeichert werden.",
      }
    }

    revalidatePath(
      "/besitzer"
    )

    revalidatePath("/")

    return {
      ok: true,
      booking:
        data as Booking,
    }
  } catch (error) {
    console.error(
      "saveBookingImages Fehler:",
      error
    )

    return {
      ok: false,
      error:
        "Ein unerwarteter Fehler ist aufgetreten.",
    }
  }
}

// ============================================================
// LIST BOOKINGS
// ============================================================

export async function listBookings() {
  try {
    const supabase =
      await createClient()

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
        }
      )
      .order(
        "booking_time",
        {
          ascending: true,
        }
      )

    if (error) {
      console.error(
        "Fehler beim Laden der Buchungen:",
        error
      )

      return []
    }

    return (data ??
      []) as Booking[]
  } catch (error) {
    console.error(
      "listBookings Fehler:",
      error
    )

    return []
  }
}

// ============================================================
// GET BOOKINGS
// ============================================================

export async function getBookings() {
  const bookings =
    await listBookings()

  return {
    ok: true,
    bookings,
  }
}

// ============================================================
// UPDATE BOOKING STATUS
// ============================================================

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
) {
  try {
    const supabase =
      await createClient()

    if (!bookingId) {
      return {
        ok: false,
        error:
          "Keine Buchungs-ID angegeben.",
      }
    }

    const allowedStatuses: BookingStatus[] =
      [
        "pending",
        "confirmed",
        "cancelled",
      ]

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return {
        ok: false,
        error:
          "Ungültiger Buchungsstatus.",
      }
    }

    const {
      data: booking,
      error,
    } = await supabase
      .from("bookings")
      .update({
        status,
      })
      .eq(
        "id",
        bookingId
      )
      .select("*")
      .single()

    if (error) {
      console.error(
        "Fehler beim Aktualisieren:",
        error
      )

      return {
        ok: false,
        error:
          error.message ||
          "Die Buchung konnte nicht aktualisiert werden.",
      }
    }

    revalidatePath(
      "/besitzer"
    )

    revalidatePath("/")

    return {
      ok: true,
      booking:
        booking as Booking,
    }
  } catch (error) {
    console.error(
      "updateBookingStatus Fehler:",
      error
    )

    return {
      ok: false,
      error:
        "Ein unerwarteter Fehler ist aufgetreten.",
    }
  }
}

// ============================================================
// DELETE BOOKING
// ============================================================

export async function deleteBooking(
  bookingId: string
) {
  try {
    const supabase =
      await createClient()

    if (!bookingId) {
      return {
        ok: false,
        error:
          "Keine Buchungs-ID angegeben.",
      }
    }

    const {
      error,
    } = await supabase
      .from("bookings")
      .delete()
      .eq(
        "id",
        bookingId
      )

    if (error) {
      console.error(
        "Fehler beim Löschen:",
        error
      )

      return {
        ok: false,
        error:
          error.message ||
          "Die Buchung konnte nicht gelöscht werden.",
      }
    }

    revalidatePath(
      "/besitzer"
    )

    revalidatePath("/")

    return {
      ok: true,
    }
  } catch (error) {
    console.error(
      "deleteBooking Fehler:",
      error
    )

    return {
      ok: false,
      error:
        "Ein unerwarteter Fehler ist aufgetreten.",
    }
  }
}

// ============================================================
// GET BOOKED SLOTS
// ============================================================

export async function getBookedSlots(
  date: string
) {
  try {
    const supabase =
      await createClient()

    if (!date) {
      return {
        ok: false,
        error:
          "Kein Datum angegeben.",
        slots: [],
      }
    }

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .select(
        "booking_time, status"
      )
      .eq(
        "booking_date",
        date
      )
      .in("status", [
        "pending",
        "confirmed",
      ])

    if (error) {
      console.error(
        "Fehler beim Laden der Zeiten:",
        error
      )

      return {
        ok: false,
        error:
          error.message ||
          "Die belegten Zeiten konnten nicht geladen werden.",
        slots: [],
      }
    }

    const slots =
      (data ?? [])
        .map(
          (booking) =>
            booking.booking_time
        )
        .filter(Boolean)

    return {
      ok: true,
      slots,
    }
  } catch (error) {
    console.error(
      "getBookedSlots Fehler:",
      error
    )

    return {
      ok: false,
      error:
        "Ein unerwarteter Fehler ist aufgetreten.",
      slots: [],
    }
  }
}

// ============================================================
// SIGN OUT
// ============================================================

export async function signOut() {
  const supabase =
    await createClient()

  await supabase.auth.signOut()

  revalidatePath(
    "/",
    "layout"
  )

  redirect(
    "/besitzer/login"
  )
}
