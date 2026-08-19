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
}

// =====================================================
// CREATE BOOKING
// =====================================================

export async function createBooking(
  data: CreateBookingData,
) {
  try {
    const supabase =
      await createClient()

    // -------------------------------------------------
    // DATEN PRÜFEN
    // -------------------------------------------------

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

    // -------------------------------------------------
    // TERMINZEIT PRÜFEN
    // -------------------------------------------------

    const timeMatch =
      /^(\d{2}):(\d{2})$/.exec(
        data.booking_time,
      )

    if (!timeMatch) {
      return {
        ok: false,
        error:
          "Die Uhrzeit hat ein ungültiges Format.",
      }
    }

    const hour = Number(
      timeMatch[1],
    )

    const minute = Number(
      timeMatch[2],
    )

    if (
      hour < 15 ||
      hour > 22 ||
      minute !== 0
    ) {
      return {
        ok: false,
        error:
          "Termine sind nur zwischen 15:00 und 22:00 Uhr möglich.",
      }
    }

    // -------------------------------------------------
    // PRÜFEN OB TERMIN BEREITS EXISTIERT
    // -------------------------------------------------

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

    // -------------------------------------------------
    // TERMIN ERSTELLEN
    // -------------------------------------------------

    console.log(
      "========================================",
    )

    console.log(
      "JARVIS → SUPABASE: TERMIN WIRD ERSTELLT",
    )

    console.log(
      "Datum:",
      data.booking_date,
    )

    console.log(
      "Uhrzeit:",
      data.booking_time,
    )

    console.log(
      "Name:",
      data.name,
    )

    console.log(
      "Telefon:",
      data.phone,
    )

    console.log(
      "E-Mail:",
      data.email,
    )

    console.log(
      "Fahrzeug:",
      data.car,
    )

    console.log(
      "Anliegen:",
      data.problem,
    )

    console.log(
      "========================================",
    )

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
          data.name,

        phone:
          data.phone,

        email:
          data.email,

        car:
          data.car,

        problem:
          data.problem,

        status:
          "pending",
      })
      .select()
      .single()

    // -------------------------------------------------
    // INSERT FEHLER
    // -------------------------------------------------

    if (error) {
      console.error(
        "========================================",
      )

      console.error(
        "CREATE BOOKING ERROR",
      )

      console.error(
        "Message:",
        error.message,
      )

      console.error(
        "Code:",
        error.code,
      )

      console.error(
        "Details:",
        error.details,
      )

      console.error(
        "Hint:",
        error.hint,
      )

      console.error(
        "========================================",
      )

      return {
        ok: false,
        error:
          error.message ||
          "Der Termin konnte nicht erstellt werden.",
      }
    }

    // -------------------------------------------------
    // ERFOLGREICH
    // -------------------------------------------------

    console.log(
      "========================================",
    )

    console.log(
      "TERMIN ERFOLGREICH ERSTELLT",
    )

    console.log(
      "Booking ID:",
      booking.id,
    )

    console.log(
      "========================================",
    )

    revalidatePath("/")
    revalidatePath("/besitzer")

    return {
      ok: true,
      bookingId:
        booking.id,
      booking,
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

// =====================================================
// GET BOOKED SLOTS
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

export async function listBookings(): Promise<{
  ok: boolean
  bookings: Booking[]
  error?: string
}> {
  try {
    const supabase =
      await createClient()

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

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
          error.message,
      }
    }

    return {
      ok: true,
      bookings:
        (data as Booking[]) ||
        [],
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

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
) {
  try {
    const supabase =
      await createClient()

    // -------------------------------------------------
    // STATUS PRÜFEN
    // -------------------------------------------------

    if (
      status !==
        "confirmed" &&
      status !==
        "rejected"
    ) {
      return {
        ok: false,
        error:
          "Ungültiger Buchungsstatus.",
      }
    }

    // -------------------------------------------------
    // BENUTZER PRÜFEN
    // -------------------------------------------------

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

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

    // -------------------------------------------------
    // STATUS ÄNDERN
    // -------------------------------------------------

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
      .select()
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

export async function saveBookingImages(
  bookingId: string,
  imageUrls: string[],
) {
  try {
    const supabase =
      await createClient()

    // -------------------------------------------------
    // BENUTZER PRÜFEN
    // -------------------------------------------------

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

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

    // -------------------------------------------------
    // BILDDATEN PRÜFEN
    // -------------------------------------------------

    if (
      !Array.isArray(
        imageUrls,
      )
    ) {
      return {
        ok: false,
        error:
          "Ungültige Bilddaten.",
      }
    }

    // -------------------------------------------------
    // BILDER SPEICHERN
    // -------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .update({
        image_urls:
          imageUrls,
      })
      .eq(
        "id",
        bookingId,
      )
      .select()
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
