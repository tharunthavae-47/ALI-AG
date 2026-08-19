import { createAdminClient } from "@/lib/supabase/admin"

export async function getBookingsForDate(
  date: string
) {
  const supabase = createAdminClient()

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_date,
      booking_time,
      name,
      car,
      problem,
      status,
      phone,
      email
    `)
    .eq(
      "booking_date",
      date
    )
    .order(
      "booking_time",
      {
        ascending: true,
      }
    )

  if (error) {
    console.error(
      "Supabase error:",
      error
    )

    throw new Error(
      error.message
    )
  }

  return data ?? []
}

export async function getOpenBookings() {
  const supabase = createAdminClient()

  const {
    data,
    error,
  } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_date,
      booking_time,
      name,
      car,
      problem,
      status,
      phone,
      email
    `)
    .eq(
      "status",
      "pending"
    )
    .order(
      "booking_date",
      {
        ascending: true,
      }
    )
    .order(
      "booking_time",
      {
        ascending: true,
      }
    )

  if (error) {
    console.error(
      "Supabase error:",
      error
    )

    throw new Error(
      error.message
    )
  }

  return data ?? []
}
