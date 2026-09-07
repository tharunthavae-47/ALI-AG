import { Resend } from "resend"

export type BookingEmailData = {
  id: string
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
}

type BookingEmailType = "new-customer" | "new-owner" | "confirmed" | "rejected"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function config() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) return null

  return { resend: new Resend(apiKey), from }
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827"><div style="max-width:620px;margin:32px auto;background:#fff;border-radius:14px;padding:32px;box-sizing:border-box"><h1 style="margin:0 0 24px;font-size:24px">ALI-AG</h1><h2 style="margin:0 0 18px;font-size:20px">${title}</h2>${body}<p style="margin-top:28px">Freundliche Grüsse<br><strong>ALI-AG</strong></p></div></body></html>`
}

function details(data: BookingEmailData) {
  return `<div style="background:#f8fafc;border-radius:10px;padding:18px;line-height:1.8"><strong>Datum:</strong> ${escapeHtml(data.booking_date)}<br><strong>Uhrzeit:</strong> ${escapeHtml(data.booking_time)}<br><strong>Fahrzeug:</strong> ${escapeHtml(data.car)}</div>`
}

function customerBody(data: BookingEmailData, type: BookingEmailType) {
  const name = escapeHtml(data.name)

  if (type === "new-customer") {
    return `<p>Guten Tag ${name}</p><p>Ihre Terminanfrage bei ALI-AG ist erfolgreich eingegangen.</p>${details(data)}<p>Der Termin ist noch nicht bestätigt. Sie erhalten eine weitere E-Mail, sobald der Besitzer die Anfrage bestätigt oder ablehnt.</p>`
  }

  if (type === "confirmed") {
    return `<p>Guten Tag ${name}</p><p><strong>Ihr Termin bei ALI-AG wurde bestätigt.</strong></p>${details(data)}<p>Wir freuen uns auf Ihren Besuch.</p>`
  }

  return `<p>Guten Tag ${name}</p><p><strong>Ihre Terminanfrage bei ALI-AG wurde leider abgelehnt.</strong></p>${details(data)}<p>Bei Fragen können Sie sich gerne bei uns melden.</p>`
}

function ownerBody(data: BookingEmailData) {
  return `<p>Es ist eine neue Terminanfrage eingegangen.</p>${details(data)}<div style="margin-top:18px;line-height:1.8"><strong>Name:</strong> ${escapeHtml(data.name)}<br><strong>E-Mail:</strong> ${escapeHtml(data.email)}<br><strong>Telefon:</strong> ${escapeHtml(data.phone)}<br><strong>Anliegen:</strong><br>${escapeHtml(data.problem)}</div>`
}

export async function sendBookingEmail(type: BookingEmailType, data: BookingEmailData) {
  const cfg = config()

  if (!cfg) {
    console.error("Resend ist nicht konfiguriert: RESEND_API_KEY oder RESEND_FROM_EMAIL fehlt.")
    return { ok: false, error: "Resend ist nicht konfiguriert." }
  }

  const owner = process.env.BOOKING_OWNER_EMAIL

  let to: string
  let subject: string
  let html: string

  if (type === "new-owner") {
    if (!owner) {
      console.error("BOOKING_OWNER_EMAIL fehlt.")
      return { ok: false, error: "BOOKING_OWNER_EMAIL fehlt." }
    }
    to = owner
    subject = "Neue Terminanfrage bei ALI-AG"
    html = layout("Neue Terminanfrage", ownerBody(data))
  } else {
    to = data.email
    subject = type === "confirmed"
      ? "Ihr Termin bei ALI-AG wurde bestätigt"
      : type === "rejected"
        ? "Ihre Terminanfrage bei ALI-AG wurde abgelehnt"
        : "Ihre Terminanfrage bei ALI-AG ist eingegangen"
    html = layout(subject, customerBody(data, type))
  }

  const result = await cfg.resend.emails.send({
    from: cfg.from,
    to,
    subject,
    html,
  })

  if (result.error) {
    console.error("Resend Fehler:", result.error)
    return { ok: false, error: result.error.message }
  }

  return { ok: true, id: result.data?.id }
}
