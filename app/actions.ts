"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

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

  email: string
  phone: string

  car: string
  problem: string

  status: BookingStatus
  created_at: string

  image_urls: string[] | string | null
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
  email: string
  phone: string

  car: string
  problem: string
}): Promise<{
  ok: boolean
  bookingId?: string
  error?: string
}> {
  const name =
    input.name?.trim() ?? ""

  const email =
    input.email?.trim() ?? ""

  const phone =
    input.phone?.trim() ?? ""

  const car =
    input.car?.trim() ?? ""

  const problem =
    input.problem?.trim() ?? ""

  // ===================================================
  // DATUM
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
  // UHRZEIT
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

  if (
    !name ||
    !email ||
    !phone ||
    !car ||
    !problem
  ) {
    return {
      ok: false,
      error:
        "Bitte füllen Sie alle Pflichtfelder aus.",
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
  // DATUM IN DER VERGANGENHEIT
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

  if (
    [name, email, phone, car, problem].some(
      (value) => value.length > 1000,
    )
  ) {
    return {
      ok: false,
      error: "Eingabe zu lang.",
    }
  }

  // ===================================================
  // SUPABASE
  // ===================================================

  const supabase =
    createAdminClient()

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

        email,

        phone,

        car,

        problem,

        status: "pending",

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
      error: "Buchungs-ID fehlt.",
    }
  }

  if (!Array.isArray(imageUrls)) {
    return {
      ok: false,
      error: "Ungültige Bilddaten.",
    }
  }

  const supabase =
    createAdminClient()

  const {
    error,
  } =
    await supabase
      .from("bookings")
      .update({
        image_urls: imageUrls,
      })
      .eq("id", bookingId)

  if (error) {
    console.log(
      "saveBookingImages error:",
      error.message,
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
// BUCHUNGEN FÜR BESITZER
// =====================================================

export async function listBookings(): Promise<
  Booking[]
> {
  const auth =
    await createClient()

  const {
    data: { user },
  } =
    await auth.auth.getUser()

  if (!user) {
    return []
  }

  const supabase =
    createAdminClient()

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

  if (
    status !== "confirmed" &&
    status !== "rejected"
  ) {
    return {
      ok: false,
      error: "Ungültiger Status.",
    }
  }

  const supabase =
    createAdminClient()

  const {
    error,
  } =
    await supabase
      .from("bookings")
      .update({
        status,
      })
      .eq("id", id)

  if (error) {
    console.log(
      "updateBookingStatus error:",
      error.message,
    )

    return {
      ok: false,
      error:
        "Aktualisierung fehlgeschlagen.",
    }
  }

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}
