import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
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
  process.env.GEMINI_MODEL || "gemini-2.5-flash"

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

type BookingState = {
  active: boolean
  data: BookingData
}

// =====================================================
// EMPTY BOOKING
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

// =====================================================
// ZÜRICH DATUM
// =====================================================

function getZurichDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// =====================================================
// ZÜRICH DATUM + ZEIT
// =====================================================

function getZurichDateTime() {
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
  value: unknown,
): BookingData {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_BOOKING }
  }

  const data = value as Partial<BookingData>

  return {
    booking_date:
      typeof data.booking_date === "string"
        ? data.booking_date
        : null,

    booking_time:
      typeof data.booking_time === "string"
        ? data.booking_time
        : null,

    name:
      typeof data.name === "string"
        ? data.name
        : null,

    phone:
      typeof data.phone === "string"
        ? data.phone
        : null,

    email:
      typeof data.email === "string"
        ? data.email
        : null,

    car:
      typeof data.car === "string"
        ? data.car
        : null,

    problem:
      typeof data.problem === "string"
        ? data.problem
        : null,
  }
}

// =====================================================
// BOOKING MERGEN
// =====================================================

function mergeBooking(
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
// JSON CLEAN
// =====================================================

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

// =====================================================
// DATUM ERKENNEN
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
// DATE NORMALIZE
// =====================================================

function normalizeDate(
  text: string,
  today: string,
): string | null {
  const value = text
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] = today.split("-").map(Number)

  // morgen

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

  // übermorgen

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

  // DD.MM.YYYY

  const numeric = value.match(
    /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
  )

  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])

    let year = numeric[3]
      ? Number(numeric[3])
      : currentYear

    if (year < 100) {
      year += 2000
    }

    if (
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
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

  // 18. Oktober

  const monthNames = Object.keys(MONTHS).join("|")

  const named = value.match(
    new RegExp(
      `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
      "i",
    ),
  )

  if (named) {
    const day = Number(named[1])

    const month =
      MONTHS[named[2].toLowerCase()]

    const year = named[3]
      ? Number(named[3])
      : currentYear

    if (
      month &&
      day >= 1 &&
      day <= 31
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

  return null
}

// =====================================================
// ZEIT ERKENNEN
// =====================================================

function normalizeTime(
  text: string,
): string | null {
  const value = text
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim()

  // halb 8 = 19:30

  const half = value.match(
    /\bhalb\s+(\d{1,2})\b/,
  )

  if (half) {
    let hour =
      Number(half[1]) - 1

    if (hour < 12) {
      hour += 12
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

  // 20 Uhr

  const hour = value.match(
    /\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/,
  )

  if (hour) {
    let h = Number(hour[1])

    const minute = Number(
      hour[2] || "0",
    )

    if (
      value.includes("abends") &&
      h >= 1 &&
      h <= 12
    ) {
      h += 12
    }

    if (
      h >= 15 &&
      h <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(h).padStart(
        2,
        "0",
      )}:${String(minute).padStart(
        2,
        "0",
      )}`
    }
  }

  // 20:00

  const numeric = value.match(
    /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
  )

  if (numeric) {
    const h = Number(numeric[1])
    const minute = Number(numeric[2])

    if (
      h >= 15 &&
      h <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(h).padStart(
        2,
        "0",
      )}:${String(minute).padStart(
        2,
        "0",
      )}`
    }
  }

  // nur 20

  const onlyHour = value.match(
    /^(?:um\s*)?(\d{1,2})$/,
  )

  if (onlyHour) {
    const h = Number(onlyHour[1])

    if (
      h >= 15 &&
      h <= 22
    ) {
      return `${String(h).padStart(
        2,
        "0",
      )}:00`
    }
  }

  return null
}

// =====================================================
// TERMINWUNSCH ERKENNEN
// =====================================================

function containsBookingIntent(
  text: string,
) {
  const value =
    text.toLowerCase()

  const patterns = [
    "termin machen",
    "termin erstellen",
    "termin buchen",
    "termin vereinbaren",
    "werkstatttermin",
    "termin bei euch",
    "termin bei euch machen",
    "einen termin",
    "einen termin machen",
    "einen termin buchen",
    "einen termin vereinbaren",
    "ich möchte einen termin",
    "ich brauche einen termin",
    "ich will einen termin",
    "ich hätte gerne einen termin",
    "buchung",
    "reservieren",
  ]

  return patterns.some(
    (pattern) =>
      value.includes(pattern),
  )
}

// =====================================================
// MISSING FIELD
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
// FRAGE FÜR BOOKING
// =====================================================

function questionForField(
  field: keyof BookingData,
) {
  switch (field) {
    case "booking_date":
      return "Für welchen Tag möchtest du den Termin?"

    case "booking_time":
      return "Um welche Uhrzeit möchtest du den Termin? Termine sind zwischen 15:00 und 22:00 Uhr möglich."

    case "name":
      return "Wie ist dein Name?"

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
// EMAIL
// =====================================================

function isValidEmail(
  email: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  )
}

// =====================================================
// DATUM VALIDIEREN
// =====================================================

function isValidDate(
  value: string | null,
) {
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
  ] = value.split("-").map(Number)

  const date = new Date(
    year,
    month - 1,
    day,
  )

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

// =====================================================
// ZEIT VALIDIEREN
// =====================================================

function isValidTime(
  value: string | null,
) {
  if (!value) {
    return false
  }

  const match =
    /^(\d{2}):(\d{2})$/.exec(
      value,
    )

  if (!match) {
    return false
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

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
) {
  const [
    year,
    month,
    day,
  ] = value.split("-")

  return `${day}.${month}.${year}`
}

// =====================================================
// GEMINI
// =====================================================

async function askGemini(
  messages: ChatMessage[],
  booking: BookingData,
) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt.",
    )
  }

  const ai = new GoogleGenAI({
    apiKey,
  })

  /*
   * WICHTIG:
   *
   * Gemini bekommt die komplette Konversation.
   *
   * Dadurch kann JARVIS Fragen wie:
   *
   * "Was ist ein BMW M4?"
   *
   * danach:
   *
   * "Wie viel PS hat er?"
   *
   * verstehen.
   */

  const conversation =
    messages
      .map(
        (msg) =>
          `${
            msg.role === "user"
              ? "BENUTZER"
              : "JARVIS"
          }: ${msg.content}`,
      )
      .join("\n\n")

  const prompt = `
Du bist JARVIS, der intelligente KI-Assistent von MB-Performance.

Du bist KEIN reiner Termin-Assistent.

Du sollst dich wie eine normale moderne KI verhalten.

--------------------------------------------------
DEINE AUFGABE
--------------------------------------------------

Beantworte normale Fragen ganz normal.

Du kannst zum Beispiel Fragen beantworten über:

- Autos
- BMW
- Mercedes
- Technik
- Computer
- Programmierung
- Alltag
- Wissenschaft
- Mathematik
- Geschichte
- allgemeines Wissen
- MB-Performance
- Reparaturen
- Wartung
- Diagnose

Wenn du etwas nicht sicher weißt, sag ehrlich, dass du es nicht sicher weißt.

Erfinde keine Fakten.

--------------------------------------------------
KONVERSATION
--------------------------------------------------

Beziehe dich auf vorherige Nachrichten.

Wenn der Benutzer sagt:

"Was ist ein BMW M4?"

und danach:

"Wie viel PS hat er?"

verstehe, dass "er" den BMW M4 meint.

Wenn der Benutzer fragt:

"Und wie schnell?"

beziehe dich weiterhin auf den BMW M4.

Du sollst die Konversation natürlich fortführen.

--------------------------------------------------
TERMIN
--------------------------------------------------

Nur wenn der Benutzer tatsächlich einen Termin möchte,
soll das Buchungssystem verwendet werden.

Beispiele:

"Ich möchte einen Termin."

"Ich möchte morgen einen Termin."

"Kann ich einen Werkstatttermin machen?"

"Ich möchte mein Auto am Freitag bringen."

Dann ist es ein Terminwunsch.

Eine normale Frage über Autos ist KEIN Terminwunsch.

Beispiele:

"Was ist ein BMW M4?"

"Wie viel PS hat ein M3?"

"Was kostet ein Ölwechsel?"

"Was bedeutet Motorkontrollleuchte?"

Diese Fragen müssen NORMAL beantwortet werden.

--------------------------------------------------
WICHTIG
--------------------------------------------------

Der bisherige Booking-Zustand darf NICHT automatisch bedeuten,
dass die aktuelle Nachricht ein Terminwunsch ist.

Nur wenn die aktuelle Unterhaltung eindeutig einen Termin betrifft,
soll booking verwendet werden.

--------------------------------------------------
AKTUELLES DATUM
--------------------------------------------------

${getZurichDate()}

--------------------------------------------------
AKTUELLE ZEIT
--------------------------------------------------

${getZurichDateTime()}

Zeitzone:
Europe/Zurich

--------------------------------------------------
AKTUELLER BOOKING-ZUSTAND
--------------------------------------------------

${JSON.stringify(
  booking,
  null,
  2,
)}

--------------------------------------------------
ANTWORT
--------------------------------------------------

Antworte als normale KI.

Keine JSON-Antwort.

Kein Markdown-JSON.

Keine Analyse.

Nur die eigentliche Antwort an den Benutzer.

--------------------------------------------------
KONVERSATION
--------------------------------------------------

${conversation}
`

  const response =
    await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    })

  return (
    response.text?.trim() ||
    "Ich konnte leider keine Antwort erzeugen."
  )
}

// =====================================================
// GEMINI BOOKING ANALYSE
// =====================================================

async function analyzeBooking(
  messages: ChatMessage[],
  booking: BookingData,
) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt.",
    )
  }

  const ai = new GoogleGenAI({
    apiKey,
  })

  const conversation =
    messages
      .map(
        (msg) =>
          `${
            msg.role === "user"
              ? "BENUTZER"
              : "JARVIS"
          }: ${msg.content}`,
      )
      .join("\n")

  const prompt = `
Du bist für die Terminaufnahme von MB-Performance zuständig.

Der Benutzer möchte einen Werkstatttermin buchen.

Extrahiere nur Informationen, die der Benutzer tatsächlich genannt hat.

Bereits vorhandene Informationen dürfen NICHT verloren gehen.

AKTUELLER BOOKING-ZUSTAND:

${JSON.stringify(
  booking,
  null,
  2,
)}

AKTUELLES DATUM:

${getZurichDate()}

TERMINZEITEN:

15:00 bis 22:00 Uhr.

Uhrzeiten:

20 Uhr = 20:00
8 Uhr abends = 20:00
halb 8 = 19:30
20:00 = 20:00

Datum:

morgen = morgiges Datum
übermorgen = übermorgiges Datum

Antworte ausschließlich mit gültigem JSON.

Format:

{
  "booking_date": "YYYY-MM-DD oder null",
  "booking_time": "HH:MM oder null",
  "name": "oder null",
  "phone": "oder null",
  "email": "oder null",
  "car": "oder null",
  "problem": "oder null"
}

KONVERSATION:

${conversation}
`

  const response =
    await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 500,
        responseMimeType:
          "application/json",
      },
    })

  const text =
    response.text?.trim()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(
      cleanJson(text),
    )
  } catch {
    console.error(
      "BOOKING JSON ERROR:",
      text,
    )

    return {}
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
    // BODY
    // =================================================

    const body =
      await request.json()

    const messages =
      Array.isArray(body?.messages)
        ? body.messages.filter(
            (message: ChatMessage) =>
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
          )
        : []

    if (!messages.length) {
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
    // BOOKING
    // =================================================

    let booking =
      normalizeBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE USER NACHRICHT
    // =================================================

    const lastUserMessage =
      [...messages]
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
    // ENTSCHEIDEND:
    //
    // NUR DIE AKTUELLE NACHRICHT
    // entscheidet über einen neuen
    // Terminwunsch.
    // =================================================

    const explicitBookingIntent =
      containsBookingIntent(
        lastUserText,
      )

    /*
     * Wenn ein Booking bereits aktiv ist,
     * darf die Antwort auf eine Booking-Frage
     * weitergeführt werden.
     *
     * Aber:
     *
     * Ein alter bookingData-Zustand allein
     * startet NICHT mehr automatisch einen
     * Termin.
     */

    const bookingWasAlreadyStarted =
      !!body?.bookingInProgress

    const bookingActive =
      explicitBookingIntent ||
      bookingWasAlreadyStarted

    // =================================================
    // NORMALE KI
    // =================================================

    if (!bookingActive) {
      try {
        const answer =
          await askGemini(
            messages,
            booking,
          )

        return NextResponse.json({
          answer,

          bookingCreated:
            false,

          bookingInProgress:
            false,

          bookingData:
            booking,
        })
      } catch (error) {
        console.error(
          "JARVIS NORMAL CHAT ERROR:",
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
    // BOOKING-DATEN ANALYSIEREN
    // =================================================

    const directDate =
      normalizeDate(
        lastUserText,
        getZurichDate(),
      )

    const directTime =
      normalizeTime(
        lastUserText,
      )

    if (directDate) {
      booking.booking_date =
        directDate
    }

    if (directTime) {
      booking.booking_time =
        directTime
    }

    try {
      const extracted =
        await analyzeBooking(
          messages,
          booking,
        )

      booking =
        mergeBooking(
          booking,
          extracted,
        )
    } catch (error) {
      console.error(
        "BOOKING ANALYSIS ERROR:",
        error,
      )
    }

    // Direkte Erkennung hat Vorrang

    if (directDate) {
      booking.booking_date =
        directDate
    }

    if (directTime) {
      booking.booking_time =
        directTime
    }

    // =================================================
    // DATUM PRÜFEN
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
    // ZEIT PRÜFEN
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

    const today =
      getZurichDate()

    if (
      booking.booking_date &&
      booking.booking_date <
        today
    ) {
      return NextResponse.json({
        answer:
          "Dieser Tag liegt bereits in der Vergangenheit. Welchen zukünftigen Tag möchtest du?",

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          booking_date:
            null,
        },
      })
    }

    // =================================================
    // FEHLENDE DATEN
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
    // EMAIL PRÜFEN
    // =================================================

    if (
      !isValidEmail(
        booking.email!,
      )
    ) {
      return NextResponse.json({
        answer:
          "Die E-Mail-Adresse scheint nicht korrekt zu sein. Wie lautet deine vollständige E-Mail-Adresse?",

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          email: null,
        },

        missing:
          "email",
      })
    }

    // =================================================
    // BELEGTE TERMINE
    // =================================================

    const bookedSlots =
      await getBookedSlots()

    const alreadyBooked =
      bookedSlots.some(
        (slot) =>
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
          booking_time:
            null,
        },

        missing:
          "booking_time",
      })
    }

    // =================================================
    // BUCHUNG ERSTELLEN
    // =================================================

    console.log(
      "JARVIS → CREATE BOOKING",
      booking,
    )

    const result =
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

    // =================================================
    // FEHLER
    // =================================================

    if (!result.ok) {
      console.error(
        "CREATE BOOKING ERROR:",
        result.error,
      )

      return NextResponse.json({
        answer:
          result.error ||
          "Der Termin konnte leider nicht erstellt werden.",

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

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${formatDate(
          booking.booking_date!,
        )} um ${
          booking.booking_time
        } Uhr für ${
          booking.car
        }. Dein Anliegen: ${
          booking.problem
        }. Der Termin wurde als Anfrage eingetragen.`,

      bookingCreated:
        true,

      bookingId:
        result.bookingId,

      bookingData:
        EMPTY_BOOKING,

      bookingInProgress:
        false,
    })
  } catch (error) {
    console.error(
      "JARVIS GLOBAL ERROR:",
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
