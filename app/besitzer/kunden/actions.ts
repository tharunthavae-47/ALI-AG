"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type Customer = {
  id: string
  first_name: string
  last_name: string
  company: string | null
  phone: string
  email: string | null
  street: string | null
  zip: string | null
  city: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CustomerVehicle = {
  id: string
  customer_id: string
  make: string
  model: string
  license_plate: string
  model_year: number | null
  mileage: number | null
  vin: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CustomerJob = {
  id: string
  booking_date: string
  booking_time: string
  car: string
  problem: string
  status: string
}

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Nicht angemeldet.")

  const { data: owner } = await supabase
    .from("owner_access")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!owner) throw new Error("Kein Besitzerzugriff.")
  return supabase
}

export async function createCustomer(data: Omit<Customer, "id" | "active" | "created_at" | "updated_at">) {
  try {
    const supabase = await requireOwner()
    const first_name = String(data.first_name ?? "").trim()
    const last_name = String(data.last_name ?? "").trim()
    const phone = String(data.phone ?? "").trim()
    if (!first_name || !last_name || !phone) return { ok: false, error: "Vorname, Nachname und Telefon sind Pflichtfelder." }

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        first_name,
        last_name,
        company: data.company?.trim() || null,
        phone,
        email: data.email?.trim().toLowerCase() || null,
        street: data.street?.trim() || null,
        zip: data.zip?.trim() || null,
        city: data.city?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select("*")
      .single()

    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true, customer: customer as Customer }
  } catch (error) {
    console.error("createCustomer:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Kunde konnte nicht gespeichert werden." }
  }
}

export async function updateCustomer(id: string, data: Partial<Omit<Customer, "id" | "active" | "created_at" | "updated_at">>) {
  try {
    const supabase = await requireOwner()
    if (!id) return { ok: false, error: "Kunden-ID fehlt." }
    const { data: customer, error } = await supabase
      .from("customers")
      .update({
        ...(data.first_name !== undefined ? { first_name: data.first_name.trim() } : {}),
        ...(data.last_name !== undefined ? { last_name: data.last_name.trim() } : {}),
        ...(data.company !== undefined ? { company: data.company?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim().toLowerCase() || null } : {}),
        ...(data.street !== undefined ? { street: data.street?.trim() || null } : {}),
        ...(data.zip !== undefined ? { zip: data.zip?.trim() || null } : {}),
        ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true, customer: customer as Customer }
  } catch (error) {
    console.error("updateCustomer:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Kunde konnte nicht aktualisiert werden." }
  }
}

export async function deleteCustomer(id: string) {
  try {
    const supabase = await requireOwner()
    if (!id) return { ok: false, error: "Kunden-ID fehlt." }

    // Historische Aufträge bleiben erhalten, werden aber vom gelöschten Kunden entkoppelt.
    const { error: bookingError } = await supabase
      .from("bookings")
      .update({ customer_id: null })
      .eq("customer_id", id)
    if (bookingError) return { ok: false, error: bookingError.message }

    const { error: vehicleError } = await supabase
      .from("customer_vehicles")
      .delete()
      .eq("customer_id", id)
    if (vehicleError) return { ok: false, error: vehicleError.message }

    const { error: customerError } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
    if (customerError) return { ok: false, error: customerError.message }

    revalidatePath("/besitzer/kunden")
    return { ok: true }
  } catch (error) {
    console.error("deleteCustomer:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Kunde konnte nicht gelöscht werden." }
  }
}

export async function createCustomerVehicle(data: Omit<CustomerVehicle, "id" | "created_at" | "updated_at">) {
  try {
    const supabase = await requireOwner()
    if (!data.customer_id || !data.make?.trim() || !data.model?.trim() || !data.license_plate?.trim()) {
      return { ok: false, error: "Kunde, Marke, Modell und Kennzeichen sind Pflichtfelder." }
    }
    const { data: vehicle, error } = await supabase
      .from("customer_vehicles")
      .insert({
        customer_id: data.customer_id,
        make: data.make.trim(),
        model: data.model.trim(),
        license_plate: data.license_plate.trim().toUpperCase(),
        model_year: data.model_year || null,
        mileage: data.mileage || null,
        vin: data.vin?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select("*")
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true, vehicle: vehicle as CustomerVehicle }
  } catch (error) {
    console.error("createCustomerVehicle:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Fahrzeug konnte nicht gespeichert werden." }
  }
}

export async function updateCustomerVehicle(id: string, data: Partial<Omit<CustomerVehicle, "id" | "customer_id" | "created_at" | "updated_at">>) {
  try {
    const supabase = await requireOwner()
    const { data: vehicle, error } = await supabase
      .from("customer_vehicles")
      .update({
        ...(data.make !== undefined ? { make: data.make.trim() } : {}),
        ...(data.model !== undefined ? { model: data.model.trim() } : {}),
        ...(data.license_plate !== undefined ? { license_plate: data.license_plate.trim().toUpperCase() } : {}),
        ...(data.model_year !== undefined ? { model_year: data.model_year || null } : {}),
        ...(data.mileage !== undefined ? { mileage: data.mileage || null } : {}),
        ...(data.vin !== undefined ? { vin: data.vin?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true, vehicle: vehicle as CustomerVehicle }
  } catch (error) {
    console.error("updateCustomerVehicle:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Fahrzeug konnte nicht aktualisiert werden." }
  }
}

export async function deleteCustomerVehicle(id: string) {
  try {
    const supabase = await requireOwner()
    if (!id) return { ok: false, error: "Fahrzeug-ID fehlt." }
    const { error } = await supabase.from("customer_vehicles").delete().eq("id", id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true }
  } catch (error) {
    console.error("deleteCustomerVehicle:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Fahrzeug konnte nicht gelöscht werden." }
  }
}

export async function getCustomerDetail(id: string) {
  try {
    const supabase = await requireOwner()
    const [{ data: customer, error: customerError }, { data: vehicles, error: vehiclesError }, { data: jobs, error: jobsError }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("customer_vehicles").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("bookings").select("id, booking_date, booking_time, car, problem, status").eq("customer_id", id).order("booking_date", { ascending: false }).limit(20),
    ])
    if (customerError) return { ok: false, error: customerError.message }
    if (vehiclesError) return { ok: false, error: vehiclesError.message }
    if (jobsError) return { ok: false, error: jobsError.message }
    return { ok: true, customer: customer as Customer, vehicles: (vehicles ?? []) as CustomerVehicle[], jobs: (jobs ?? []) as CustomerJob[] }
  } catch (error) {
    console.error("getCustomerDetail:", error)
    return { ok: false, error: error instanceof Error ? error.message : "Kundendaten konnten nicht geladen werden." }
  }
}
