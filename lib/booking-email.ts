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

function layout(title: string, preheader: string, body: string) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f3f5;font-family:Arial,Helvetica,sans-serif;color:#171717"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f5"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="background:#111;padding:28px 32px;text-align:center"><div style="font-size:25px;font-weight:800;letter-spacing:1px;color:#fff">ALI-AG</div><div style="margin-top:6px;font-size:12px;letter-spacing:2px;color:#bdbdbd;text-transform:uppercase">Automobile &amp; Performance</div></td></tr><tr><td style="padding:36px 32px 30px"><h1 style="margin:0 0 22px;font-size:26px;line-height:1.25;color:#111">${title}</h1>${body}</td></tr><tr><td style="border-top:1px solid #eee;padding:24px 32px;text-align:center;color:#777;font-size:12px;line-height:1.6">ALI-AG<br>Vielen Dank für Ihr Vertrauen.</td></tr></table></td></tr></table></body></html>`
}

function details(data: BookingEmailData) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f7f7f7;border:1px solid #e7e7e7;border-radius:12px;overflow:hidden"><tr><td style="padding:14px 16px;border-bottom:1px solid #e7e7e7;font-size:14px"><strong>Datum</strong><br>${escapeHtml(data.booking_date)}</td></tr><tr><td style="padding:14px 16px;border-bottom:1px solid #e7e7e7;font-size:14px"><strong>Uhrzeit</strong><br>${escapeHtml(data.booking_time)} Uhr</td></tr><tr><td style="padding:14px 16px;font-size:14px"><strong>Fahrzeug</strong><br>${escapeHtml(data.car)}</td></tr></table>`
}

function customerBody(data: BookingEmailData, type: BookingEmailType) {
  const name = escapeHtml(data.name)

  if (type === "new-customer") {
    return `<p style="font-size:16px;line-height:1.7;margin:0 0 12px">Guten Tag ${name},</p><p style="font-size:15px;line-height:1.7;margin:0">Ihre Terminanfrage ist erfolgreich bei uns eingegangen.</p>${details(data)}<div style="padding:15px 16px;background:#fff8e1;border-radius:10px;font-size:14px;line-height:1.6"><strong>⏳ Noch nicht bestätigt</strong><br>Der Termin wird zuerst von uns geprüft. Sie erhalten automatisch eine weitere E-Mail, sobald die Anfrage bestätigt oder abgelehnt wurde.</div>`
  }

  if (type === "confirmed") {
    return `<p style="font-size:16px;line-height:1.7;margin:0 0 12px">Guten Tag ${name},</p><div style="margin:18px 0;padding:16px;background:#ecfdf3;border:1px solid #b7ebc6;border-radius:10px;color:#176b3a;font-size:15px"><strong>✓ Ihr Termin wurde bestätigt.</strong></div><p style="font-size:15px;line-height:1.7;margin:0">Wir freuen uns, Sie bei ALI-AG begrüssen zu dürfen.</p>${details(data)}<p style="font-size:14px;line-height:1.7;color:#555;margin:0">Falls sich bei Ihnen etwas ändert, kontaktieren Sie uns bitte möglichst frühzeitig.</p>`
  }

  return `<p style="font-size:16px;line-height:1.7;margin:0 0 12px">Guten Tag ${name},</p><div style="margin:18px 0;padding:16px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;color:#9f1239;font-size:15px"><strong>Ihre Terminanfrage konnte leider nicht bestätigt werden.</strong></div>${details(data)}<p style="font-size:14px;line-height:1.7;color:#555;margin:0">Bei Fragen können Sie sich gerne direkt bei uns melden.</p>`
}

function ownerBody(data: BookingEmailData) {
  return `<p style="font-size:16px;line-height:1.7;margin:0 0 12px">Eine neue Terminanfrage ist eingegangen.</p>${details(data)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.7"><tr><td style="padding:6px 0"><strong>Name:</strong> ${escapeHtml(data.name)}</td></tr><tr><td style="padding:6px 0"><strong>E-Mail:</strong> ${escapeHtml(data.email)}</td></tr><tr><td style="padding:6px 0"><strong>Telefon:</strong> ${escapeHtml(data.phone)}</td></tr><tr><td style="padding:6px 0"><strong>Anliegen:</strong><br>${escapeHtml(data.problem).replaceAll("\n", "<br>")}</td></tr></table>`
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
    html = layout("Neue Terminanfrage", `Neue Buchungsanfrage von ${escapeHtml(data.name)}`, ownerBody(data))
  } else {
    to = data.email
    subject = type === "confirmed" ? "Ihr Termin bei ALI-AG wurde bestätigt" : type === "rejected" ? "Ihre Terminanfrage bei ALI-AG wurde abgelehnt" : "Ihre Terminanfrage bei ALI-AG ist eingegangen"
    html = layout(subject, subject, customerBody(data, type))
  }

  const result = await cfg.resend.emails.send({ from: cfg.from, to, subject, html })

  if (result.error) {
    console.error("Resend Fehler:", result.error)
    return { ok: false, error: result.error.message }
  }

  return { ok: true, id: result.data?.id }
}
