import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { CustomerErp } from "@/components/customer-erp"
import type { Customer, CustomerJob, CustomerVehicle } from "./actions"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/besitzer/login")

  const { data: owner } = await supabase.from("owner_access").select("user_id").eq("user_id", user.id).maybeSingle()
  if (!owner) redirect("/besitzer/login")

  const [{ data: customers }, { data: vehicles }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("*").order("last_name", { ascending: true }).order("first_name", { ascending: true }),
    supabase.from("customer_vehicles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, booking_date, booking_time, car, problem, status, customer_id")
      .not("customer_id", "is", null)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false })
      .limit(500),
  ])

  const customerList = (customers ?? []) as Customer[]
  const customerNameById = new Map(
    customerList.map((customer) => [
      customer.id,
      `${customer.last_name} ${customer.first_name}`.trim().toLocaleLowerCase("de-CH"),
    ])
  )

  const sortedJobs = ((jobs ?? []) as CustomerJob[]).sort((a, b) => {
    const customerCompare = (customerNameById.get(a.customer_id ?? "") ?? "").localeCompare(
      customerNameById.get(b.customer_id ?? "") ?? "",
      "de-CH"
    )

    if (customerCompare !== 0) return customerCompare

    const dateCompare = String(b.booking_date ?? "").localeCompare(String(a.booking_date ?? ""))
    if (dateCompare !== 0) return dateCompare

    return String(b.booking_time ?? "").localeCompare(String(a.booking_time ?? ""))
  })

  return (
    <main className="min-h-screen bg-[#071321]">
      <div className="border-b border-slate-800 bg-[#081625]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/besitzer" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-sky-300">
            <ArrowLeft className="h-4 w-4" /> Zurück zum Besitzerbereich
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">MB Performance · ERP</span>
        </div>
      </div>
      <CustomerErp
        initialCustomers={customerList}
        initialVehicles={(vehicles ?? []) as CustomerVehicle[]}
        initialJobs={sortedJobs}
      />
    </main>
  )
}
