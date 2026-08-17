import { NextResponse } from "next/server"
import {
  getBookingsForDate,
  getOpenBookings,
} from "@/lib/jarvis"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const date = searchParams.get("date")
    const open = searchParams.get("open")

    if (open === "true") {
      const bookings = await getOpenBookings()

      return NextResponse.json({
        success: true,
        bookings,
      })
    }

    if (!date) {
      return NextResponse.json(
        {
          error: "Datum fehlt.",
        },
        {
          status: 400,
        }
      )
    }

    const bookings = await getBookingsForDate(date)

    return NextResponse.json({
      success: true,
      bookings,
    })
  } catch (error) {
    console.error("JARVIS BOOKINGS ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Termine konnten nicht geladen werden.",
      },
      {
        status: 500,
      }
    )
  }
}
