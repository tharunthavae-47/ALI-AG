import { NextResponse } from "next/server"
import bwipjs from "bwip-js"

export const runtime = "nodejs"

const env = (name: string) => process.env[name]?.trim() || ""

const normalizeIban = (value: string) =>
  value
    .trim()
    .replace(/^IBAN\s*:\s*/i, "")
    .replace(/["'“”„]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase()

function getIbanDiagnostic(value: string) {
  const normalized = normalizeIban(value)

  if (!normalized) {
    return { valid: false, error: "SWISS_QR_IBAN ist leer. Bitte deine vollständige IBAN in Vercel eintragen." }
  }

  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return { valid: false, error: "SWISS_QR_IBAN enthält ungültige Zeichen. Erlaubt sind nur Buchstaben und Zahlen." }
  }

  if (!(normalized.startsWith("CH") || normalized.startsWith("LI"))) {
    return { valid: false, error: "SWISS_QR_IBAN muss mit CH oder LI beginnen." }
  }

  if (normalized.length !== 21) {
    return {
      valid: false,
      error: `SWISS_QR_IBAN hat nach der Normalisierung ${normalized.length} Zeichen. Eine CH/LI-IBAN muss genau 21 Zeichen haben.`,
    }
  }

  if (!/^(CH|LI)\d{19}$/.test(normalized)) {
    return {
      valid: false,
      error: "SWISS_QR_IBAN hat das falsche CH/LI-Format. Nach CH/LI müssen zwei Prüfziffern und danach 17 weitere Zeichen folgen.",
    }
  }

  // ISO 13616 / MOD-97-10 checksum validation.
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const numeric = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }

  if (remainder !== 1) {
    return {
      valid: false,
      error: "Die Länge und das CH/LI-Format der SWISS_QR_IBAN stimmen, aber die Prüfziffer ist ungültig. Bitte die IBAN direkt aus deinem E-Banking kopieren und erneut in Vercel eintragen.",
    }
  }

  return { valid: true as const, iban: normalized }
}

const required = [
  "SWISS_QR_IBAN",
  "SWISS_QR_CREDITOR_NAME",
  "SWISS_QR_CREDITOR_STREET",
  "SWISS_QR_CREDITOR_BUILDING",
  "SWISS_QR_CREDITOR_ZIP",
  "SWISS_QR_CREDITOR_CITY",
]

function buildSwissQrPayload(invoiceNumber: string, amount: number) {
  const iban = normalizeIban(env("SWISS_QR_IBAN"))
  const name = env("SWISS_QR_CREDITOR_NAME")
  const street = env("SWISS_QR_CREDITOR_STREET")
  const building = env("SWISS_QR_CREDITOR_BUILDING")
  const zip = env("SWISS_QR_CREDITOR_ZIP")
  const city = env("SWISS_QR_CREDITOR_CITY")
  const country = env("SWISS_QR_CREDITOR_COUNTRY") || "CH"

  const lines = [
    "SPC",
    "0200",
    "1",
    iban,
    "S",
    name,
    street,
    building,
    zip,
    city,
    country,
    "", "", "", "", "", "", "",
    amount.toFixed(2),
    "CHF",
    "", "", "", "", "", "", "",
    "NON",
    "",
    `Rechnung ${invoiceNumber}`.slice(0, 140),
    "EPD",
  ]

  return lines.join("\n")
}

export async function POST(request: Request) {
  try {
    const missing = required.filter((key) => !env(key))
    if (missing.length) {
      return NextResponse.json(
        { error: `Swiss QR-Rechnung ist noch nicht konfiguriert. Fehlende Vercel-Variablen: ${missing.join(", ")}` },
        { status: 503 },
      )
    }

    const body = (await request.json()) as { invoiceNumber?: string; amount?: number }
    const invoiceNumber = String(body.invoiceNumber || "").trim()
    const amount = Number(body.amount)

    if (!invoiceNumber) return NextResponse.json({ error: "Rechnungsnummer fehlt." }, { status: 400 })
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Rechnungsbetrag ist ungültig." }, { status: 400 })

    const ibanDiagnostic = getIbanDiagnostic(env("SWISS_QR_IBAN"))
    if (!ibanDiagnostic.valid) {
      return NextResponse.json({ error: ibanDiagnostic.error }, { status: 400 })
    }

    const payload = buildSwissQrPayload(invoiceNumber, amount)
    const svg = bwipjs.toSVG({
      bcid: "swissqrcode",
      text: payload,
      scale: 4,
      padding: 8,
    })

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Swiss QR generation failed", error)
    return NextResponse.json({ error: "Swiss QR-Code konnte nicht erzeugt werden." }, { status: 500 })
  }
}
