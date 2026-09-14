import { NextResponse } from "next/server"
import bwipjs from "bwip-js"

export const runtime = "nodejs"

const env = (name: string) => process.env[name]?.trim() || ""

const normalizeIban = (value: string) =>
  value
    .trim()
    .replace(/^IBAN:\s*/i, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "")
    .toUpperCase()

const getIbanDiagnostic = (value: string) => {
  const iban = normalizeIban(value)
  if (!iban) return "SWISS_QR_IBAN fehlt."
  if (!/^[A-Z0-9]+$/.test(iban)) return "SWISS_QR_IBAN darf nur Buchstaben und Zahlen enthalten."
  if (!iban.startsWith("CH")) return "SWISS_QR_IBAN muss mit CH beginnen."
  if (iban.length !== 21) {
    return "SWISS_QR_IBAN muss exakt 21 Zeichen haben: CH + 2 Prüfziffern + 17 weitere Zeichen."
  }
  if (!/^CH\d{19}$/.test(iban)) {
    return "SWISS_QR_IBAN hat ein ungültiges Format. Erwartet wird CH + 2 Prüfziffern + 17 Ziffern."
  }

  // Standard IBAN MOD-97-10 Prüfung.
  // Die ersten vier Zeichen werden ans Ende verschoben und
  // Buchstaben werden nach A=10, B=11, ... Z=35 umgewandelt.
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const value = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }

  if (remainder !== 1) return "SWISS_QR_IBAN hat ungültige IBAN-Prüfziffern."

  return ""
}

const buildSwissQrPayload = (invoiceNumber: string, amount: number) => {
  const iban = normalizeIban(env("SWISS_QR_IBAN"))
  const creditorName = env("SWISS_QR_CREDITOR_NAME")
  const creditorStreet = env("SWISS_QR_CREDITOR_STREET")
  const creditorBuilding = env("SWISS_QR_CREDITOR_BUILDING")
  const creditorZip = env("SWISS_QR_CREDITOR_ZIP")
  const creditorCity = env("SWISS_QR_CREDITOR_CITY")
  const creditorCountry = env("SWISS_QR_CREDITOR_COUNTRY") || "CH"

  return [
    "SPC",
    "0200",
    "1",
    iban,
    "S",
    creditorName,
    creditorStreet,
    creditorBuilding,
    creditorZip,
    creditorCity,
    creditorCountry,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    amount.toFixed(2),
    "CHF",
    "",
    "",
    "",
    "",
    "",
    "NON",
    "",
    `Rechnung ${invoiceNumber}`.slice(0, 140),
    "EPD",
  ].join("\n")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      invoiceNumber?: string
      amount?: number
    }

    const invoiceNumber = String(body.invoiceNumber || "").trim()
    const amount = Number(body.amount)

    if (!invoiceNumber) {
      return NextResponse.json({ error: "Rechnungsnummer fehlt." }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Rechnungsbetrag muss grösser als 0 sein." }, { status: 400 })
    }

    const required = [
      "SWISS_QR_IBAN",
      "SWISS_QR_CREDITOR_NAME",
      "SWISS_QR_CREDITOR_STREET",
      "SWISS_QR_CREDITOR_BUILDING",
      "SWISS_QR_CREDITOR_ZIP",
      "SWISS_QR_CREDITOR_CITY",
    ]
    const missing = required.filter((name) => !env(name))
    if (missing.length) {
      return NextResponse.json(
        { error: `Swiss QR-Code Konfiguration fehlt: ${missing.join(", ")}.` },
        { status: 503 },
      )
    }

    const ibanError = getIbanDiagnostic(env("SWISS_QR_IBAN"))
    if (ibanError) {
      return NextResponse.json({ error: ibanError }, { status: 400 })
    }

    const payload = buildSwissQrPayload(invoiceNumber, amount)
    const svg = await bwipjs.toSVG({
      bcid: "swissqrcode",
      text: payload,
      scale: 4,
      padding: 8,
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Swiss QR-Code generation failed", error)
    return NextResponse.json(
      { error: "Swiss QR-Code konnte nicht erzeugt werden." },
      { status: 500 },
    )
  }
}
