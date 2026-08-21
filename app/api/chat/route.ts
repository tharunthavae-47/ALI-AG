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

function normalizeText(text: string): string {
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
    text.replace(/,/g, " "),
  )

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] = today
    .split("-")
    .map(Number)

  // MORGEN

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

  // ÜBERMORGEN

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

  // HEUTE

  if (/\bheute\b/.test(value)) {
    return today
  }

  // NUMERISCHES DATUM

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

  // NAMENSDATUM

  const monthNames =
    Object.keys(MONTHS).join("|")

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
    text.replace(/,/g, "."),
  )

  // HALB 8 = 19:30

  const halbMatch =
    value.match(
      /\bhalb\s+(\d{1,2})\b/,
    )

  if (halbMatch) {
    let hour =
      Number(halbMatch[1])

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

  // 20 UHR

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

  // 20:00 / 20.00

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

  // NUR STUNDE

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
// E-MAIL DIREKT ERKENNEN
// =====================================================

function extractEmail(
  text: string,
): string | null {
  const match =
    text.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    )

  return match
    ? match[0].trim()
    : null
}

// =====================================================
// TELEFONNUMMER DIREKT ERKENNEN
// =====================================================

function extractPhone(
  text: string,
): string | null {
  const matches =
    text.match(
      /(?:\+41|0041|0)\s*(?:\(?\d{2}\)?[\s.-]*)?(?:\d[\s.-]*){6,}/g,
    )

  if (!matches?.length) {
    return null
  }

  for (const match of matches) {
    const digits =
      match.replace(
        /\D/g,
        "",
      )

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

    // Schweizer Nummern:
    // 0XXXXXXXXX = 10 Stellen

    if (
      /^0\d{9}$/.test(
        normalized,
      )
    ) {
      return normalized
    }
  }

  return null
}

// =====================================================
// NAMEN ERKENNEN
// =====================================================

function extractFullName(
  text: string,
): string | null {
  let value =
    text.trim()

  if (!value) {
    return null
  }

  // E-Mail / Telefonnummern / Satzzeichen
  // aus dem Text entfernen

  value =
    value
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        " ",
      )
      .replace(
        /(?:\+41|0041|0)\s*(?:\(?\d{2}\)?[\s.-]*)?(?:\d[\s.-]*){6,}/g,
        " ",
      )
      .replace(
        /[,:;.!?]+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()

  // Typische Formulierungen entfernen

  value =
    value.replace(
      /^(?:mein\s+name\s+ist|mein\s+name\s+lautet|ich\s+heiße|ich\s+heisse|name\s+ist|ich\s+bin)\s+/i,
      "",
    ).trim()

  if (!value) {
    return null
  }

  const parts =
    value.split(/\s+/)

  // Mindestens Vor- UND Nachname

  if (
    parts.length < 2 ||
    parts.length > 5
  ) {
    return null
  }

  // Nur echte Namenszeichen

  const valid =
    parts.every((part) =>
      /^[A-Za-zÄÖÜäöüÀ-ÖØ-öø-ÿ'’\-]+$/.test(
        part,
      ),
    )

  if (!valid) {
    return null
  }

  // Wörter, die eindeutig kein Name sind

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
    "termins",
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
    "morgen",
    "bitte",
    "telefon",
    "nummer",
    "email",
    "e-mail",
  ]

  const containsBlockedWord =
    parts.some(
      (part) =>
        blockedWords.includes(
          part.toLowerCase(),
        ),
    )

  if (
    containsBlockedWord
  ) {
    return null
  }

  // Der Name wird bewusst normalisiert:
  // Max Mustermann
  // nicht:
  // max mustermann

  return parts
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ")
}

// =====================================================
// FAHRZEUG DIREKT ERKENNEN
// =====================================================

function extractCar(
  text: string,
): string | null {
  const value =
    text.trim()

  // Explizite Formulierungen

  const explicit =
    value.match(
      /(?:mein\s+|das\s+|fahrzeug(?:\s+ist)?\s+|auto(?:\s+ist)?\s+|wagen(?:\s+ist)?\s+)([A-Za-zÄÖÜäöü0-9][A-Za-zÄÖÜäöü0-9 .+\-\/]{1,50}?)(?=\s+(?:hat|macht|braucht|benötigt|benoetigt|soll|muss|wegen|mit|und|für|fuer)\b|[,.!?]|$)/i,
    )

  if (explicit?.[1]) {
    const car =
      explicit[1]
        .trim()
        .replace(/\s+/g, " ")

    if (
      car.length >= 2 &&
      car.length <= 50
    ) {
      return car
    }
  }

  // Bekannte Hersteller direkt erkennen

  const brands =
    [
      "BMW",
      "Mercedes",
      "Mercedes-Benz",
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
      "Alfa Romeo",
      "Tesla",
      "Hyundai",
      "Kia",
      "Land Rover",
      "Range Rover",
      "Jaguar",
      "Mini",
      "Mitsubishi",
      "Suzuki",
    ]

  const brandPattern =
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
        `\\b(${brandPattern})\\b(?:\\s+([A-Za-z0-9ÄÖÜäöü+\\-./]{1,20}(?:\\s+[A-Za-z0-9ÄÖÜäöü+\\-./]{1,20})?))?`,
        "i",
      ),
    )

  if (brandMatch) {
    const brand =
      brandMatch[1]

    const model =
      brandMatch[2]
        ? brandMatch[2]
            .trim()
        : ""

    const forbiddenModelWords = [
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

    const modelParts =
      model.split(/\s+/)

    const cleanModel =
      modelParts
        .filter(
          (part) =>
            !forbiddenModelWords.includes(
              part.toLowerCase(),
            ),
        )
        .join(" ")

    return cleanModel
      ? `${brand} ${cleanModel}`
      : brand
  }

  return null
}

// =====================================================
// ANLIEGEN DIREKT ERKENNEN
// =====================================================

function extractProblem(
  text: string,
): string | null {
  const value =
    text.trim()

  // Explizite Formulierungen

  const explicit =
    value.match(
      /(?:problem(?:\s+ist)?|anliegen(?:\s+ist)?|grund(?:\s+ist)?|es\s+geht\s+um|ich\s+brauche\s+wegen|ich\s+möchte\s+wegen)\s*[:\-]?\s*(.+)$/i,
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

  // Häufige Werkstatt-Themen

  const keywords = [
    "ölwechsel",
    "oelwechsel",
    "inspektion",
    "wartung",
    "service",
    "bremsen",
    "bremsenwechsel",
    "bremsbeläge",
    "bremsbelaege",
    "reifenwechsel",
    "reifen",
    "reifenservice",
    "diagnose",
    "fehlerdiagnose",
    "motor",
    "motorproblem",
    "getriebe",
    "kupplung",
    "batterie",
    "lichtmaschine",
    "klimaanlage",
    "klima",
    "auspuff",
    "fahrwerk",
    "tieferlegung",
    "tuning",
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
        lower.includes(
          keyword,
        ),
    )

  if (found) {
    // Wenn der Benutzer einen ganzen Satz schreibt,
    // verwenden wir den gesamten Satz als Anliegen.

    if (
      value.length <= 200
    ) {
      return value
        .replace(
          /^[,.\s]+|[,.\s]+$/g,
          "",
        )
    }

    return found
  }

  return null
}

// =====================================================
// DIREKTE BOOKING-DATEN
// =====================================================

function extractDirectBookingData(
  text: string,
  today: string,
  currentBooking: BookingData,
): Partial<BookingData> {
  const result: Partial<BookingData> = {}

  // ---------------------------------------------------
  // DATUM
  // ---------------------------------------------------

  const date =
    normalizeDate(
      text,
      today,
    )

  if (date) {
    result.booking_date = date
  }

  // ---------------------------------------------------
  // UHRZEIT
  // ---------------------------------------------------

  const time =
    normalizeTime(text)

  if (time) {
    result.booking_time = time
  }

  // ---------------------------------------------------
  // E-MAIL
  // ---------------------------------------------------

  const email =
    extractEmail(text)

  if (email) {
    result.email = email
  }

  // ---------------------------------------------------
  // TELEFON
  // ---------------------------------------------------

  const phone =
    extractPhone(text)

  if (phone) {
    result.phone = phone
  }

  // ---------------------------------------------------
  // NAME
  // ---------------------------------------------------

  // Name wird unabhängig von Gemini erkannt.
  //
  // Wichtig:
  // Wir ersetzen keinen bereits gespeicherten Namen,
  // wenn in der Nachricht kein sicherer Name steht.

  if (!currentBooking.name) {
    const name =
      extractFullName(text)

    if (name) {
      result.name = name
    }
  }

  // ---------------------------------------------------
  // FAHRZEUG
  // ---------------------------------------------------

  if (!currentBooking.car) {
    const car =
      extractCar(text)

    if (car) {
      result.car = car
    }
  }

  // ---------------------------------------------------
  // ANLIEGEN
  // ---------------------------------------------------

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
    date.getUTCMonth() ===
      month - 1 &&
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
  } catch {
    console.error(
      "GEMINI INVALID JSON:",
      cleaned,
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
    // GÜLTIGE NACHRICHTEN
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
    // DATUM
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
    // BOOKING-MODUS ERKENNEN
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
    // DIREKTE DATENERKENNUNG
    // =================================================

    // Diese Erkennung läuft komplett
    // unabhängig von Gemini.

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

      console.log(
        "====================================",
      )

      console.log(
        "JARVIS DIRECT EXTRACTION",
      )

      console.log(
        "USER:",
        lastUserText,
      )

      console.log(
        "DIRECT DATA:",
        directData,
      )

      console.log(
        "BOOKING:",
        booking,
      )

      console.log(
        "====================================",
      )
    }

    // =================================================
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

Sprache:
Deutsch.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

Der Benutzer hat aktuell NICHT nach einem Werkstatttermin gefragt.

Deshalb:

- Starte keine Buchung.
- Frage nicht nach Name.
- Frage nicht nach Telefonnummer.
- Frage nicht nach E-Mail.
- Frage nicht nach Fahrzeugdaten.
- Frage nicht nach Datum.
- Frage nicht nach Uhrzeit.
- Antworte natürlich auf die eigentliche Frage.
- Wenn der Benutzer über BMW, Mercedes, Reparaturen, Motoren, Tuning oder andere Autothemen fragt, antworte hilfreich.
- Erfinde keine Fakten.
- Wenn du etwas nicht sicher weißt, sage es ehrlich.
- Antworte möglichst direkt.

Bisheriger Chat:

${conversation}

Letzte Nachricht:

${lastUserText}

Gib ausschließlich gültiges JSON zurück:

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
          "JARVIS CHAT ERROR:",
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
    // GEMINI ZUR ZUSÄTZLICHEN DATENERKENNUNG
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

Deine Aufgabe:

1. Bereits genannte Kundendaten erkennen.
2. Neue Kundendaten erkennen.
3. Bereits vorhandene Daten NICHT löschen.
4. Keine Daten erfinden.

WICHTIG:

Die folgenden Daten wurden bereits unabhängig von dir direkt aus der Benutzernachricht erkannt:

${JSON.stringify(
  booking,
  null,
  2,
)}

Diese direkten Daten haben Vorrang.

Du darfst sie NICHT überschreiben oder auf null setzen.

Insbesondere:

NAME:
Der Name wurde unabhängig von Gemini erkannt.
Wenn dort ein Name steht, muss dieser exakt erhalten bleiben.

TELEFON:
Wenn eine Telefonnummer vorhanden ist, muss sie erhalten bleiben.

E-MAIL:
Wenn eine E-Mail vorhanden ist, muss sie erhalten bleiben.

FAHRZEUG:
Wenn ein Fahrzeug vorhanden ist, muss es erhalten bleiben.

ANLIEGEN:
Wenn ein Anliegen vorhanden ist, muss es erhalten bleiben.

DATUM:
16.10.26 = 2026-10-16

16.10.2026 = 2026-10-16

16 Oktober = aktuelles Jahr, Monat 10, Tag 16.

morgen = morgiges Datum.

übermorgen = zwei Tage nach heute.

UHRZEIT:

20 Uhr = 20:00

20 uhr = 20:00

um 20 Uhr = 20:00

20:00 = 20:00

20.00 = 20:00

halb 8 = 19:30

8 Uhr abends = 20:00

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

      analysis = {
        intent: "booking",

        booking:
          emptyBooking(),

        answer: "",
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

    // =================================================
    // DIREKTE ERKENNUNG HAT IMMER VORRANG
    // =================================================

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
        booking,
      )

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

    if (
      directData.name
    ) {
      booking.name =
        directData.name
    }

    if (
      directData.phone
    ) {
      booking.phone =
        directData.phone
    }

    if (
      directData.email
    ) {
      booking.email =
        directData.email
    }

    if (
      directData.car
    ) {
      booking.car =
        directData.car
    }

    if (
      directData.problem
    ) {
      booking.problem =
        directData.problem
    }

    console.log(
      "====================================",
    )

    console.log(
      "JARVIS FINAL BOOKING:",
      booking,
    )

    console.log(
      "====================================",
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
