import { NextResponse } from "next/server"
import bwipjs from "bwip-js"

export const runtime = "nodejs"

const env = (name: string) => process.env[name]?.trim() || ""

const normalizeIban = (value: string) =>
  value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()

const isValidIban = (value: string) => {
  const iban = normalizeIban(value)
  if (!/^(CH|LI)\d{19}$/.test(iban)) return false

  // ISO 13616 IBAN checksum validation.
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const value = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
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

    const rawIban = env("SWISS_QR_IBAN")
    const iban = normalizeIban(rawIban)
    if (!isValidIban(rawIban)) {
      return NextResponse.json(
        { error: "Die SWISS_QR_IBAN ist nicht gültig. Bitte die vollständige CH/LI-IBAN ohne 'IBAN:' und ohne Anführungszeichen in Vercel eintragen. Leerzeichen sind erlaubt." },
        { status: 400 },
      )
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
