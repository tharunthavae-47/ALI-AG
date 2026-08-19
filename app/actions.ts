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

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("SIGN OUT ERROR:", error)

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
  const supabase = await createClient()

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
  // Prüfen, ob Termin bereits vergeben ist
  // -----------------------------------------------

  const { data: existingBooking, error: checkError } =
    await supabase
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

  // =====================================================
  // TERMIN IN SUPABASE ERSTELLEN
  // =====================================================

  console.log("========================================")
  console.log("JARVIS → SUPABASE: TERMIN WIRD ERSTELLT")
  console.log("========================================")

  console.log("Datum:", data.booking_date)
  console.log("Uhrzeit:", data.booking_time)
  console.log("Name:", data.name)
  console.log("Telefon:", data.phone)
  console.log("E-Mail:", data.email)
  console.log("Fahrzeug:", data.car)
  console.log("Anliegen:", data.problem)

  const { data: booking, error } =
    await supabase
      .from("bookings")
      .insert({
        booking_date: data.booking_date,
        booking_time: data.booking_time,
        name: data.name,
        phone: data.phone,
        email: data.email,
        car: data.car,
        problem: data.problem,
        status: "pending",
      })
      .select()
      .single()

  // =====================================================
  // SUPABASE FEHLER
  // =====================================================

  if (error) {
    console.error("========================================")
    console.error("CREATE BOOKING ERROR")
    console.error("========================================")
    console.error("Message:", error.message)
    console.error("Code:", error.code)
    console.error("Details:", error.details)
    console.error("Hint:", error.hint)
    console.error("========================================")

    return {
      ok: false,
      error:
        error.message ||
        "Der Termin konnte nicht erstellt werden.",
    }
  }

  // =====================================================
  // ERFOLGREICH
  // =====================================================

  console.log("========================================")
  console.log("TERMIN ERFOLGREICH ERSTELLT")
  console.log("Booking ID:", booking.id)
  console.log("========================================")

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
    bookingId: booking.id,
    booking,
  }

// =====================================================
// GET BOOKED SLOTS
// =====================================================

export async function getBookedSlots(): Promise<
  PublicSlot[]
> {
  const supabase = await createClient()

  const { data, error } =
    await supabase
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
    data?.map((booking) => ({
      booking_date:
        booking.booking_date,

      booking_time:
        booking.booking_time,
    })) || []
  )
}

// =====================================================
// LIST BOOKINGS
// =====================================================

export async function listBookings(): Promise<{
  ok: boolean
  bookings: Booking[]
  error?: string
}> {
  const supabase = await createClient()

  // -----------------------------------------------
  // Benutzer prüfen
  // -----------------------------------------------

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
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

  const { data, error } =
    await supabase
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
      error: error.message,
    }
  }

  return {
    ok: true,
    bookings:
      (data as Booking[]) || [],
  }
}

// =====================================================
// UPDATE BOOKING STATUS
// =====================================================

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
) {
  const supabase = await createClient()

  // -----------------------------------------------
  // Status prüfen
  // -----------------------------------------------

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
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false,
      error:
        "Du musst angemeldet sein.",
    }
  }

  // -----------------------------------------------
  // Buchung aktualisieren
  // -----------------------------------------------

  const { data, error } =
    await supabase
      .from("bookings")
      .update({
        status,
      })
      .eq("id", bookingId)
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
    booking: data as Booking,
  }
}

// =====================================================
// SAVE BOOKING IMAGES
// =====================================================

export async function saveBookingImages(
  bookingId: string,
  imageUrls: string[],
) {
  const supabase = await createClient()

  // -----------------------------------------------
  // Benutzer prüfen
  // -----------------------------------------------

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false,
      error:
        "Du musst angemeldet sein.",
    }
  }

  // -----------------------------------------------
  // URLs prüfen
  // -----------------------------------------------

  if (!Array.isArray(imageUrls)) {
    return {
      ok: false,
      error:
        "Ungültige Bilddaten.",
    }
  }

  // -----------------------------------------------
  // Bilder speichern
  // -----------------------------------------------

  const { data, error } =
    await supabase
      .from("bookings")
      .update({
        image_urls: imageUrls,
      })
      .eq("id", bookingId)
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
    booking: data as Booking,
  }
}
