import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import {
  createBooking,
  getBookedSlots,
} from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const apiKey = process.env.GEMINI_API_KEY

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

type JarvisAnalysis = {
  intent: "chat" | "booking"
  booking: BookingData
  answer: string
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
// GEMINI
// =====================================================

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
})

// =====================================================
// JSON BEREINIGEN
// =====================================================

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

// =====================================================
// SCHLAFEN
// =====================================================

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  )
}

// =====================================================
// GEMINI MIT RETRY
// =====================================================

async function generateWithRetry(
  prompt: string,
) {
  const models = [
    "gemini-3.1-flash",
    "gemini-3-flash",
  ]

  let lastError: unknown = null

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(
          `JARVIS Gemini Versuch: ${model} / ${attempt + 1}`,
        )

        const response =
          await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 700,
              responseMimeType:
                "application/json",
            },
          })

        return response
      } catch (error) {
        lastError = error

        console.error(
          `GEMINI ERROR ${model} Versuch ${attempt + 1}:`,
          error,
        )

        const errorText =
          error instanceof Error
            ? error.message
            : JSON.stringify(error)

        const retryable =
          errorText.includes("503") ||
          errorText.includes("UNAVAILABLE") ||
          errorText.includes("429") ||
          errorText.includes("RESOURCE_EXHAUSTED") ||
          errorText.includes("500") ||
          errorText.includes("INTERNAL")

        if (!retryable) {
          break
        }

        if (attempt < 2) {
          await sleep(
            1000 * Math.pow(2, attempt),
          )
        }
      }
    }
  }

  throw lastError
}

// =====================================================
// ZÜRICH DATUM
// =====================================================

function getZurichDate() {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date())
}

// =====================================================
// ZÜRICH DATUM + ZEIT
// =====================================================

function getZurichDateTime() {
  return new Intl.DateTimeFormat(
    "de-CH",
    {
      timeZone: "Europe/Zurich",
      dateStyle: "full",
      timeStyle: "short",
    },
  ).format(new Date())
}

// =====================================================
// KONVERSATION
// =====================================================

function buildConversation(
  messages: ChatMessage[],
) {
  return messages
    .map((message) => {
      const role =
        message.role === "assistant"
          ? "JARVIS"
          : "BENUTZER"

      return `${role}: ${message.content}`
    })
    .join("\n\n")
}

// =====================================================
// BOOKING MERGEN
// =====================================================

function mergeBooking(
  oldBooking: BookingData,
  newBooking: Partial<BookingData>,
): BookingData {
  return {
    booking_date:
      newBooking.booking_date ||
      oldBooking.booking_date,

    booking_time:
      newBooking.booking_time ||
      oldBooking.booking_time,

    name:
      newBooking.name ||
      oldBooking.name,

    phone:
      newBooking.phone ||
      oldBooking.phone,

    email:
      newBooking.email ||
      oldBooking.email,

    car:
      newBooking.car ||
      oldBooking.car,

    problem:
      newBooking.problem ||
      oldBooking.problem,
  }
}

// =====================================================
// FEHLENDE FELDER
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

function getQuestion(
  field: keyof BookingData,
) {
  switch (field) {
    case "booking_date":
      return "Für welchen Tag möchtest du den Termin?"

    case "booking_time":
      return "Um welche Uhrzeit möchtest du den Termin? Termine sind zwischen 15:00 und 22:00 Uhr möglich."

    case "name":
      return "Wie lautet dein Name?"

    case "phone":
      return "Welche Telefonnummer soll ich für den Termin hinterlegen?"

    case "email":
      return "Welche E-Mail-Adresse soll ich für die Bestätigung verwenden?"

    case "car":
      return "Welches Fahrzeug hast du? Zum Beispiel BMW M4, Baujahr 2021."

    case "problem":
      return "Was soll an deinem Fahrzeug gemacht oder überprüft werden?"

    default:
      return "Welche Information fehlt noch?"
  }
}

// =====================================================
// DATUM VALIDIEREN
// =====================================================

function isValidDate(
  date: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false
  }

  const [year, month, day] =
    date.split("-").map(Number)

  const test = new Date(
    year,
    month - 1,
    day,
  )

  return (
    test.getFullYear() === year &&
    test.getMonth() === month - 1 &&
    test.getDate() === day
  )
}

// =====================================================
// ZEIT VALIDIEREN
// =====================================================

function isValidTime(
  time: string,
) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return false
  }

  const [hour, minute] =
    time.split(":").map(Number)

  if (
    hour < 15 ||
    hour > 22
  ) {
    return false
  }

  // Nur volle Stunden erlaubt
  // Falls du 18:30 möchtest,
  // kannst du diese Prüfung später ändern.
  if (minute !== 0) {
    return false
  }

  return true
}

// =====================================================
// DATUM FORMATIEREN
// =====================================================

function formatDate(
  date: string,
) {
  const [year, month, day] =
    date.split("-")

  return `${day}.${month}.${year}`
}

// =====================================================
// HAUPT-FUNKTION
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
            "GEMINI_API_KEY fehlt in den Environment Variables.",
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
        {
          status: 400,
        },
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
          message.content.trim(),
      )

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
    // DATUM
    // =================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =================================================
    // VORHERIGE BOOKING DATEN
    // =================================================

    const previousBooking =
      body?.bookingData || EMPTY_BOOKING

    // =================================================
    // KONVERSATION
    // =================================================

    const conversation =
      buildConversation(
        validMessages,
      )

    // =================================================
    // PROMPT
    // =================================================

    const prompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Du sprichst natürliches Deutsch.

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

TERMINZEITEN:
15:00 bis 22:00 Uhr.

DEINE AUFGABE:

Du analysierst den kompletten Chat und erkennst,
ob der Benutzer einen Werkstatttermin erstellen möchte.

WICHTIG:

- Gib ausschließlich gültiges JSON zurück.
- Kein Markdown.
- Keine Erklärungen außerhalb des JSON.
- Erfinde niemals Kundendaten.
- Nur Informationen aus BENUTZER-Nachrichten dürfen als Kundendaten verwendet werden.
- Bereits vorhandene bookingData darf erhalten bleiben.
- Wenn der Benutzer neue Informationen nennt, übernimm sie.
- Wenn Informationen fehlen, setze sie auf null.

DATUM:

Du musst deutsche Datumsangaben verstehen.

Beispiele:

"18 Oktober"
→ ${currentDate.slice(0, 4)}-10-18

"15 September"
→ ${currentDate.slice(0, 4)}-09-15

"morgen"
→ berechne das tatsächliche Datum.

"übermorgen"
→ berechne das tatsächliche Datum.

"nächsten Freitag"
→ berechne den nächsten Freitag.

Wenn ein Datum ohne Jahr genannt wird,
verwende normalerweise das aktuelle Jahr.

ZEIT:

"18 Uhr"
→ "18:00"

"20 Uhr"
→ "20:00"

"halb sieben"
→ "18:30"

"halb acht"
→ "19:30"

"19:00"
→ "19:00"

Der Benutzer darf nur Termine zwischen 15:00 und 22:00 buchen.

DATEN FÜR EINEN TERMIN:

booking_date
booking_time
name
phone
email
car
problem

INTENT:

Wenn der Benutzer einen Termin möchte:
intent = "booking"

Wenn der Benutzer nur eine normale Frage stellt:
intent = "chat"

BEISPIEL:

Benutzer:
"Mach mir einen Termin"

→ booking

Benutzer:
"18 Oktober"

Wenn vorher JARVIS gefragt hat:
"Für welchen Tag möchtest du den Termin?"

→ booking_date = "aktuelles Jahr-10-18"

Benutzer:
"20 Uhr"

→ booking_time = "20:00"

ANTWORT:

Bei normalen Fragen:
answer = natürliche deutsche Antwort

Bei fehlenden Terminangaben:
answer = kurze passende Frage

Wenn alle Terminangaben vorhanden sind:
answer = "TERMIN_BEREIT"

JSON:

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
  "answer": ""
}

BISHERIGE BOOKING-DATEN:

${JSON.stringify(previousBooking)}

BISHERIGER CHAT:

${conversation}

Analysiere jetzt die letzte Benutzernachricht.
`

    // =================================================
    // GEMINI
    // =================================================

    const response =
      await generateWithRetry(
        prompt,
      )

    const raw =
      response.text?.trim() || ""

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "JARVIS hat keine Antwort erhalten.",
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // JSON
    // =================================================

    let parsed: any

    try {
      parsed = JSON.parse(
        cleanJson(raw),
      )
    } catch (error) {
      console.error(
        "GEMINI JSON ERROR:",
        error,
      )

      console.error(
        "GEMINI RAW:",
        raw,
      )

      return NextResponse.json(
        {
          error:
            "JARVIS konnte die Gemini-Antwort nicht verstehen.",
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // NORMALER CHAT
    // =================================================

    if (
      parsed.intent !== "booking"
    ) {
      return NextResponse.json({
        answer:
          typeof parsed.answer ===
          "string"
            ? parsed.answer
            : "Natürlich. Wie kann ich dir helfen?",

        bookingCreated: false,

        bookingInProgress: false,

        bookingData:
          previousBooking,
      })
    }

    // =================================================
    // BOOKING MERGEN
    // =================================================

    const booking =
      mergeBooking(
        previousBooking,
        parsed.booking || {},
      )

    console.log(
      "JARVIS BOOKING:",
      booking,
    )

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
          getQuestion(missing),

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,

        missing,
      })
    }

    // =================================================
    // DATUM PRÜFEN
    // =================================================

    if (
      !isValidDate(
        booking.booking_date!,
      )
    ) {
      return NextResponse.json({
        answer:
          "Das Datum konnte ich nicht richtig erkennen. Für welchen Tag möchtest du den Termin?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_date: null,
        },

        missing:
          "booking_date",
      })
    }

    // =================================================
    // ZEIT PRÜFEN
    // =================================================

    if (
      !isValidTime(
        booking.booking_time!,
      )
    ) {
      return NextResponse.json({
        answer:
          "Diese Uhrzeit ist nicht verfügbar. Termine sind zwischen 15:00 und 22:00 Uhr möglich. Welche Uhrzeit möchtest du?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_time: null,
        },

        missing:
          "booking_time",
      })
    }

    // =================================================
    // VERGANGENHEIT
    // =================================================

    if (
      booking.booking_date! <
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

        missing:
          "booking_date",
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

        missing:
          "booking_time",
      })
    }

    // =================================================
    // TERMIN ERSTELLEN
    // =================================================

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
    // CREATE FEHLER
    // =================================================

    if (!result.ok) {
      return NextResponse.json({
        answer:
          result.error ||
          "Der Termin konnte leider nicht erstellt werden.",

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
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich aufgenommen. 📅 ${formatDate(
          booking.booking_date!,
        )} um ${
          booking.booking_time
        } Uhr. Fahrzeug: ${
          booking.car
        }. Anliegen: ${
          booking.problem
        }. Deine Anfrage wartet jetzt auf die Bestätigung von MB-Performance.`,

      bookingCreated: true,

      bookingId:
        result.bookingId,

      bookingData:
        EMPTY_BOOKING,

      bookingInProgress:
        false,
    })
  } catch (error) {
    console.error(
      "JARVIS CHAT ERROR:",
      error,
    )

    const errorText =
      error instanceof Error
        ? error.message
        : JSON.stringify(error)

    // =================================================
    // GEMINI ÜBERLASTUNG
    // =================================================

    if (
      errorText.includes("503") ||
      errorText.includes(
        "UNAVAILABLE",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "JARVIS ist gerade stark ausgelastet. Bitte versuche es in einigen Sekunden erneut.",
        },
        {
          status: 503,
        },
      )
    }

    // =================================================
    // RATE LIMIT
    // =================================================

    if (
      errorText.includes("429") ||
      errorText.includes(
        "RESOURCE_EXHAUSTED",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "JARVIS hat gerade zu viele Anfragen erhalten. Bitte versuche es gleich erneut.",
        },
        {
          status: 429,
        },
      )
    }

    // =================================================
    // ALLGEMEINER FEHLER
    // =================================================

    return NextResponse.json(
      {
        error:
          errorText ||
          "JARVIS konnte die Anfrage nicht verarbeiten.",
      },
      {
        status: 500,
      },
    )
  }
}
