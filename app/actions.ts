"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}

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

  // Wichtig:
  // Supabase JSON/JSONB kann hier entweder ein Array
  // oder in alten Datensätzen eventuell einen String liefern.
  image_urls: string[]
}

const OPEN_HOUR = 8
const CLOSE_HOUR = 22

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function isValidTime(value: string) {
  const match = /^(\d{2}):00$/.exec(value)

  if (!match) return false

  const hour = Number(match[1])

  return hour >= OPEN_HOUR && hour <= CLOSE_HOUR
}

/**
 * Öffentliche Termine
 */
export async function getBookedSlots(): Promise<
  PublicSlot[]
> {
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

/**
 * Erstellt einen neuen Termin
 */
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
  const name = input.name?.trim()
  const contact = input.contact?.trim()
  const car = input.car?.trim()
  const problem = input.problem?.trim()

  if (!isValidDate(input.booking_date)) {
    return {
      ok: false,
      error: "Ungültiges Datum.",
    }
  }

  if (!isValidTime(input.booking_time)) {
    return {
      ok: false,
      error: "Ungültige Uhrzeit.",
    }
  }

  if (!name || !contact || !car || !problem) {
    return {
      ok: false,
      error: "Bitte füllen Sie alle Felder aus.",
    }
  }

  if (
    input.booking_date <
    new Date().toISOString().slice(0, 10)
  ) {
    return {
      ok: false,
      error:
        "Bitte wählen Sie ein Datum in der Zukunft.",
    }
  }

  if (
    [name, contact, car, problem].some(
      (v) => v.length > 1000,
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
      contact,
      car,
      problem,
      status: "pending",

      // Anfangs leer.
      // Die Bilder werden danach mit saveBookingImages()
      // eingetragen.
      image_urls: [],
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
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

/**
 * =========================================================
 * BILDER ZU EINEM TERMIN SPEICHERN
 * =========================================================
 *
 * Diese Funktion läuft auf dem Server.
 *
 * Dadurch verwenden wir createAdminClient()
 * und umgehen das Problem, dass der öffentliche
 * Kunde keine UPDATE-Berechtigung auf bookings hat.
 */
export async function saveBookingImages(
  bookingId: string,
  imagePaths: string[],
): Promise<{
  ok: boolean
  error?: string
}> {
  if (!bookingId) {
    return {
      ok: false,
      error: "Keine Buchungs-ID vorhanden.",
    }
  }

  if (!Array.isArray(imagePaths)) {
    return {
      ok: false,
      error: "Ungültige Bilddaten.",
    }
  }

  // Maximal 5 Bilder
  const cleanPaths = imagePaths
    .filter(
      (path): path is string =>
        typeof path === "string" &&
        path.trim().length > 0,
    )
    .map((path) => path.trim())
    .slice(0, 5)

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("bookings")
    .update({
      image_urls: cleanPaths,
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

  console.log(
    "Bilder erfolgreich gespeichert:",
    cleanPaths,
  )

  revalidatePath("/besitzer")
  revalidatePath("/")

  return {
    ok: true,
  }
}

/**
 * =========================================================
 * BESITZER: BUCHUNGEN LADEN
 * =========================================================
 */
export async function listBookings(): Promise<
  Booking[]
> {
  const auth = await createClient()

  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) {
    return []
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
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

/**
 * =========================================================
 * BESITZER: STATUS ÄNDERN
 * =========================================================
 */
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
