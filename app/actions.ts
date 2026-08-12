"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}

export type BookingStatus = "pending" | "confirmed" | "rejected"

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

const OPEN_HOUR = 8
const CLOSE_HOUR = 22

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function isValidTime(value: string) {
  const match = /^(\d{2}):00$/.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  return hour >= OPEN_HOUR && hour <= CLOSE_HOUR
}

/**
 * Returns only the date + time of active bookings (no customer PII) so the
 * public calendar can grey out taken slots. Runs with the service role because
 * the table is fully RLS-locked.
 */
export async function getBookedSlots(): Promise<PublicSlot[]> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("bookings")
    .select("booking_date, booking_time")
    .neq("status", "rejected")
    .gte("booking_date", today)

  if (error) {
    console.log("[v0] getBookedSlots error:", error.message)
    return []
  }
  return data ?? []
}

export async function createBooking(input: {
  booking_date: string
  booking_time: string
  name: string
  contact: string
  car: string
  problem: string
}): Promise<{ ok: boolean; bookingId?: string; error?: string }> {
  const name = input.name?.trim()
  const contact = input.contact?.trim()
  const car = input.car?.trim()
  const problem = input.problem?.trim()

  if (!isValidDate(input.booking_date)) {
    return { ok: false, error: "Ungültiges Datum." }
  }

  if (!isValidTime(input.booking_time)) {
    return { ok: false, error: "Ungültige Uhrzeit." }
  }

  if (!name || !contact || !car || !problem) {
    return {
      ok: false,
      error: "Bitte füllen Sie alle Felder aus.",
    }
  }

  if (input.booking_date < new Date().toISOString().slice(0, 10)) {
    return {
      ok: false,
      error: "Bitte wählen Sie ein Datum in der Zukunft.",
    }
  }

  if ([name, contact, car, problem].some((v) => v.length > 1000)) {
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
      contact,
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

    console.log("[v0] createBooking error:", error.message)

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
/** Owner-only: full list including PII. Requires an authenticated session. */
export async function listBookings(): Promise<Booking[]> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true })

  if (error) {
    console.log("[v0] listBookings error:", error.message)
    return []
  }
  return (data ?? []) as Booking[]
}

/** Owner-only: confirm or reject a request. Requires an authenticated session. */
export async function updateBookingStatus(
  id: string,
  status: Exclude<BookingStatus, "pending">,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return { ok: false, error: "Nicht autorisiert." }

  if (status !== "confirmed" && status !== "rejected") {
    return { ok: false, error: "Ungültiger Status." }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id)

  if (error) {
    console.log("[v0] updateBookingStatus error:", error.message)
    return { ok: false, error: "Aktualisierung fehlgeschlagen." }
  }

 revalidatePath("/")
revalidatePath("/besitzer")

return {
  ok: true,
  bookingId: data.id,
}
