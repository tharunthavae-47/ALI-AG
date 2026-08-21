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

// NUR EIN GEMINI-MODELL
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash"

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
// BOOKING NORMALISIEREN
// =====================================================

function normalizeBooking(
  input: unknown,
): BookingData {
  if (!input || typeof input !== "object") {
    return emptyBooking()
  }

  const data = input as Partial<BookingData>

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
// BOOKING ZUSAMMENFÜHREN
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

function normalizeText(
  text: string,
): string {
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
    "vereinbaren",
    "mach mir einen termin",
    "mache mir einen termin",
    "ich möchte einen termin",
    "ich moechte einen termin",
    "ich will einen termin",
    "ich brauche einen termin",
    "ich möchte einen werkstatttermin",
    "ich moechte einen werkstatttermin",
    "ich brauche einen werkstatttermin",
    "auto bringen",
    "wagen bringen",
  ]

  return patterns.some(
    (pattern) => value.includes(pattern),
  )
}

// =====================================================
// MONATE
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
    text.replace(/,/g, " "),
  )

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] = today.split("-").map(Number)

  if (/\bheute\b/.test(value)) {
    return today
  }

  if (/\bmorgen\b/.test(value)) {
    const date = new Date(
      Date.UTC(
        currentYear,
        currentMonth - 1,
        currentDay + 1,
      ),
    )

    return date.toISOString().slice(0, 10)
  }

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

    return date.toISOString().slice(0, 10)
  }

  const numericDate = value.match(
    /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
  )

  if (numericDate) {
    const day = Number(numericDate[1])
    const month = Number(numericDate[2])

    let year = numericDate[3]
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
        return `${String(year).padStart(
          4,
          "0",
        )}-${String(month).padStart(
          2,
          "0",
        )}-${String(day).padStart(
          2,
          "0",
        )}`
      }
    }
  }

  const monthNames =
    Object.keys(MONTHS).join("|")

  const namedDate = value.match(
    new RegExp(
      `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{2,4}))?\\b`,
      "i",
    ),
  )

  if (namedDate) {
    const day = Number(namedDate[1])

    const month =
      MONTHS[
        namedDate[2].toLowerCase()
      ]

    let year = namedDate[3]
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
        return `${String(year).padStart(
          4,
          "0",
        )}-${String(month).padStart(
          2,
          "0",
        )}-${String(day).padStart(
          2,
          "0",
        )}`
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
    text.replace(/,/g, "."),
  )

  const halbMatch =
    value.match(
      /\bhalb\s+(\d{1,2})\b/,
    )

  if (halbMatch) {
    let hour = Number(
      halbMatch[1],
    )

    if (
      hour >= 1 &&
      hour <= 12
    ) {
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

  const hourMatch = value.match(
    /\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/,
  )

  if (hourMatch) {
    let hour = Number(
      hourMatch[1],
    )

    const minute = Number(
      hourMatch[2] || "0",
    )

    if (
      value.includes("abends") ||
      value.includes("abend") ||
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

  const numericMatch =
    value.match(
      /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
    )

  if (numericMatch) {
    const hour = Number(
      numericMatch[1],
    )

    const minute = Number(
      numericMatch[2],
    )

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

  if (/^(\d{1,2})$/.test(value)) {
    const hour = Number(value)

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
// E-MAIL
// =====================================================

function extractEmail(
  text: string,
): string | null {
  const match = text.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  )

  return match
    ? match[0].trim()
    : null
}

// =====================================================
// TELEFON
// =====================================================

function extractPhone(
  text: string,
): string | null {
  const matches = text.match(
    /(?:\+41|0041|0)\s*(?:\(?\d{2}\)?[\s.-]*)?(?:\d[\s.-]*){6,}/g,
  )

  if (!matches?.length) {
    return null
  }

  for (const match of matches) {
    const digits =
      match.replace(/\D/g, "")

    let normalized = digits

    if (
      digits.startsWith("0041")
    ) {
      normalized =
        "0" +
        digits.slice(4)
    } else if (
      digits.startsWith("41") &&
      digits.length >= 10
    ) {
      normalized =
        "0" +
        digits.slice(2)
    }

    if (
      /^0\d{9}$/.test(normalized)
    ) {
      return normalized
    }
  }

  return null
}

// =====================================================
// NAME
// =====================================================

function extractFullName(
  text: string,
): string | null {
  let value = text.trim()

  if (!value) {
    return null
  }

  value = value.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    " ",
  )

  value = value.replace(
    /(?:\+41|0041|0)\s*(?:\(?\d{2}\)?[\s.-]*)?(?:\d[\s.-]*){6,}/g,
    " ",
  )

  value = value
    .replace(
      /[,:;.!?]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()

  value = value
    .replace(
      /^(?:mein\s+name\s+ist|mein\s+name\s+lautet|ich\s+heiße|ich\s+heisse|name\s+ist|ich\s+bin)\s+/i,
      "",
    )
    .trim()

  if (!value) {
    return null
  }

  const parts = value.split(/\s+/)

  if (
    parts.length < 2 ||
    parts.length > 5
  ) {
    return null
  }

  const valid = parts.every(
    (part) =>
      /^[A-Za-zÄÖÜäöüÀ-ÖØ-öø-ÿ'’\-]+$/.test(
        part,
      ),
  )

  if (!valid) {
    return null
  }

  const blockedWords = [
    "ich",
    "möchte",
    "moechte",
    "will",
    "brauche",
    "einen",
    "eine",
    "einem",
    "einer",
    "termin",
    "buchung",
    "buchen",
    "reservieren",
    "vereinbaren",
    "auto",
    "fahrzeug",
    "wagen",
    "problem",
    "anliegen",
    "reparatur",
    "reparieren",
    "inspektion",
    "wartung",
    "ölwechsel",
    "oelwechsel",
    "diagnose",
    "reifen",
    "bremsen",
    "motor",
    "hallo",
    "guten",
    "morgen",
    "heute",
    "bitte",
    "telefon",
    "nummer",
    "email",
    "e-mail",
  ]

  if (
    parts.some(
      (part) =>
        blockedWords.includes(
          part.toLowerCase(),
        ),
    )
  ) {
    return null
  }

  return parts
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ")
}

// =====================================================
// FAHRZEUG
// =====================================================

function extractCar(
  text: string,
): string | null {
  const value = text.trim()

  const brands = [
    "Mercedes-Benz",
    "Mercedes",
    "Alfa Romeo",
    "Land Rover",
    "Range Rover",
    "BMW",
    "Audi",
    "Volkswagen",
    "VW",
    "Porsche",
    "Opel",
    "Ford",
    "Toyota",
    "Lexus",
    "Honda",
    "Nissan",
    "Mazda",
    "Subaru",
    "Volvo",
    "Skoda",
    "Škoda",
    "Seat",
    "Cupra",
    "Renault",
    "Peugeot",
    "Citroën",
    "Citroen",
    "Fiat",
    "Tesla",
    "Hyundai",
    "Kia",
    "Jaguar",
    "Mini",
    "Mitsubishi",
    "Suzuki",
  ]

  const escapedBrands =
    brands
      .sort(
        (a, b) =>
          b.length - a.length,
      )
      .map(
        (brand) =>
          brand.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          ),
      )
      .join("|")

  const brandMatch =
    value.match(
      new RegExp(
        `\\b(${escapedBrands})\\b(?:\\s+([A-Za-z0-9ÄÖÜäöü+\\-./]{1,20}))?`,
        "i",
      ),
    )

  if (brandMatch) {
    const brand = brandMatch[1]

    const model = brandMatch[2]
      ? brandMatch[2].trim()
      : ""

    const forbidden = [
      "hat",
      "macht",
      "braucht",
      "benötigt",
      "benoetigt",
      "soll",
      "muss",
      "wegen",
      "mit",
      "und",
      "mein",
      "meine",
      "termin",
    ]

    if (
      model &&
      !forbidden.includes(
        model.toLowerCase(),
      )
    ) {
      return `${brand} ${model}`
    }

    return brand
  }

  const explicit =
    value.match(
      /(?:mein\s+auto\s+ist|mein\s+fahrzeug\s+ist|fahrzeug\s*:\s*|auto\s*:\s*)(.+?)(?:[,.!?]|$)/i,
    )

  if (explicit?.[1]) {
    return explicit[1]
      .trim()
      .replace(/\s+/g, " ")
  }

  return null
}

// =====================================================
// ANLIEGEN
// =====================================================

function extractProblem(
  text: string,
): string | null {
  const value = text.trim()

  const explicit =
    value.match(
      /(?:problem|anliegen|grund)\s*(?:ist|:)?\s*(.+)$/i,
    )

  if (explicit?.[1]) {
    const problem =
      explicit[1]
        .trim()
        .replace(
          /[.!?]+$/,
          "",
        )

    if (
      problem.length >= 3
    ) {
      return problem
    }
  }

  const keywords = [
    "ölwechsel",
    "oelwechsel",
    "inspektion",
    "wartung",
    "service",
    "bremsen",
    "bremsbeläge",
    "bremsbelaege",
    "bremswechsel",
    "reifenwechsel",
    "reifenservice",
    "reifen",
    "diagnose",
    "fehlerdiagnose",
    "motorproblem",
    "motor",
    "getriebe",
    "kupplung",
    "batterie",
    "lichtmaschine",
    "klimaanlage",
    "klima",
    "auspuff",
    "fahrwerk",
    "tuning",
    "tieferlegung",
    "mfk",
    "kontrollleuchte",
    "warnleuchte",
    "motorkontrollleuchte",
    "geräusch",
    "geraeusch",
    "quietschen",
    "knacken",
    "ruckeln",
    "vibration",
    "unfall",
    "lack",
    "karosserie",
    "reparatur",
    "reparieren",
  ]

  const lower =
    normalizeText(value)

  const found =
    keywords.find(
      (keyword) =>
        lower.includes(keyword),
    )

  if (found) {
    return value
      .replace(
        /^[,.\s]+|[,.\s]+$/g,
        "",
      )
      .slice(0, 300)
  }

  return null
}

// =====================================================
// DIREKTE DATENERKENNUNG
// =====================================================

function extractDirectBookingData(
  text: string,
  today: string,
  currentBooking: BookingData,
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

  const email =
    extractEmail(text)

  if (email) {
    result.email = email
  }

  const phone =
    extractPhone(text)

  if (phone) {
    result.phone = phone
  }

  if (!currentBooking.name) {
    const name =
      extractFullName(text)

    if (name) {
      result.name = name
    }
  }

  if (!currentBooking.car) {
    const car =
      extractCar(text)

    if (car) {
      result.car = car
    }
  }

  if (!currentBooking.problem) {
    const problem =
      extractProblem(text)

    if (problem) {
      result.problem = problem
    }
  }

  return result
}

// =====================================================
// VALIDIERUNG
// =====================================================

function isValidDate(
  value: string | null,
): boolean {
  if (!value) return false

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
  ] = value.split("-").map(Number)

  const date =
    new Date(
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

function isValidTime(
  value: string | null,
): boolean {
  if (!value) return false

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
  ] = value.split(":").map(Number)

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
  if (!booking.booking_date)
    return "booking_date"

  if (!booking.booking_time)
    return "booking_time"

  if (!booking.name)
    return "name"

  if (!booking.phone)
    return "phone"

  if (!booking.email)
    return "email"

  if (!booking.car)
    return "car"

  if (!booking.problem)
    return "problem"

  return null
}

// =====================================================
// FRAGE
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
      return "Wie ist dein Vor- und Nachname?"

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
// GEMINI RESPONSE PARSEN
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
  } catch {
    throw new Error(
      "Gemini JSON konnte nicht gelesen werden.",
    )
  }

  return {
    intent:
      parsed?.intent === "booking"
        ? "booking"
        : "chat",

    booking:
      normalizeBooking(
        parsed?.booking,
      ),

    answer:
      typeof parsed?.answer ===
      "string"
        ? parsed.answer.trim()
        : "",
  }
}

// =====================================================
// GEMINI FEHLER ERKENNEN
// =====================================================

function isGeminiLimitError(
  errorText: string,
): boolean {
  const lower =
    errorText.toLowerCase()

  return (
    errorText.includes("429") ||
    lower.includes(
      "resource_exhausted",
    ) ||
    lower.includes("quota") ||
    lower.includes(
      "rate limit",
    ) ||
    lower.includes(
      "rate_limit",
    ) ||
    lower.includes(
      "requests per day",
    ) ||
    lower.includes(
      "daily limit",
    ) ||
    lower.includes(
      "generate_content_free_tier_requests",
    ) ||
    lower.includes(
      "resource exhausted",
    )
  )
}

// =====================================================
// GEMINI
// NUR EIN MODELL
// =====================================================

async function askGemini(
  prompt: string,
): Promise<{
  text: string | null
  rateLimited: boolean
}> {
  if (!apiKey) {
    console.error(
      "GEMINI_API_KEY fehlt.",
    )

    return {
      text: null,
      rateLimited: false,
    }
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    })

  console.log(
    `JARVIS → Gemini: ${GEMINI_MODEL}`,
  )

  try {
    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,

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
      console.warn(
        "JARVIS → Gemini hat keine Antwort geliefert.",
      )

      return {
        text: null,
        rateLimited: false,
      }
    }

    console.log(
      "JARVIS → Gemini ERFOLGREICH",
    )

    return {
      text,
      rateLimited: false,
    }
  } catch (error) {
    const errorText =
      error instanceof Error
        ? error.message
        : JSON.stringify(error)

    console.error(
      "JARVIS → Gemini FEHLER:",
      errorText,
    )

    const rateLimited =
      isGeminiLimitError(
        errorText,
      )

    if (rateLimited) {
      console.warn(
        "JARVIS → GEMINI RATE LIMIT / RPD ERREICHT",
      )
    }

    return {
      text: null,
      rateLimited,
    }
  }
}

// =====================================================
// FALLBACK CHAT
// =====================================================

function getChatFallback(
  text: string,
): string {
  const value =
    normalizeText(text)

  if (
    value.includes("wer bist du") ||
    value.includes("was bist du")
  ) {
    return "Ich bin JARVIS, der KI-Assistent von MB-Performance."
  }

  if (
    value.includes("hallo") ||
    value === "hi" ||
    value === "hey"
  ) {
    return "Hallo! Ich bin JARVIS von MB-Performance. Wie kann ich dir helfen?"
  }

  if (
    value.includes("termin") ||
    value.includes("buchung")
  ) {
    return "Gerne. Ich kann einen Werkstatttermin für dich erstellen. Sag mir einfach Datum, Uhrzeit und deine Kontaktdaten."
  }

  if (
    value.includes("bmw") ||
    value.includes("mercedes") ||
    value.includes("audi") ||
    value.includes("auto") ||
    value.includes("fahrzeug")
  ) {
    return "Natürlich. Ich kann dir bei Fragen rund um Fahrzeuge, Reparaturen, Wartung und Werkstatttermine helfen."
  }

  return "Ich bin gerade vorübergehend nicht erreichbar."
}

// =====================================================
// RATE-LIMIT ANTWORT
// =====================================================

function getTiredMessage(): string {
  return "Ich bin heute etwas zu müde 😴. Versuch es bitte morgen noch einmal."
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json()

    const messages =
      body?.messages

    if (
      !Array.isArray(messages) ||
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

    const validMessages =
      messages.filter(
        (message: any) =>
          message &&
          (
            message.role === "user" ||
            message.role === "assistant"
          ) &&
          typeof message.content ===
            "string" &&
          message.content.trim().length > 0,
      ) as ChatMessage[]

    if (
      validMessages.length === 0
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
    // ZEIT
    // =================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =================================================
    // BOOKING
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
            message.role === "user",
        )

    const lastUserText =
      lastUserMessage?.content || ""

    // =================================================
    // BOOKING STATUS
    // =================================================

    const clientBookingInProgress =
      body?.bookingInProgress === true

    const hasBookingData =
      Object.values(booking).some(
        (value) =>
          typeof value === "string" &&
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

    console.log(
      "====================================",
    )

    console.log(
      "JARVIS REQUEST",
    )

    console.log(
      "MODEL:",
      GEMINI_MODEL,
    )

    console.log(
      "USER:",
      lastUserText,
    )

    console.log(
      "BOOKING MODE:",
      bookingMode,
    )

    console.log(
      "====================================",
    )

    // =================================================
    // DIREKTE DATENERKENNUNG
    // =================================================

    if (bookingMode) {
      const directData =
        extractDirectBookingData(
          lastUserText,
          currentDate,
          booking,
        )

      booking =
        mergeBookingData(
          booking,
          directData,
        )
    }

    // =================================================
    // NORMALER CHAT
    // =================================================

    if (!bookingMode) {
      const conversation =
        validMessages
          .slice(-8)
          .map(
            (message) =>
              `${
                message.role === "user"
                  ? "BENUTZER"
                  : "JARVIS"
              }: ${message.content}`,
          )
          .join("\n")

      if (!apiKey) {
        return NextResponse.json({
          answer:
            "JARVIS ist noch nicht mit Gemini verbunden. Bitte prüfe GEMINI_API_KEY in Vercel.",

          bookingCreated: false,

          bookingInProgress: false,

          bookingData: booking,

          fallbackMode: true,
        })
      }

      const chatPrompt = `
Du bist JARVIS, der intelligente KI-Assistent von MB-Performance.

Sprache:
Deutsch.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

Der Benutzer möchte aktuell KEINEN Werkstatttermin buchen.

Starte keine Buchung.

Antworte natürlich, freundlich und direkt.

Du bist der digitale Assistent einer professionellen Autowerkstatt.

Bisheriger Chat:

${conversation}

Letzte Nachricht:

${lastUserText}

Gib ausschließlich gültiges JSON zurück.

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

      const gemini =
        await askGemini(
          chatPrompt,
        )

      // =================================================
      // RATE LIMIT
      // =================================================

      if (gemini.rateLimited) {
        return NextResponse.json({
          answer:
            getTiredMessage(),

          bookingCreated: false,

          bookingInProgress: false,

          bookingData: booking,

          fallbackMode: true,

          geminiRateLimited: true,
        })
      }

      if (gemini.text) {
        try {
          const analysis =
            parseGeminiResponse(
              gemini.text,
            )

          return NextResponse.json({
            answer:
              analysis.answer ||
              "Natürlich. Wie kann ich dir helfen?",

            bookingCreated: false,

            bookingInProgress: false,

            bookingData: booking,

            fallbackMode: false,
          })
        } catch (error) {
          console.warn(
            "Gemini Chat Parsing fehlgeschlagen:",
            error,
          )
        }
      }

      return NextResponse.json({
        answer:
          getChatFallback(
            lastUserText,
          ),

        bookingCreated: false,

        bookingInProgress: false,

        bookingData: booking,

        fallbackMode: true,
      })
    }

    // =================================================
    // BOOKING MODE
    // =================================================

    let analysis: GeminiResponse = {
      intent: "booking",
      booking: emptyBooking(),
      answer: "",
    }

    const conversation =
      validMessages
        .slice(-20)
        .map(
          (message) =>
            `${
              message.role === "user"
                ? "BENUTZER"
                : "JARVIS"
            }: ${message.content}`,
        )
        .join("\n")

    if (apiKey) {
      const bookingPrompt = `
Du bist JARVIS von MB-Performance.

Der Benutzer möchte einen Werkstatttermin erstellen.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

Terminzeiten:
15:00 bis 22:00 Uhr.

Bereits direkt erkannte Daten:

${JSON.stringify(
  booking,
  null,
  2,
)}

Diese Daten haben höchste Priorität.

Du darfst niemals bereits vorhandene Daten löschen.

Erkenne zusätzliche Informationen aus dem Chat.

Keine Daten erfinden.

Chat:

${conversation}

Letzte Nachricht:

${lastUserText}

Gib ausschließlich gültiges JSON zurück:

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
`

      const gemini =
        await askGemini(
          bookingPrompt,
        )

      // =================================================
      // RATE LIMIT
      // =================================================

      if (gemini.rateLimited) {
        return NextResponse.json({
          answer:
            getTiredMessage(),

          bookingCreated: false,

          bookingInProgress: true,

          bookingData: booking,

          fallbackMode: true,

          geminiRateLimited: true,
        })
      }

      if (gemini.text) {
        try {
          analysis =
            parseGeminiResponse(
              gemini.text,
            )
        } catch (error) {
          console.warn(
            "Gemini Booking Parsing fehlgeschlagen:",
            error,
          )
        }
      }
    }

    // =================================================
    // GEMINI + DIREKTE DATEN
    // =================================================

    booking =
      mergeBookingData(
        booking,
        analysis.booking,
      )

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
        booking,
      )

    booking =
      mergeBookingData(
        booking,
        directData,
      )

    // =================================================
    // DATUM VALIDIEREN
    // =================================================

    if (
      booking.booking_date &&
      !isValidDate(
        booking.booking_date,
      )
    ) {
      booking.booking_date = null
    }

    // =================================================
    // UHRZEIT VALIDIEREN
    // =================================================

    if (
      booking.booking_time &&
      !isValidTime(
        booking.booking_time,
      )
    ) {
      booking.booking_time = null
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

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_date: null,
        },

        missing: "booking_date",

        fallbackMode: false,
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

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,

        missing,

        fallbackMode: false,
      })
    }

    // =================================================
    // UHRZEIT PRÜFEN
    // =================================================

    if (
      !isValidTime(
        booking.booking_time,
      )
    ) {
      return NextResponse.json({
        answer:
          "Diese Uhrzeit ist nicht möglich. Termine sind zwischen 15:00 und 22:00 Uhr möglich. Welche Uhrzeit möchtest du?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing: "booking_time",

        fallbackMode: false,
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

          bookingInProgress: true,

          bookingData: booking,
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // TERMIN BEREITS BELEGT?
    // =================================================

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

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing: "booking_time",

        fallbackMode: false,
      })
    }

    // =================================================
    // TERMIN ERSTELLEN
    // =================================================

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

          bookingInProgress: true,

          bookingData: booking,
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
      const errorText =
        result.error || ""

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

          bookingCreated: false,

          bookingInProgress: true,

          bookingData: {
            ...booking,
            booking_time: null,
          },

          missing: "booking_time",

          fallbackMode: false,
        })
      }

      return NextResponse.json({
        answer:
          `Ich konnte den Termin leider nicht erstellen. ${
            errorText ||
            "Bitte versuche es erneut."
          }`,

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,

        fallbackMode: false,
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

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${timeText} Uhr für ${booking.car}. Dein Anliegen: ${booking.problem}. Der Termin wurde als Anfrage eingetragen.`,

      bookingCreated: true,

      bookingId:
        result.bookingId,

      bookingData:
        emptyBooking(),

      bookingInProgress: false,

      fallbackMode: false,
    })
  } catch (error) {
    console.error(
      "JARVIS CHAT ERROR:",
      error,
    )

    return NextResponse.json({
      answer:
        "Ich konnte deine Anfrage gerade nicht vollständig verarbeiten. Bitte versuche es erneut.",

      bookingCreated: false,

      bookingInProgress: false,

      bookingData:
        emptyBooking(),

      fallbackMode: true,
    })
  }
}
