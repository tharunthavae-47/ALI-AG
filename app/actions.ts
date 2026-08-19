"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// =====================================================
// TYPES
// =====================================================

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
  image_urls?: string[] | null
}

export type CreateBookingData = {
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
}

export type PublicSlot = {
  booking_date: string
  booking_time: string
}

// =====================================================
// SIGN OUT
// =====================================================

export async function signOut() {
  try {
    const supabase = await createClient()

    const { error } =
      await supabase.auth.signOut()

    if (error) {
      console.error(
        "SIGN OUT ERROR:",
        error,
      )

      return {
        ok: false,
        error: error.message,
      }
    }

    revalidatePath("/")
    revalidatePath("/besitzer")

    return {
      ok: true,
    }
  } catch (error) {
    console.error(
      "SIGN OUT EXCEPTION:",
      error,
    )

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Abmelden fehlgeschlagen.",
    }
  }
}

// =====================================================
// CREATE BOOKING
// =====================================================
// Wird von JARVIS und deiner normalen Buchungsfunktion
// verwendet.
// =====================================================

export async function createBooking(
  data: CreateBookingData,
) {
  try {
    const supabase =
      await createClient()

    // -----------------------------------------------
    // Pflichtfelder prüfen
    // -----------------------------------------------

    if (
      !data.booking_date ||
      !data.booking_time ||
      !data.name ||
      !data.phone ||
      !data.email ||
      !data.car ||
      !data.problem
    ) {
      return {
        ok: false,
        error:
          "Es fehlen noch Angaben für den Termin.",
      }
    }

    // -----------------------------------------------
    // Datum prüfen
    // -----------------------------------------------

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        data.booking_date,
      )
    ) {
      return {
        ok: false,
        error:
          "Das Termin-Datum ist ungültig.",
      }
    }

    // -----------------------------------------------
    // Uhrzeit prüfen
    // -----------------------------------------------

    if (
      !/^\d{2}:\d{2}$/.test(
        data.booking_time,
      )
    ) {
      return {
        ok: false,
        error:
          "Die Termin-Uhrzeit ist ungültig.",
      }
    }

    // -----------------------------------------------
    // Öffnungszeiten prüfen
    // -----------------------------------------------

    const hour = Number(
      data.booking_time.slice(0, 2),
    )

    const minute = Number(
      data.booking_time.slice(3, 5),
    )

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute)
    ) {
      return {
        ok: false,
        error:
          "Die Termin-Uhrzeit ist ungültig.",
      }
    }

    if (
      hour < 15 ||
      hour > 22 ||
      minute !== 0
    ) {
      return {
        ok: false,
        error:
          "Termine sind zwischen 15:00 und 22:00 Uhr möglich.",
      }
    }

    // -----------------------------------------------
    // Prüfen, ob Termin bereits vergeben ist
    // -----------------------------------------------

    const {
      data: existingBooking,
      error: checkError,
    } = await supabase
      .from("bookings")
      .select("id")
      .eq(
        "booking_date",
        data.booking_date,
      )
      .eq(
        "booking_time",
        data.booking_time,
      )
      .in("status", [
        "pending",
        "confirmed",
      ])
      .limit(1)
      .maybeSingle()

    if (checkError) {
      console.error(
        "BOOKING CHECK ERROR:",
        checkError,
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

    // -----------------------------------------------
    // TERMIN ERSTELLEN
    // -----------------------------------------------

    const {
      data: booking,
      error,
    } = await supabase
      .from("bookings")
      .insert({
        booking_date:
          data.booking_date,

        booking_time:
          data.booking_time,

        name:
          data.name.trim(),

        phone:
          data.phone.trim(),

        email:
          data.email
            .trim()
            .toLowerCase(),

        car:
          data.car.trim(),

        problem:
          data.problem.trim(),

        status: "pending",
      })
      .select("*")
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

    // -----------------------------------------------
    // Seiten aktualisieren
    // -----------------------------------------------

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
      "CREATE BOOKING EXCEPTION:",
      error,
    )

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Der Termin konnte nicht erstellt werden.",
    }
  }
}

// =====================================================
// GET BOOKED SLOTS
// =====================================================
// Wird von JARVIS verwendet, damit belegte Zeiten
// nicht erneut gebucht werden.
// =====================================================

export async function getBookedSlots(): Promise<
  PublicSlot[]
> {
  try {
    const supabase =
      await createClient()

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .select(
        "booking_date, booking_time, status",
      )
      .in("status", [
        "pending",
        "confirmed",
      ])
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
        "GET BOOKED SLOTS ERROR:",
        error,
      )

      return []
    }

    return (
      data?.map(
        (booking) => ({
          booking_date:
            booking.booking_date,

          booking_time:
            booking.booking_time,
        }),
      ) || []
    )
  } catch (error) {
    console.error(
      "GET BOOKED SLOTS EXCEPTION:",
      error,
    )

    return []
  }
}

// =====================================================
// LIST BOOKINGS
// =====================================================
// Wird auf /besitzer verwendet.
// Nur angemeldete Benutzer dürfen Buchungen sehen.
// =====================================================

export async function listBookings(): Promise<{
  ok: boolean
  bookings: Booking[]
  error?: string
}> {
  try {
    const supabase =
      await createClient()

    // -----------------------------------------------
    // Benutzer prüfen
    // -----------------------------------------------

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return {
        ok: false,
        bookings: [],
        error:
          "Du bist nicht angemeldet.",
      }
    }

    // -----------------------------------------------
    // Buchungen laden
    // -----------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .select("*")
      .order(
        "booking_date",
        {
          ascending: false,
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
        error:
          error.message ||
          "Buchungen konnten nicht geladen werden.",
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
          : "Buchungen konnten nicht geladen werden.",
    }
  }
}

// =====================================================
// UPDATE BOOKING STATUS
// =====================================================
// Besitzer kann Termin bestätigen oder ablehnen.
// =====================================================

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
) {
  try {
    const supabase =
      await createClient()

    // -----------------------------------------------
    // Eingaben prüfen
    // -----------------------------------------------

    if (!bookingId) {
      return {
        ok: false,
        error:
          "Keine Buchungs-ID angegeben.",
      }
    }

    if (
      status !== "confirmed" &&
      status !== "rejected"
    ) {
      return {
        ok: false,
        error:
          "Ungültiger Buchungsstatus.",
      }
    }

    // -----------------------------------------------
    // Benutzer prüfen
    // -----------------------------------------------

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return {
        ok: false,
        error:
          "Du musst angemeldet sein.",
      }
    }

    // -----------------------------------------------
    // Buchung aktualisieren
    // -----------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .update({
        status,
      })
      .eq(
        "id",
        bookingId,
      )
      .select("*")
      .single()

    if (error) {
      console.error(
        "UPDATE BOOKING STATUS ERROR:",
        error,
      )

      return {
        ok: false,
        error:
          error.message ||
          "Der Status konnte nicht geändert werden.",
      }
    }

    revalidatePath("/")
    revalidatePath("/besitzer")

    return {
      ok: true,
      booking:
        data as Booking,
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
          : "Der Status konnte nicht geändert werden.",
    }
  }
}

// =====================================================
// SAVE BOOKING IMAGES
// =====================================================
// Speichert die URLs der Bilder in der bookings-Tabelle.
// =====================================================

export async function saveBookingImages(
  bookingId: string,
  imageUrls: string[],
) {
  try {
    const supabase =
      await createClient()

    // -----------------------------------------------
    // Benutzer prüfen
    // -----------------------------------------------

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return {
        ok: false,
        error:
          "Du musst angemeldet sein.",
      }
    }

    // -----------------------------------------------
    // Daten prüfen
    // -----------------------------------------------

    if (!bookingId) {
      return {
        ok: false,
        error:
          "Keine Buchungs-ID angegeben.",
      }
    }

    if (
      !Array.isArray(imageUrls)
    ) {
      return {
        ok: false,
        error:
          "Ungültige Bilddaten.",
      }
    }

    // -----------------------------------------------
    // Nur gültige Strings speichern
    // -----------------------------------------------

    const cleanImageUrls =
      imageUrls.filter(
        (url) =>
          typeof url === "string" &&
          url.trim().length > 0,
      )

    // -----------------------------------------------
    // Bilder speichern
    // -----------------------------------------------

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
        bookingId,
      )
      .select("*")
      .single()

    if (error) {
      console.error(
        "SAVE BOOKING IMAGES ERROR:",
        error,
      )

      return {
        ok: false,
        error:
          error.message ||
          "Die Bilder konnten nicht gespeichert werden.",
      }
    }

    revalidatePath("/")
    revalidatePath("/besitzer")

    return {
      ok: true,
      booking:
        data as Booking,
    }
  } catch (error) {
    console.error(
      "SAVE BOOKING IMAGES EXCEPTION:",
      error,
    )

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Die Bilder konnten nicht gespeichert werden.",
    }
  }
}
