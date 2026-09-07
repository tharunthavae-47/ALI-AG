import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL
const OWNER = process.env.BOOKING_OWNER_EMAIL

type BookingEmailPayload = {
  type: "new" | "confirmed" | "rejected"
  name: string
  email: string
  phone: string
  booking_date: string
  booking_time: string
  car: string
  problem: string
}

function subject(type: BookingEmailPayload["type"]) {
  if (type === "confirmed") return "Ihr Termin bei ALI-AG wurde bestätigt"
  if (type === "rejected") return "Ihre Terminanfrage bei ALI-AG wurde abgelehnt"
  return "Neue Terminanfrage bei ALI-AG"
}

function customerHtml(data: BookingEmailPayload) {
  const intro = data.type === "confirmed"
    ? "Ihr Termin wurde vom Besitzer bestätigt."
    : "Ihre Terminanfrage wurde vom Besitzer leider abgelehnt."

  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2>ALI-AG</h2>
    <p>Guten Tag ${data.name}</p>
    <p>${intro}</p>
    <p><strong>Datum:</strong> ${data.booking_date}<br><strong>Uhrzeit:</strong> ${data.booking_time}<br><strong>Fahrzeug:</strong> ${data.car}</p>
    <p>Bei Fragen können Sie sich gerne bei uns melden.</p>
    <p>Freundliche Grüsse<br>ALI-AG</p>
  </div>`
}

function ownerHtml(data: BookingEmailPayload) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2>Neue Terminanfrage – ALI-AG</h2>
    <p><strong>Name:</strong> ${data.name}<br><strong>E-Mail:</strong> ${data.email}<br><strong>Telefon:</strong> ${data.phone}</p>
    <p><strong>Datum:</strong> ${data.booking_date}<br><strong>Uhrzeit:</strong> ${data.booking_time}<br><strong>Fahrzeug:</strong> ${data.car}</p>
    <p><strong>Anliegen:</strong><br>${data.problem}</p>
  </div>`
}

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY || !FROM) {
      return NextResponse.json({ ok: false, error: "Resend ist nicht konfiguriert." }, { status: 500 })
    }

    const data = (await request.json()) as BookingEmailPayload

    if (!data.name || !data.email || !data.booking_date || !data.booking_time) {
      return NextResponse.json({ ok: false, error: "Unvollständige Buchungsdaten." }, { status: 400 })
    }

    if (data.type === "new") {
      if (!OWNER) return NextResponse.json({ ok: false, error: "BOOKING_OWNER_EMAIL fehlt." }, { status: 500 })
      await resend.emails.send({ from: FROM, to: OWNER, subject: subject(data.type), html: ownerHtml(data) })
    } else {
      await resend.emails.send({ from: FROM, to: data.email, subject: subject(data.type), html: customerHtml(data) })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Booking email error:", error)
    return NextResponse.json({ ok: false, error: "E-Mail konnte nicht gesendet werden." }, { status: 500 })
  }
}
