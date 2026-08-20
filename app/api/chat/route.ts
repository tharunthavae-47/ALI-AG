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

const modelName =
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

type GeminiBookingResult = {
  booking: BookingData
  answer: string
}

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

function getZurichDateTime() {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date())
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
// BOOKING NORMALISIEREN
// =====================================================

function normalizeBooking(input: unknown): BookingData {
  if (!input || typeof input !== "object") {
    return { ...EMPTY_BOOKING }
  }

  const data = input as Partial<BookingData>

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
// ZEIT ERKENNEN
// =====================================================

function normalizeTime(text: string): string | null {
  const value = text
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim()

  // halb 8 = 19:30
  const halb = value.match(
    /\bhalb\s+(\d{1,2})\b/,
  )

  if (halb) {
    let hour = Number(halb[1]) - 1

    if (hour < 12) {
      hour += 12
    }

    if (hour >= 15 && hour <= 22) {
      return `${String(hour).padStart(2, "0")}:30`
    }
  }

  // 8 Uhr abends
  const hourMatch = value.match(
    /\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/,
  )

  if (hourMatch) {
    let hour = Number(hourMatch[1])

    const minute = Number(
      hourMatch[2] || "0",
    )

    if (
      value.includes("abends") &&
      hour >= 1 &&
      hour <= 12
    ) {
      hour += 12
    }

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(2, "0")}:${String(
        minute,
      ).padStart(2, "0")}`
    }
  }

  // 20:00 / 20.00
  const numeric = value.match(
    /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
  )

  if (numeric) {
    const hour = Number(numeric[1])
    const minute = Number(numeric[2])

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(2, "0")}:${String(
        minute,
      ).padStart(2, "0")}`
    }
  }

  return null
}

// =====================================================
// DATUM ERKENNEN
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

  // 18.10.2026
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
      return `${String(year).padStart(4, "0")}-${String(
        month,
      ).padStart(2, "0")}-${String(day).padStart(
        2,
        "0",
      )}`
    }
  }

  // 18. Oktober
  const monthNames =
    Object.keys(MONTHS).join("|")

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
      return `${String(year).padStart(4, "0")}-${String(
        month,
      ).padStart(2, "0")}-${String(day).padStart(
        2,
        "0",
      )}`
    }
  }

  return null
}

// =====================================================
// DIREKTE DATEN
// =====================================================

function extractBookingData(
  text: string,
  today: string,
): Partial<BookingData> {
  const result: Partial<BookingData> = {}

  const time = normalizeTime(text)

  if (time) {
    result.booking_time = time
  }

  const date = normalizeDate(
    text,
    today,
  )

  if (date) {
    result.booking_date = date
  }

  return result
}

// =====================================================
// TERMIN-ABSICHT
// =====================================================

function containsBookingIntent(
  text: string,
): boolean {
  const value = text.toLowerCase()

  const patterns = [
    /\btermin\b/,
    /\bwerkstatttermin\b/,
    /\bbuchen\b/,
    /\btermin buchen\b/,
    /\btermin machen\b/,
    /\btermin erstellen\b/,
    /\btermin vereinbaren\b/,
    /\bvereinbaren\b/,
    /\breservieren\b/,
    /\bbuchung\b/,
  ]

  return patterns.some((pattern) =>
    pattern.test(value),
  )
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
// FRAGE
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
// GEMINI
// =====================================================

async function callGemini(
  prompt: string,
): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt.",
    )
  }

  const ai = new GoogleGenAI({
    apiKey,
  })

  const response =
    await ai.models.generateContent({
      model: modelName,

      contents: prompt,

      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    })

  return response.text?.trim() || ""
}

// =====================================================
// GEMINI BOOKING EXTRACTION
// =====================================================

async function extractBookingWithGemini(
  conversation: string,
  booking: BookingData,
  lastUserMessage: string,
  currentDate: string,
): Promise<GeminiBookingResult> {
  const prompt = `
Du bist JARVIS von MB-Performance.

Du sollst NUR die Daten für einen Werkstatttermin
aus der Unterhaltung erkennen.

Aktuelles Datum:
${currentDate}

Bereits bekannte Daten:
${JSON.stringify(
  booking,
  null,
  2,
)}

Letzte Nachricht:
${lastUserMessage}

Gesamte Unterhaltung:
${conversation}

WICHTIG:

Erfinde niemals Daten.

Bereits bekannte Daten dürfen nicht verloren gehen.

Wenn der Benutzer zum Beispiel vorher gesagt hat:

"Mein Name ist Max"

und später:

"Ich möchte morgen um 18 Uhr kommen"

müssen Name, Datum und Uhrzeit erhalten bleiben.

Datum:

"morgen" muss in ein echtes YYYY-MM-DD Datum
umgewandelt werden.

"18. Oktober" muss in YYYY-MM-DD umgewandelt werden.

Uhrzeit:

"20 Uhr" = "20:00"

"18 Uhr" = "18:00"

"20:30" = "20:30"

"halb 8" = "19:30"

Antworte ausschließlich mit diesem JSON:

{
  "booking_date": "YYYY-MM-DD" oder null,
  "booking_time": "HH:MM" oder null,
  "name": "..." oder null,
  "phone": "..." oder null,
  "email": "..." oder null,
  "car": "..." oder null,
  "problem": "..." oder null
}
`

  const raw = await callGemini(prompt)

  const parsed = JSON.parse(
    cleanJson(raw),
  )

  return {
    booking: normalizeBooking(parsed),
    answer: "",
  }
}

// =====================================================
// NORMALE GEMINI ANTWORT
// =====================================================

async function answerNormally(
  conversation: string,
  currentDateTime: string,
): Promise<string> {
  const prompt = `
Du bist JARVIS, der intelligente KI-Assistent
von MB-Performance.

Du kommunizierst natürlich auf Deutsch.

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Du darfst normale Fragen beantworten.

Beispiele:

- Was ist ein BMW M4?
- Was ist ein Turbolader?
- Wie funktioniert ein Motor?
- Wie viel PS hat ein BMW M4?
- Was bedeutet MFK?
- Was ist ein Ölwechsel?
- Erkläre mir ABS.
- Was ist der Unterschied zwischen BMW M3 und M4?
- Allgemeine Fragen über Autos
- Allgemeine Wissensfragen
- Smalltalk

WICHTIG:

Der Benutzer möchte NICHT automatisch einen Termin,
nur weil er über ein Auto, eine Reparatur,
eine Diagnose oder MB-Performance spricht.

Nur wenn der Benutzer ausdrücklich einen Termin
vereinbaren oder buchen möchte, soll der
Termin-Workflow verwendet werden.

Antworte direkt und natürlich.

Du bist kein Formular.

Frage nicht automatisch nach:
Datum,
Uhrzeit,
Name,
Telefon,
E-Mail

wenn der Benutzer keinen Termin möchte.

Wenn Informationen aus der bisherigen Unterhaltung
relevant sind, benutze sie.

GESAMTE KONVERSATION:

${conversation}

Beantworte die letzte Nachricht des Benutzers.
`

  return await callGemini(prompt)
}

// =====================================================
// DATUM VALIDIEREN
// =====================================================

function isValidDate(
  value: string | null,
) {
  if (!value) return false

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  return !Number.isNaN(
    date.getTime(),
  )
}

// =====================================================
// ZEIT VALIDIEREN
// =====================================================

function isValidTime(
  value: string | null,
) {
  if (!value) return false

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hour, minute] =
    value.split(":").map(Number)

  return (
    hour >= 15 &&
    hour <= 22 &&
    minute >= 0 &&
    minute <= 59
  )
}

// =====================================================
// DATUM FORMAT
// =====================================================

function formatDate(
  value: string,
) {
  const [year, month, day] =
    value.split("-")

  return `${day}.${month}.${year}`
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
            "GEMINI_API_KEY fehlt in Vercel.",
        },
        { status: 500 },
      )
    }

    // =================================================
    // BODY
    // =================================================

    const body = await request.json()

    const messages =
      body?.messages as ChatMessage[]

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Keine Chatnachrichten erhalten.",
        },
        { status: 400 },
      )
    }

    // =================================================
    // NUR GÜLTIGE MESSAGES
    // =================================================

    const validMessages =
      messages.filter(
        (message) =>
          message &&
          (
            message.role === "user" ||
            message.role === "assistant"
          ) &&
          typeof message.content ===
            "string" &&
          message.content.trim().length > 0,
      )

    if (validMessages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine gültigen Nachrichten.",
        },
        { status: 400 },
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
    // BOOKING VOM CLIENT
    // =================================================

    let booking =
      normalizeBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE USER MESSAGE
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
    // KONVERSATION
    // =================================================

    const conversation =
      validMessages
        .map(
          (message) =>
            `${
              message.role === "user"
                ? "BENUTZER"
                : "JARVIS"
            }: ${message.content}`,
        )
        .join("\n")

    // =================================================
    // GANZ WICHTIG
    //
    // TERMIN NUR WENN DER BENUTZER
    // WIRKLICH EINEN TERMIN WILL
    // =================================================

    const bookingIntent =
      containsBookingIntent(
        lastUserText,
      )

    console.log(
      "JARVIS LAST USER:",
      lastUserText,
    )

    console.log(
      "JARVIS BOOKING INTENT:",
      bookingIntent,
    )

    // =================================================
    // NORMALE FRAGE
    // =================================================

    if (!bookingIntent) {
      try {
        const answer =
          await answerNormally(
            conversation,
            currentDateTime,
          )

        return NextResponse.json({
          answer:
            answer ||
            "Natürlich. Wie kann ich dir helfen?",

          bookingCreated: false,

          bookingInProgress: false,

          bookingData: booking,
        })
      } catch (error) {
        console.error(
          "NORMAL GEMINI ERROR:",
          error,
        )

        return NextResponse.json(
          {
            error:
              "Entschuldigung, ich konnte deine Frage gerade nicht verarbeiten.",
          },
          { status: 500 },
        )
      }
    }

    // =================================================
    // TERMIN-DATEN DIREKT ERKENNEN
    // =================================================

    const directData =
      extractBookingData(
        lastUserText,
        currentDate,
      )

    booking = mergeBooking(
      booking,
      directData,
    )

    // =================================================
    // GEMINI TERMIN-DATEN
    // =================================================

    try {
      const extracted =
        await extractBookingWithGemini(
          conversation,
          booking,
          lastUserText,
          currentDate,
        )

      booking = mergeBooking(
        booking,
        extracted.booking,
      )
    } catch (error) {
      console.error(
        "BOOKING GEMINI EXTRACTION ERROR:",
        error,
      )

      // Direkt erkannte Daten bleiben erhalten.
    }

    // =================================================
    // DIREKTE ERKENNUNG HAT PRIORITÄT
    // =================================================

    if (directData.booking_date) {
      booking.booking_date =
        directData.booking_date
    }

    if (directData.booking_time) {
      booking.booking_time =
        directData.booking_time
    }

    console.log(
      "JARVIS BOOKING:",
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

    if (
      booking.booking_date &&
      booking.booking_date < currentDate
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
      })
    }

    // =================================================
    // FEHLENDES FELD
    // =================================================

    const missing =
      getMissingField(booking)

    if (missing) {
      return NextResponse.json({
        answer:
          questionForField(missing),

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,

        missing,
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

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing: "booking_time",
      })
    }

    // =================================================
    // BOOKING ERSTELLEN
    // =================================================

    const result =
      await createBooking({
        booking_date:
          booking.booking_date!,

        booking_time:
          booking.booking_time!,

        name: booking.name!,

        phone: booking.phone!,

        email: booking.email!,

        car: booking.car!,

        problem: booking.problem!,
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
          `Ich konnte den Termin leider nicht erstellen. ${
            result.error ||
            "Bitte versuche es erneut."
          }`,

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,
      })
    }

    // =================================================
    // ERFOLG
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

      bookingCreated: true,

      bookingId:
        result.bookingId,

      bookingData:
        EMPTY_BOOKING,

      bookingInProgress: false,
    })
  } catch (error) {
    console.error(
      "JARVIS GLOBAL ERROR:",
      error,
    )

    return NextResponse.json(
      {
        error:
          "Entschuldigung, ich konnte deine Frage gerade nicht verarbeiten.",
      },
      { status: 500 },
    )
  }
}
