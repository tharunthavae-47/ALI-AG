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
  phone: string
  email: string
  car: string
  problem: string
  status: BookingStatus
  created_at: string
  image_urls: string[] | null
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

  return hour >= OPEN_HOUR && hour <= CLOSE_HOUR
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string) {
  const cleaned = value.replace(/[\s()+\-./]/g, "")
  return /^\d{7,15}$/.test(cleaned)
}

// =====================================================
// BELEGTE TERMINE
// =====================================================

export async function getBookedSlots(): Promise<PublicSlot[]> {
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
  phone: string
  email: string
  car: string
  problem: string
}): Promise<{
  ok: boolean
  bookingId?: string
  error?: string
}> {
  const name = input.name?.trim() ?? ""
  const phone = input.phone?.trim() ?? ""
  const email = input.email?.trim() ?? ""
  const car = input.car?.trim() ?? ""
  const problem = input.problem?.trim() ?? ""

  // Datum
  if (!isValidDate(input.booking_date)) {
    return {
      ok: false,
      error: "Ungültiges Datum.",
    }
  }

  // Uhrzeit
  if (!isValidTime(input.booking_time)) {
    return {
      ok: false,
      error: "Ungültige Uhrzeit.",
    }
  }

  // Pflichtfelder
  if (
    !name ||
    !phone ||
    !email ||
    !car ||
    !problem
  ) {
    return {
      ok: false,
      error: "Bitte füllen Sie alle Felder aus.",
    }
  }

  // E-Mail prüfen
  if (!isValidEmail(email)) {
    return {
      ok: false,
      error: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    }
  }

  // Telefonnummer prüfen
  if (!isValidPhone(phone)) {
    return {
      ok: false,
      error: "Bitte geben Sie eine gültige Telefonnummer ein.",
    }
  }

  // Vergangenes Datum
  const today = new Date()
    .toISOString()
    .slice(0, 10)

  if (input.booking_date < today) {
    return {
      ok: false,
      error: "Bitte wählen Sie ein Datum in der Zukunft.",
    }
  }

  // Maximale Länge
  if (
    [name, phone, email, car, problem].some(
      (value) => value.length > 1000,
    )
  ) {
    return {
      ok: false,
      error: "Eingabe zu lang.",
    }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      booking_date: input.booking_date,
      booking_time: input.booking_time,
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
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Dieser Termin ist leider bereits vergeben.",
      }
    }

    console.log(
      "createBooking error:",
      error.message,
    )

    return {
      ok: false,
      error: "Anfrage konnte nicht gespeichert werden.",
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

  const supabase = createAdminClient()

  const { error } = await supabase
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
      error: "Die Bilder konnten nicht gespeichert werden.",
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

export async function listBookings(): Promise<Booking[]> {
  const auth = await createClient()

  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) {
    return []
  }

  const supabase = createAdminClient()

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .select("*")
    .order("booking_date", {
      ascending: true,
    })
    .order("booking_time", {
      ascending: true,
    })

  if (error) {
    console.log(
      "listBookings error:",
      error.message,
    )

    return []
  }

  return (data ?? []) as Booking[]
}

// =====================================================
// TERMIN BESTÄTIGEN / ABLEHNEN
// =====================================================
//
// KEINE E-MAIL
// KEINE SMS
//
// Nur Status ändern.
// =====================================================

export async function updateBookingStatus(
  id: string,
  status: Exclude<BookingStatus, "pending">,
): Promise<{
  ok: boolean
  error?: string
}> {
  const auth = await createClient()

  const {
    data: { user },
  } = await auth.auth.getUser()

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

  const supabase = createAdminClient()

  const { error } = await supabase
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
      error: "Aktualisierung fehlgeschlagen.",
    }
  }

  revalidatePath("/")
  revalidatePath("/besitzer")

  return {
    ok: true,
  }
}
