"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { sendBookingEmail } from "@/lib/booking-email"

export type BookingStatus = "pending" | "confirmed" | "rejected"

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
  customer_id?: string | null
}

export type BookedSlot = { id?: string; booking_date: string; booking_time: string; status: BookingStatus }
export type PublicSlot = { time: string; available: boolean }
export type CreateBookingData = { booking_date: string; booking_time: string; name: string; phone: string; email: string; car: string; problem: string; image_urls?: string[] }

// Verknüpft eine Buchung zuerst über den eingegebenen Namen mit einem bestehenden ERP-Kunden.
// E-Mail und Telefon dienen erst danach als Fallback, damit eine abweichende E-Mail-Adresse
// nicht dazu führt, dass der Auftrag unter einem anderen Kunden landet.
async function resolveCustomerId(supabase: Awaited<ReturnType<typeof createClient>>, name: string, phone: string, email: string) {
  const cleanName = name.trim().replace(/\s+/g, " ")
  const cleanEmail = email.trim().toLowerCase()
  const cleanPhone = phone.trim()
  const parts = cleanName.split(" ").filter(Boolean)
  const first_name = parts.shift() || cleanName
  const last_name = parts.join(" ") || "-"

  let customer: { id: string } | null = null

  // 1. Name hat Priorität: Sanusjan bleibt Sanusjan, auch wenn eine andere Mail
  //    (z. B. die eines anderen Kunden) im Terminformular eingetragen wurde.
  if (first_name && last_name !== "-") {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .ilike("first_name", first_name)
      .ilike("last_name", last_name)
      .maybeSingle()
    customer = data
  }

  // 2. E-Mail ist nur noch Fallback, falls über den Namen kein Kunde gefunden wurde.
  if (!customer && cleanEmail) {
    const { data } = await supabase.from("customers").select("id").eq("email", cleanEmail).maybeSingle()
    customer = data
  }

  // 3. Telefonnummer ist letzter Fallback.
  if (!customer && cleanPhone) {
    const { data } = await supabase.from("customers").select("id").eq("phone", cleanPhone).maybeSingle()
    customer = data
  }

  if (customer) return customer.id

  const { data, error } = await supabase.from("customers").insert({
    first_name,
    last_name,
    phone: cleanPhone,
    email: cleanEmail || null,
    active: true,
  }).select("id").single()

  if (error) {
    console.error("ERP-Kunde konnte nicht automatisch erstellt werden:", error)
    return null
  }

  return data.id
}

export async function createBooking(data: CreateBookingData) {
  try {
    const supabase = await createClient()
    if (!data) return { ok: false, error: "Keine Buchungsdaten erhalten." }

    const booking_date = String(data.booking_date ?? "").trim()
    const booking_time = String(data.booking_time ?? "").trim()
    const name = String(data.name ?? "").trim()
    const phone = String(data.phone ?? "").trim()
    const email = String(data.email ?? "").trim().toLowerCase()
    const car = String(data.car ?? "").trim()
    const problem = String(data.problem ?? "").trim()
    const image_urls = Array.isArray(data.image_urls) ? data.image_urls : []

    if (!booking_date || !booking_time || !name || !phone || !email || !car || !problem) return { ok: false, error: "Bitte fülle alle Pflichtfelder aus." }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return { ok: false, error: "Das Datum ist ungültig." }
    const selectedDate = new Date(`${booking_date}T00:00:00`)
    if (Number.isNaN(selectedDate.getTime())) return { ok: false, error: "Das Datum ist ungültig." }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (selectedDate < today) return { ok: false, error: "Ein Termin in der Vergangenheit ist nicht möglich." }
    if (!/^\d{2}:\d{2}$/.test(booking_time)) return { ok: false, error: "Die Uhrzeit ist ungültig." }
    const [hourString, minuteString] = booking_time.split(":")
    const hour = Number(hourString), minute = Number(minuteString)
    if (Number.isNaN(hour) || Number.isNaN(minute) || minute !== 0 || hour < 15 || hour > 22) return { ok: false, error: "Bitte wähle eine gültige Terminzeit zwischen 15:00 und 22:00 Uhr." }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return { ok: false, error: "Bitte gib eine gültige E-Mail-Adresse ein." }
    if (name.length > 200) return { ok: false, error: "Der Name ist zu lang." }
    if (phone.length > 50) return { ok: false, error: "Die Telefonnummer ist zu lang." }
    if (email.length > 320) return { ok: false, error: "Die E-Mail-Adresse ist zu lang." }
    if (car.length > 300) return { ok: false, error: "Die Fahrzeugangabe ist zu lang." }
    if (problem.length > 2000) return { ok: false, error: "Die Problembeschreibung ist zu lang." }

    const { data: existingBooking, error: existingError } = await supabase.from("bookings").select("id, status").eq("booking_date", booking_date).eq("booking_time", booking_time).in("status", ["pending", "confirmed"]).limit(1).maybeSingle()
    if (existingError) { console.error("Fehler beim Prüfen des Termins:", existingError); return { ok: false, error: "Der Termin konnte nicht geprüft werden." } }
    if (existingBooking) return { ok: false, error: "Dieser Termin ist bereits vergeben." }

    // Vor dem Auftrag den ERP-Kunden bestimmen bzw. automatisch anlegen.
    const customerId = await resolveCustomerId(supabase, name, phone, email)

    const { data: booking, error: insertError } = await supabase.from("bookings").insert({
      booking_date, booking_time, name, phone, email, car, problem,
      status: "pending", image_urls,
      customer_id: customerId,
    }).select("*").single()

    if (insertError) {
      console.error("Fehler beim Erstellen der Buchung:", insertError)
      if (insertError.code === "23505") return { ok: false, error: "Dieser Termin wurde gerade von jemand anderem gebucht." }
      return { ok: false, error: insertError.message || "Die Buchung konnte nicht erstellt werden." }
    }

    revalidatePath("/")
    revalidatePath("/besitzer")
    revalidatePath("/besitzer/kunden")

    const emailData = booking as Booking
    const emailResults = await Promise.allSettled([
      sendBookingEmail("new-customer", emailData),
      sendBookingEmail("new-owner", emailData),
    ])
    for (const result of emailResults) {
      if (result.status === "rejected") console.error("Booking-E-Mail konnte nicht gesendet werden:", result.reason)
      else if (!result.value.ok) console.error("Booking-E-Mail konnte nicht gesendet werden:", result.value.error)
    }

    return { ok: true, bookingId: booking.id, booking: booking as Booking }
  } catch (error) {
    console.error("createBooking Fehler:", error)
    return { ok: false, error: "Ein unerwarteter Fehler ist aufgetreten." }
  }
}

export async function saveBookingImages(bookingId: string, imageUrls: string[]) {
  try {
    const supabase = await createClient()
    if (!bookingId) return { ok: false, error: "Keine Buchungs-ID angegeben." }
    if (!Array.isArray(imageUrls)) return { ok: false, error: "Ungültige Bilddaten." }
    const cleanImageUrls = imageUrls.filter((url) => typeof url === "string" && url.trim().length > 0).map((url) => url.trim())
    const { data, error } = await supabase.from("bookings").update({ image_urls: cleanImageUrls }).eq("id", bookingId).select("*").single()
    if (error) return { ok: false, error: error.message || "Die Bilder konnten nicht gespeichert werden." }
    revalidatePath("/besitzer"); revalidatePath("/besitzer/kunden"); revalidatePath("/")
    return { ok: true, booking: data as Booking }
  } catch (error) { return { ok: false, error: "Ein unerwarteter Fehler ist aufgetreten." } }
}

export async function listBookings() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("bookings").select("*").order("booking_date", { ascending: true }).order("booking_time", { ascending: true })
    if (error) return []
    return (data ?? []) as Booking[]
  } catch { return [] }
}

export async function getBookings() { const bookings = await listBookings(); return { ok: true, bookings } }

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  try {
    const supabase = await createClient()
    if (!bookingId) return { ok: false, error: "Keine Buchungs-ID angegeben." }
    if (!(<[BookingStatus]>["pending", "confirmed", "rejected"]).includes(status)) return { ok: false, error: "Ungültiger Buchungsstatus." }
    const { data: booking, error } = await supabase.from("bookings").update({ status }).eq("id", bookingId).select("*").single()
    if (error) return { ok: false, error: error.message || "Die Buchung konnte nicht aktualisiert werden." }
    revalidatePath("/besitzer"); revalidatePath("/besitzer/kunden"); revalidatePath("/")
    if (status === "confirmed" || status === "rejected") {
      try { const emailResult = await sendBookingEmail(status, booking as Booking); if (!emailResult.ok) console.error("Status-E-Mail konnte nicht gesendet werden:", emailResult.error) }
      catch (emailError) { console.error("Status-E-Mail Fehler:", emailError) }
    }
    return { ok: true, booking: booking as Booking }
  } catch { return { ok: false, error: "Ein unerwarteter Fehler ist aufgetreten." } }
}

export async function deleteBooking(bookingId: string) {
  try {
    const supabase = await createClient()
    if (!bookingId) return { ok: false, error: "Keine Buchungs-ID angegeben." }
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId)
    if (error) return { ok: false, error: error.message || "Die Buchung konnte nicht gelöscht werden." }
    revalidatePath("/besitzer"); revalidatePath("/besitzer/kunden"); revalidatePath("/")
    return { ok: true }
  } catch { return { ok: false, error: "Ein unerwarteter Fehler ist aufgetreten." } }
}

export async function getBookedSlots(date?: string): Promise<BookedSlot[]> {
  try {
    const supabase = await createClient()
    let query = supabase.from("bookings").select("id, booking_date, booking_time, status").in("status", ["pending", "confirmed"])
    if (date) query = query.eq("booking_date", date)
    const { data, error } = await query.order("booking_date", { ascending: true }).order("booking_time", { ascending: true })
    if (error || !Array.isArray(data)) return []
    return data as BookedSlot[]
  } catch { return [] }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/besitzer/login")
}
