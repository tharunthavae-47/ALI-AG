import { NextResponse } from "next/server"
import { GoogleGenAI, Type } from "@google/genai"
import {
  createBooking,
  getBookedSlots,
} from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// GEMINI
// =====================================================

const apiKey = process.env.GEMINI_API_KEY

const MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.6-flash"

// =====================================================
// TYPES
// =====================================================

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type BookingData = {
  booking_date: string | null
  booking_time: string | null
  name: string | null
  phone: string | null
  email: string | null
  car: string | null
  problem: string | null
}

type GeminiResponse = {
  intent: "chat" | "booking"
  booking: BookingData
  answer: string
}

// =====================================================
// LEERER TERMIN
// =====================================================

const EMPTY_BOOKING: BookingData = {
  booking_date: null,
  booking_time: null,
  name: null,
  phone: null,
  email: null,
  car: null,
  problem: null,
}

function emptyBooking(): BookingData {
  return {
    ...EMPTY_BOOKING,
  }
}

// =====================================================
// ZÜRICH DATUM
// =====================================================

function getZurichDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// =====================================================
// ZÜRICH DATUM + UHRZEIT
// =====================================================

function getZurichDateTime(): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date())
}

// =====================================================
// BOOKING DATA NORMALISIEREN
// =====================================================

function normalizeBooking(
  input: unknown,
): BookingData {
  if (
    !input ||
    typeof input !== "object"
  ) {
    return emptyBooking()
  }

  const data =
    input as Partial<BookingData>

  return {
    booking_date:
      typeof data.booking_date === "string" &&
      data.booking_date.trim()
        ? data.booking_date.trim()
        : null,

    booking_time:
      typeof data.booking_time === "string" &&
      data.booking_time.trim()
        ? data.booking_time.trim()
        : null,

    name:
      typeof data.name === "string" &&
      data.name.trim()
        ? data.name.trim()
        : null,

    phone:
      typeof data.phone === "string" &&
      data.phone.trim()
        ? data.phone.trim()
        : null,

    email:
      typeof data.email === "string" &&
      data.email.trim()
        ? data.email.trim()
        : null,

    car:
      typeof data.car === "string" &&
      data.car.trim()
        ? data.car.trim()
        : null,

    problem:
      typeof data.problem === "string" &&
      data.problem.trim()
        ? data.problem.trim()
        : null,
  }
}

// =====================================================
// BOOKING DATA ZUSAMMENFÜHREN
// =====================================================

function mergeBookingData(
  oldData: BookingData,
  newData: Partial<BookingData>,
): BookingData {
  return {
    booking_date:
      newData.booking_date ||
      oldData.booking_date ||
      null,

    booking_time:
      newData.booking_time ||
      oldData.booking_time ||
      null,

    name:
      newData.name ||
      oldData.name ||
      null,

    phone:
      newData.phone ||
      oldData.phone ||
      null,

    email:
      newData.email ||
      oldData.email ||
      null,

    car:
      newData.car ||
      oldData.car ||
      null,

    problem:
      newData.problem ||
      oldData.problem ||
      null,
  }
}

// =====================================================
// TEXT NORMALISIEREN
// =====================================================

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// =====================================================
// BUCHUNGSABSICHT
// =====================================================

function containsBookingIntent(
  text: string,
): boolean {
  const value = normalizeText(text)

  const patterns = [
    "termin",
    "termin machen",
    "termin erstellen",
    "termin buchen",
    "termin vereinbaren",
    "werkstatttermin",
    "buchung",
    "buchen",
    "reservieren",
    "reservieren",
    "vereinbaren",
    "mach mir einen termin",
    "mache mir einen termin",
    "ich möchte einen termin",
    "ich will einen termin",
    "ich brauche einen termin",
    "ich möchte einen werkstatttermin",
    "ich brauche einen werkstatttermin",
    "auto bringen",
    "wagen bringen",
  ]

  return patterns.some(
    (pattern) =>
      value.includes(pattern),
  )
}

// =====================================================
// DATUM MONATE
// =====================================================

const MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,

  februar: 2,
  feb: 2,

  märz: 3,
  maerz: 3,
  mrz: 3,

  april: 4,
  apr: 4,

  mai: 5,

  juni: 6,
  jun: 6,

  juli: 7,
  jul: 7,

  august: 8,
  aug: 8,

  september: 9,
  sep: 9,
  sept: 9,

  oktober: 10,
  okt: 10,

  november: 11,
  nov: 11,

  dezember: 12,
  dez: 12,
}

// =====================================================
// DATUM ERKENNEN
// =====================================================

function normalizeDate(
  text: string,
  today: string,
): string | null {
  const value = normalizeText(
    text
      .replace(/,/g, " "),
  )

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] = today
    .split("-")
    .map(Number)

  // ---------------------------------------------------
  // MORGEN
  // ---------------------------------------------------

  if (/\bmorgen\b/.test(value)) {
    const date = new Date(
      Date.UTC(
        currentYear,
        currentMonth - 1,
        currentDay + 1,
      ),
    )

    return date
      .toISOString()
      .slice(0, 10)
  }

  // ---------------------------------------------------
  // ÜBERMORGEN
  // ---------------------------------------------------

  if (
    /\bübermorgen\b/.test(value) ||
    /\buebermorgen\b/.test(value)
  ) {
    const date = new Date(
      Date.UTC(
        currentYear,
        currentMonth - 1,
        currentDay + 2,
      ),
    )

    return date
      .toISOString()
      .slice(0, 10)
  }

  // ---------------------------------------------------
  // HEUTE
  // ---------------------------------------------------

  if (/\bheute\b/.test(value)) {
    return today
  }

  // ---------------------------------------------------
  // DD.MM.YYYY
  // DD.MM.YY
  // DD-MM-YYYY
  // DD/MM/YYYY
  // ---------------------------------------------------

  const numericDate =
    value.match(
      /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
    )

  if (numericDate) {
    const day =
      Number(numericDate[1])

    const month =
      Number(numericDate[2])

    let year =
      numericDate[3]
        ? Number(numericDate[3])
        : currentYear

    if (year < 100) {
      year += 2000
    }

    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const date = new Date(
        Date.UTC(
          year,
          month - 1,
          day,
        ),
      )

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return `${String(year).padStart(4, "0")}-${String(
          month,
        ).padStart(2, "0")}-${String(
          day,
        ).padStart(2, "0")}`
      }
    }
  }

  // ---------------------------------------------------
  // "16. Oktober"
  // "16 Oktober"
  // "am 16. Oktober"
  // ---------------------------------------------------

  const monthNames =
    Object.keys(MONTHS)
      .join("|")

  const namedDate =
    value.match(
      new RegExp(
        `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{2,4}))?\\b`,
        "i",
      ),
    )

  if (namedDate) {
    const day =
      Number(namedDate[1])

    const month =
      MONTHS[
        namedDate[2].toLowerCase()
      ]

    let year =
      namedDate[3]
        ? Number(namedDate[3])
        : currentYear

    if (year < 100) {
      year += 2000
    }

    if (
      month &&
      day >= 1 &&
      day <= 31
    ) {
      const date = new Date(
        Date.UTC(
          year,
          month - 1,
          day,
        ),
      )

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return `${String(year).padStart(4, "0")}-${String(
          month,
        ).padStart(2, "0")}-${String(
          day,
        ).padStart(2, "0")}`
      }
    }
  }

  return null
}

// =====================================================
// UHRZEIT ERKENNEN
// =====================================================

function normalizeTime(
  text: string,
): string | null {
  const value = normalizeText(
    text
      .replace(/,/g, "."),
  )

  // ---------------------------------------------------
  // halb 8 = 19:30
  // ---------------------------------------------------

  const halbMatch =
    value.match(
      /\bhalb\s+(\d{1,2})\b/,
    )

  if (halbMatch) {
    let hour =
      Number(halbMatch[1])

    if (hour >= 1 && hour <= 12) {
      hour -= 1

      if (hour < 12) {
        hour += 12
      }
    }

    if (
      hour >= 15 &&
      hour <= 22
    ) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:30`
    }
  }

  // ---------------------------------------------------
  // 20 Uhr
  // 20 uhr
  // um 20 Uhr
  // 8 Uhr abends
  // ---------------------------------------------------

  const hourMatch =
    value.match(
      /\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/,
    )

  if (hourMatch) {
    let hour =
      Number(hourMatch[1])

    const minute =
      Number(
        hourMatch[2] || "0",
      )

    if (
      value.includes("abends") ||
      value.includes("abends")
    ) {
      if (
        hour >= 1 &&
        hour <= 12
      ) {
        hour += 12
      }
    }

    if (
      value.includes("nachmittags")
    ) {
      if (
        hour >= 1 &&
        hour <= 12
      ) {
        hour += 12
      }
    }

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:${String(minute).padStart(
        2,
        "0",
      )}`
    }

    return null
  }

  // ---------------------------------------------------
  // 20:00
  // 20.00
  // ---------------------------------------------------

  const numericMatch =
    value.match(
      /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
    )

  if (numericMatch) {
    const hour =
      Number(numericMatch[1])

    const minute =
      Number(numericMatch[2])

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:${String(minute).padStart(
        2,
        "0",
      )}`
    }
  }

  // ---------------------------------------------------
  // Nur "20"
  // ---------------------------------------------------

  const onlyHour =
    value.match(
      /^(?:um\s*)?(\d{1,2})$/,
    )

  if (onlyHour) {
    const hour =
      Number(onlyHour[1])

    if (
      hour >= 15 &&
      hour <= 22
    ) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:00`
    }
  }

  return null
}

// =====================================================
// DIREKTE DATEN AUS USER-TEXT
// =====================================================

function extractDirectBookingData(
  text: string,
  today: string,
): Partial<BookingData> {
  const result: Partial<BookingData> = {}

  const date =
    normalizeDate(
      text,
      today,
    )

  if (date) {
    result.booking_date = date
  }

  const time =
    normalizeTime(text)

  if (time) {
    result.booking_time = time
  }

  return result
}

// =====================================================
// GÜLTIGES DATUM
// =====================================================

function isValidDate(
  value: string | null,
): boolean {
  if (!value) {
    return false
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number)

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

// =====================================================
// GÜLTIGE UHRZEIT
// =====================================================

function isValidTime(
  value: string | null,
): boolean {
  if (!value) {
    return false
  }

  if (
    !/^\d{2}:\d{2}$/.test(
      value,
    )
  ) {
    return false
  }

  const [
    hour,
    minute,
  ] = value
    .split(":")
    .map(Number)

  return (
    hour >= 15 &&
    hour <= 22 &&
    minute >= 0 &&
    minute <= 59
  )
}

// =====================================================
// DATUM FORMATIEREN
// =====================================================

function formatDate(
  value: string,
): string {
  const [
    year,
    month,
    day,
  ] = value.split("-")

  return `${day}.${month}.${year}`
}

// =====================================================
// FEHLENDES FELD
// =====================================================

function getMissingField(
  booking: BookingData,
): keyof BookingData | null {
  if (!booking.booking_date) {
    return "booking_date"
  }

  if (!booking.booking_time) {
    return "booking_time"
  }

  if (!booking.name) {
    return "name"
  }

  if (!booking.phone) {
    return "phone"
  }

  if (!booking.email) {
    return "email"
  }

  if (!booking.car) {
    return "car"
  }

  if (!booking.problem) {
    return "problem"
  }

  return null
}

// =====================================================
// FRAGE FÜR FEHLENDES FELD
// =====================================================

function questionForField(
  field: keyof BookingData,
): string {
  switch (field) {
    case "booking_date":
      return "Für welchen Tag möchtest du den Termin?"

    case "booking_time":
      return "Um welche Uhrzeit möchtest du den Termin? Termine sind zwischen 15:00 und 22:00 Uhr möglich."

    case "name":
      return "Wie ist dein Vor und Nachname?"

    case "phone":
      return "Wie lautet deine Telefonnummer?"

    case "email":
      return "Wie lautet deine E-Mail-Adresse?"

    case "car":
      return "Welches Fahrzeug soll ich für den Termin eintragen?"

    case "problem":
      return "Was soll am Fahrzeug gemacht oder überprüft werden?"

    default:
      return "Welche Information fehlt noch?"
  }
}

// =====================================================
// JSON BEREINIGEN
// =====================================================

function cleanJson(
  text: string,
): string {
  return text
    .replace(
      /^```json\s*/i,
      "",
    )
    .replace(
      /^```\s*/i,
      "",
    )
    .replace(
      /\s*```$/i,
      "",
    )
    .trim()
}

// =====================================================
// GEMINI
// =====================================================

async function askGemini(
  prompt: string,
): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY ist nicht eingerichtet.",
    )
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    })

  try {
    const response =
      await ai.models.generateContent({
        model: MODEL,

        contents: prompt,

        config: {
          temperature: 0.3,

          maxOutputTokens: 1200,

          responseMimeType:
            "application/json",

          responseSchema: {
            type: Type.OBJECT,

            properties: {
              intent: {
                type: Type.STRING,

                enum: [
                  "chat",
                  "booking",
                ],
              },

              booking: {
                type: Type.OBJECT,

                properties: {
                  booking_date: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  booking_time: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  name: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  phone: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  email: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  car: {
                    type: Type.STRING,
                    nullable: true,
                  },

                  problem: {
                    type: Type.STRING,
                    nullable: true,
                  },
                },

                required: [
                  "booking_date",
                  "booking_time",
                  "name",
                  "phone",
                  "email",
                  "car",
                  "problem",
                ],
              },

              answer: {
                type: Type.STRING,
              },
            },

            required: [
              "intent",
              "booking",
              "answer",
            ],
          },
        },
      })

    const text =
      response.text?.trim()

    if (!text) {
      throw new Error(
        "Gemini hat keine Antwort zurückgegeben.",
      )
    }

    console.log(
      "JARVIS GEMINI:",
      text,
    )

    return text
  } catch (error) {
    console.error(
      "JARVIS GEMINI ERROR:",
      error,
    )

    throw error
  }
}

// =====================================================
// GEMINI ANTWORT PARSEN
// =====================================================

function parseGeminiResponse(
  raw: string,
): GeminiResponse {
  const cleaned =
    cleanJson(raw)

  let parsed: any

  try {
    parsed =
      JSON.parse(cleaned)
  } catch (error) {
    console.error(
      "====================================",
    )

    console.error(
      "GEMINI INVALID JSON",
    )

    console.error(
      cleaned,
    )

    console.error(
      "====================================",
    )

    throw new Error(
      "Gemini hat eine ungültige JSON-Antwort geliefert.",
    )
  }

  const booking =
    normalizeBooking(
      parsed?.booking,
    )

  return {
    intent:
      parsed?.intent ===
      "booking"
        ? "booking"
        : "chat",

    booking,

    answer:
      typeof parsed?.answer ===
      "string"
        ? parsed.answer.trim()
        : "",
  }
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    // =================================================
    // API KEY
    // =================================================

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY fehlt in den Umgebungsvariablen.",
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // REQUEST
    // =================================================

    const body =
      await request.json()

    const messages =
      body?.messages

    if (
      !Array.isArray(
        messages,
      ) ||
      messages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Keine Chatnachrichten erhalten.",
        },
        {
          status: 400,
        },
      )
    }

    // =================================================
    // NUR GÜLTIGE NACHRICHTEN
    // =================================================

    const validMessages =
      messages.filter(
        (message: any) =>
          message &&
          (
            message.role ===
              "user" ||
            message.role ===
              "assistant"
          ) &&
          typeof message.content ===
            "string" &&
          message.content.trim()
            .length > 0,
      ) as ChatMessage[]

    if (
      validMessages.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Keine gültigen Nachrichten erhalten.",
        },
        {
          status: 400,
        },
      )
    }

    // =================================================
    // AKTUELLES DATUM
    // =================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =================================================
    // BISHERIGE BOOKING-DATEN
    // =================================================

    let booking =
      normalizeBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE USER-NACHRICHT
    // =================================================

    const lastUserMessage =
      [...validMessages]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "user",
        )

    const lastUserText =
      lastUserMessage?.content ||
      ""

    // =================================================
    // DIREKTE DATUM/UHRZEIT ERKENNUNG
    // =================================================

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
      )

    booking =
      mergeBookingData(
        booking,
        directData,
      )

    console.log(
      "====================================",
    )

    console.log(
      "JARVIS USER:",
      lastUserText,
    )

    console.log(
      "JARVIS DIRECT DATA:",
      directData,
    )

    console.log(
      "JARVIS CLIENT BOOKING:",
      booking,
    )

    // =================================================
    // ERKENNEN, OB TERMINMODUS AKTIV IST
    // =================================================

    const clientBookingInProgress =
      body?.bookingInProgress ===
      true

    const hasBookingData =
      Object.values(booking)
        .some(
          (value) =>
            typeof value ===
              "string" &&
            value.length > 0,
        )

    const explicitBookingIntent =
      containsBookingIntent(
        lastUserText,
      )

    const bookingMode =
      explicitBookingIntent ||
      clientBookingInProgress ||
      hasBookingData

    // =================================================
    // WENN KEIN TERMIN:
    // NORMALE KI-ANTWORT
    // =================================================

    if (!bookingMode) {
      const conversation =
        validMessages
          .slice(-20)
          .map(
            (message) =>
              `${
                message.role ===
                "user"
                  ? "BENUTZER"
                  : "JARVIS"
              }: ${message.content}`,
          )
          .join("\n")

      const chatPrompt = `
Du bist JARVIS, der intelligente KI-Assistent von MB-Performance.

Du sollst dich wie eine normale moderne KI unterhalten.

Sprache:
Deutsch.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

WICHTIG:

Der Benutzer hat NICHT nach einem Werkstatttermin gefragt.

Deshalb:
- Frage NICHT nach einem Termin.
- Frage NICHT nach einem Datum.
- Frage NICHT nach einer Uhrzeit.
- Starte KEINE Buchung.
- Antworte natürlich auf die tatsächliche Frage.
- Wenn der Benutzer etwas über Autos fragt, beantworte die Frage.
- Wenn der Benutzer nach BMW, Mercedes, Reparaturen, Motoren, Tuning oder anderen Autothemen fragt, antworte hilfreich.
- Wenn du etwas nicht sicher weißt, sage es ehrlich.
- Antworte nicht unnötig mit Rückfragen.
- Sprich natürlich und menschlich.

Beispiel:

BENUTZER:
Was ist ein BMW M4?

JARVIS:
Der BMW M4 ist ...

Nicht:
"Für welchen Tag möchtest du den Termin?"

Bisheriger Chat:

${conversation}

Letzte Nachricht:

${lastUserText}

Antworte direkt auf die Frage des Benutzers.

Gib ausschließlich JSON zurück:

{
  "intent": "chat",
  "booking": {
    "booking_date": null,
    "booking_time": null,
    "name": null,
    "phone": null,
    "email": null,
    "car": null,
    "problem": null
  },
  "answer": "DEINE ANTWORT"
}
`

      try {
        const raw =
          await askGemini(
            chatPrompt,
          )

        const analysis =
          parseGeminiResponse(
            raw,
          )

        return NextResponse.json({
          answer:
            analysis.answer ||
            "Natürlich. Wie kann ich dir helfen?",

          bookingCreated:
            false,

          bookingInProgress:
            false,

          bookingData:
            booking,
        })
      } catch (error) {
        console.error(
          "JARVIS CHAT PARSE ERROR:",
          error,
        )

        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "JARVIS konnte die Anfrage nicht verarbeiten.",
          },
          {
            status: 500,
          },
        )
      }
    }

    // =================================================
    // TERMINMODUS
    // =================================================

    console.log(
      "JARVIS BOOKING MODE",
    )

    // =================================================
    // GEMINI NUR ZUR DATENERKENNUNG
    // =================================================

    const conversation =
      validMessages
        .slice(-20)
        .map(
          (message) =>
            `${
              message.role ===
              "user"
                ? "BENUTZER"
                : "JARVIS"
            }: ${message.content}`,
        )
        .join("\n")

    const bookingPrompt = `
Du bist JARVIS von MB-Performance.

Der Benutzer möchte einen Werkstatttermin erstellen.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

TERMINZEITEN:
15:00 bis 22:00 Uhr.

Deine Aufgabe ist ausschließlich:

1. Bereits genannte Kundendaten erkennen.
2. Neue Kundendaten erkennen.
3. Bereits vorhandene Daten NICHT löschen.
4. Keine Daten erfinden.

BEREITS ERKANNTE DATEN:

${JSON.stringify(
  booking,
  null,
  2,
)}

Wenn beispielsweise booking_date bereits:

"${booking.booking_date}"

ist, darfst du es NICHT auf null setzen.

Wenn booking_time bereits:

"${booking.booking_time}"

ist, darfst du es NICHT auf null setzen.

DATUM:

16.10.26 bedeutet:

2026-10-16

16.10.2026 bedeutet:

2026-10-16

16 Oktober bedeutet:

${currentDate.slice(0, 4)}-10-16

morgen bedeutet das morgige Datum.

übermorgen bedeutet das Datum zwei Tage nach heute.

UHRZEIT:

20 Uhr = 20:00

20 uhr = 20:00

um 20 Uhr = 20:00

20:00 = 20:00

20.00 = 20:00

halb 8 = 19:30

8 Uhr abends = 20:00

TERMIN-DATEN:

booking_date
booking_time
name
phone
email
car
problem

CHAT:

${conversation}

LETZTE NACHRICHT:

${lastUserText}

Gib ausschließlich gültiges JSON zurück.

Format:

{
  "intent": "booking",
  "booking": {
    "booking_date": "YYYY-MM-DD oder null",
    "booking_time": "HH:MM oder null",
    "name": "Name oder null",
    "phone": "Telefon oder null",
    "email": "E-Mail oder null",
    "car": "Fahrzeug oder null",
    "problem": "Anliegen oder null"
  },
  "answer": ""
}

Keine zusätzlichen Erklärungen.
`

    let analysis: GeminiResponse

    try {
      const raw =
        await askGemini(
          bookingPrompt,
        )

      analysis =
        parseGeminiResponse(
          raw,
        )
    } catch (error) {
      console.error(
        "JARVIS BOOKING GEMINI ERROR:",
        error,
      )

      /*
       * WICHTIG:
       *
       * Wenn Gemini beim JSON versagt,
       * benutzen wir trotzdem die direkt
       * erkannten Daten.
       */

      analysis = {
        intent: "booking",

        booking: emptyBooking(),

        answer: "",
      }
    }

    // =================================================
    // GEMINI DATEN + DIREKTE DATEN
    // =================================================

    booking =
      mergeBookingData(
        booking,
        analysis.booking,
      )

    // Direkte Erkennung hat höchste Priorität.

    if (
      directData.booking_date
    ) {
      booking.booking_date =
        directData.booking_date
    }

    if (
      directData.booking_time
    ) {
      booking.booking_time =
        directData.booking_time
    }

    console.log(
      "JARVIS FINAL BOOKING:",
      booking,
    )

    // =================================================
    // DATUM PRÜFEN
    // =================================================

    if (
      booking.booking_date &&
      !isValidDate(
        booking.booking_date,
      )
    ) {
      booking.booking_date =
        null
    }

    // =================================================
    // UHRZEIT PRÜFEN
    // =================================================

    if (
      booking.booking_time &&
      !isValidTime(
        booking.booking_time,
      )
    ) {
      booking.booking_time =
        null
    }

    // =================================================
    // VERGANGENES DATUM
    // =================================================

    if (
      booking.booking_date &&
      booking.booking_date <
        currentDate
    ) {
      return NextResponse.json({
        answer:
          "Dieser Termin liegt bereits in der Vergangenheit. Welchen zukünftigen Tag möchtest du?",

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          booking_date: null,
        },

        missing:
          "booking_date",
      })
    }

    // =================================================
    // FEHLENDES FELD
    // =================================================

    const missing =
      getMissingField(
        booking,
      )

    if (missing) {
      return NextResponse.json({
        answer:
          questionForField(
            missing,
          ),

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData:
          booking,

        missing,
      })
    }

    // =================================================
    // UHRZEIT NOCHMAL PRÜFEN
    // =================================================

    if (
      !isValidTime(
        booking.booking_time,
      )
    ) {
      return NextResponse.json({
        answer:
          "Diese Uhrzeit ist nicht möglich. Termine sind zwischen 15:00 und 22:00 Uhr möglich. Welche Uhrzeit möchtest du?",

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing:
          "booking_time",
      })
    }

    // =================================================
    // BELEGTE TERMINE
    // =================================================

    let bookedSlots

    try {
      bookedSlots =
        await getBookedSlots()
    } catch (error) {
      console.error(
        "GET BOOKED SLOTS ERROR:",
        error,
      )

      return NextResponse.json(
        {
          error:
            "Die verfügbaren Termine konnten nicht geprüft werden.",
        },
        {
          status: 500,
        },
      )
    }

    const alreadyBooked =
      bookedSlots.some(
        (slot: any) =>
          slot.booking_date ===
            booking.booking_date &&
          slot.booking_time ===
            booking.booking_time,
      )

    if (alreadyBooked) {
      return NextResponse.json({
        answer:
          `Der Termin am ${formatDate(
            booking.booking_date!,
          )} um ${
            booking.booking_time
          } Uhr ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing:
          "booking_time",
      })
    }

    // =================================================
    // TERMIN ERSTELLEN
    // =================================================

    console.log(
      "====================================",
    )

    console.log(
      "JARVIS → CREATE BOOKING",
    )

    console.log(
      booking,
    )

    console.log(
      "====================================",
    )

    let result

    try {
      result =
        await createBooking({
          booking_date:
            booking.booking_date!,

          booking_time:
            booking.booking_time!,

          name:
            booking.name!,

          phone:
            booking.phone!,

          email:
            booking.email!,

          car:
            booking.car!,

          problem:
            booking.problem!,
        })
    } catch (error) {
      console.error(
        "CREATE BOOKING ERROR:",
        error,
      )

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Der Termin konnte nicht erstellt werden.",
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // CREATE BOOKING FEHLER
    // =================================================

    if (!result.ok) {
      console.error(
        "CREATE BOOKING FAILED:",
        result.error,
      )

      const errorText =
        result.error ||
        ""

      if (
        errorText
          .toLowerCase()
          .includes(
            "bereits vergeben",
          )
      ) {
        return NextResponse.json({
          answer:
            `Der Termin am ${formatDate(
              booking.booking_date!,
            )} um ${
              booking.booking_time
            } Uhr ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,

          bookingCreated:
            false,

          bookingInProgress:
            true,

          bookingData: {
            ...booking,
            booking_time: null,
          },

          missing:
            "booking_time",
        })
      }

      return NextResponse.json({
        answer:
          `Ich konnte den Termin leider nicht erstellen. ${
            errorText ||
            "Bitte versuche es erneut."
          }`,

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData:
          booking,
      })
    }

    // =================================================
    // ERFOLGREICH
    // =================================================

    const dateText =
      formatDate(
        booking.booking_date!,
      )

    const timeText =
      booking.booking_time!

    console.log(
      "====================================",
    )

    console.log(
      "JARVIS BOOKING CREATED",
    )

    console.log(
      "BOOKING ID:",
      result.bookingId,
    )

    console.log(
      "====================================",
    )

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${timeText} Uhr für ${booking.car}. Dein Anliegen: ${booking.problem}. Der Termin wurde als Anfrage eingetragen.`,

      bookingCreated:
        true,

      bookingId:
        result.bookingId,

      bookingData:
        emptyBooking(),

      bookingInProgress:
        false,
    })
  } catch (error) {
    console.error(
      "====================================",
    )

    console.error(
      "JARVIS CHAT ERROR",
    )

    console.error(
      error,
    )

    console.error(
      "====================================",
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "JARVIS konnte die Anfrage nicht verarbeiten.",
      },
      {
        status: 500,
      },
    )
  }
}
