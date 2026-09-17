"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Nicht angemeldet.")
  const { data: owner } = await supabase.from("owner_access").select("user_id").eq("user_id", user.id).maybeSingle()
  if (!owner) throw new Error("Kein Besitzerzugriff.")
  return supabase
}

export async function updateVehicleDocuments(id: string, data: { typenschein?: string | null; insurance?: string | null; last_mfk?: string | null }) {
  try {
    const supabase = await requireOwner()
    const { data: vehicle, error } = await supabase.from("customer_vehicles").update({
      typenschein: data.typenschein?.trim() || null,
      insurance: data.insurance?.trim() || null,
      last_mfk: data.last_mfk || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/besitzer/kunden")
    return { ok: true, vehicle }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Fahrzeugdaten konnten nicht gespeichert werden." }
  }
}
