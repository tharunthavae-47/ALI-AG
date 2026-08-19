import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createBooking, getBookedSlots } from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const apiKey = process.env.GEMINI_API_KEY

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type JarvisAction =
  | "chat"
  | "booking_question"
  | "create_booking"

type BookingData = {
  booking_date: string
  booking_time: string
  name: string
  phone: string
  email: string
  car: string
  problem: string
}

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

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime())
}

function isValidTime(value: string) {
  if (!/^\d{2}:00$/.test(value)) {
    return false
  }

  const hour = Number(value.slice(0, 2))

  return hour >= 15 && hour <= 22
}

function emptyBooking(): BookingData {
  return {
    booking_date: "",
    booking_time: "",
    name: "",
    phone: "",
    email: "",
    car: "",
    problem: "",
  }
}

function normalizeBooking(
  input: Partial<BookingData> | undefined,
): BookingData {
  const booking = emptyBooking()

  if (!input) {
    return booking
  }

  booking.booking_date =
    typeof input.booking_date === "string"
      ? input.booking_date.trim()
      : ""

  booking.booking_time =
    typeof input.booking_time === "string"
      ? input.booking_time.trim()
      : ""

  booking.name =
    typeof input.name === "string"
      ? input.name.trim()
      : ""

  booking.phone =
    typeof input.phone === "string"
      ? input.phone.trim()
      : ""

  booking.email =
    typeof input.email === "string"
      ? input.email.trim().toLowerCase()
      : ""

  booking.car =
    typeof input.car === "string"
      ? input.car.trim()
      : ""

  booking.problem =
    typeof input.problem === "string"
      ? input.problem.trim()
      : ""

  return booking
}

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

function questionForField(
  field: keyof BookingData,
) {
  switch (field) {
    case "booking_date":
      return "Gerne. Für welchen Tag möchtest du den Termin?"

    case "booking_time":
      return "Welche Uhrzeit möchtest du? Unsere Termine sind zwischen 15:00 und 22:00 Uhr möglich."

    case "name":
      return "Gerne. Wie lautet dein Name?"

    case "phone":
      return "Welche Telefonnummer soll ich für den Termin hinterlegen?"

    case "email":
      return "Welche E-Mail-Adresse soll ich für die Terminbestätigung verwenden?"

    case "car":
      return "Welches Fahrzeug hast du? Zum Beispiel BMW M4, Baujahr 2021."

    case "problem":
      return "Was soll an deinem Fahrzeug gemacht werden?"

    default:
      return "Welche Information fehlt noch?"
  }
}

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

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY fehlt in .env.local.",
        },
        {
          status: 500,
        },
      )
    }

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
        {
          status: 400,
        },
      )
    }

    const validMessages = messages.filter(
      (message) =>
        message &&
        (message.role === "user" ||
          message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )

    if (validMessages.length === 0) {
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

    const conversation =
      buildConversation(validMessages)

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =====================================================
    // GEMINI
    // =====================================================

    const ai = new GoogleGenAI({
      apiKey,
    })

    const extractionPrompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Aktuelles Datum in der Schweiz:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

Öffnungszeiten für Termine:
15:00 bis 22:00 Uhr

Du musst entscheiden, ob der Benutzer:
1. nur eine normale Frage stellt,
2. einen Termin erstellen möchte,
3. Informationen für einen bereits begonnenen Terminwunsch liefert.

WICHTIG:

- Antworte NICHT mit normalem Text.
- Antworte ausschließlich mit gültigem JSON.
- Erfinde niemals persönliche Daten.
- Wenn eine Information nicht im Gespräch vorhanden ist, lasse sie leer.
- "morgen", "übermorgen", "nächsten Freitag" usw. müssen anhand des aktuellen Datums berechnet werden.
- booking_date muss immer YYYY-MM-DD sein.
- booking_time muss immer HH:00 sein.
- Wenn der Benutzer z.B. "15 Uhr" sagt, ist booking_time "15:00".
- Wenn der Benutzer "halb vier" sagt, ist booking_time "15:00".
- Termine sind nur von 15:00 bis 22:00 möglich.
- Bei einer Terminabsicht action = "booking_question" oder "create_booking".
- Wenn noch Angaben fehlen, action = "booking_question".
- Wenn alle Angaben vorhanden sind, action = "create_booking".
- Eine normale Frage hat action = "chat".

Für einen Termin werden benötigt:

booking_date
booking_time
name
phone
email
car
problem

Das Anliegen kann beispielsweise sein:
"Ölwechsel"
"Reifenwechsel"
"Bremsen prüfen"
"Diagnose"
"Inspektion"
"MFK"
oder eine freie Beschreibung.

JSON-Format:

{
  "action": "chat" | "booking_question" | "create_booking",
  "answer": "kurze Antwort",
  "booking": {
    "booking_date": "",
    "booking_time": "",
    "name": "",
    "phone": "",
    "email": "",
    "car": "",
    "problem": ""
  }
}

Hier ist der komplette bisherige Chat:

${conversation}

Analysiere jetzt die letzte Nachricht.
`

    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",

        contents: extractionPrompt,

        config: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      })

    const raw =
      response.text?.trim() ?? ""

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "JARVIS konnte keine Antwort erzeugen.",
        },
        {
          status: 500,
        },
      )
    }

    let parsed: {
      action?: JarvisAction
      answer?: string
      booking?: Partial<BookingData>
    }

    try {
      parsed = JSON.parse(
        cleanJson(raw),
      )
    } catch (error) {
      console.error(
        "Gemini JSON Fehler:",
        error,
        raw,
      )

      return NextResponse.json(
        {
          error:
            "JARVIS konnte die Antwort nicht verarbeiten.",
        },
        {
          status: 500,
        },
      )
    }

    // =====================================================
    // NORMALE FRAGE
    // =====================================================

    if (
      parsed.action === "chat"
    ) {
      return NextResponse.json({
        answer:
          parsed.answer ||
          "Wie kann ich dir helfen?",
        action: "chat",
      })
    }

    // =====================================================
    // TERMIN
    // =====================================================

    const booking =
      normalizeBooking(
        parsed.booking,
      )

    const missing =
      getMissingField(booking)

    // =====================================================
    // FEHLENDE ANGABE
    // =====================================================

    if (
      parsed.action ===
        "booking_question" ||
      missing
    ) {
      let answer =
        parsed.answer?.trim()

      if (!answer) {
        answer = questionForField(
          missing || "booking_date",
        )
      }

      if (missing) {
        answer =
          questionForField(missing)
      }

      return NextResponse.json({
        answer,
        action: "booking_question",
        booking,
        missing,
      })
    }

    // =====================================================
    // DATUM PRÜFEN
    // =====================================================

    if (
      !isValidDate(
        booking.booking_date,
      )
    ) {
      return NextResponse.json({
        answer:
          "Das Datum konnte ich nicht richtig erkennen. Für welchen Tag möchtest du den Termin?",
        action: "booking_question",
        booking: {
          ...booking,
          booking_date: "",
        },
        missing: "booking_date",
      })
    }

    // =====================================================
    // UHRZEIT PRÜFEN
    // =====================================================

    if (
      !isValidTime(
        booking.booking_time,
      )
    ) {
      return NextResponse.json({
        answer:
          "Diese Uhrzeit liegt außerhalb unserer Terminzeiten. Termine sind zwischen 15:00 und 22:00 Uhr möglich. Welche Uhrzeit möchtest du?",
        action: "booking_question",
        booking: {
          ...booking,
          booking_time: "",
        },
        missing: "booking_time",
      })
    }

    // =====================================================
    // VERGANGENES DATUM
    // =====================================================

    if (
      booking.booking_date <
      currentDate
    ) {
      return NextResponse.json({
        answer:
          "Dieser Termin liegt bereits in der Vergangenheit. Welchen zukünftigen Tag möchtest du?",
        action: "booking_question",
        booking: {
          ...booking,
          booking_date: "",
        },
        missing: "booking_date",
      })
    }

    // =====================================================
    // BELEGTE TERMINE
    // =====================================================

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
          `Der Termin am ${booking.booking_date} um ${booking.booking_time} ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,
        action: "booking_question",
        booking: {
          ...booking,
          booking_time: "",
        },
        missing: "booking_time",
      })
    }

    // =====================================================
    // TERMIN ERSTELLEN
    // =====================================================

    const result =
      await createBooking({
        booking_date:
          booking.booking_date,

        booking_time:
          booking.booking_time,

        name:
          booking.name,

        phone:
          booking.phone,

        email:
          booking.email,

        car:
          booking.car,

        problem:
          booking.problem,
      })

    // =====================================================
    // FEHLER
    // =====================================================

    if (!result.ok) {
      return NextResponse.json({
        answer:
          result.error ||
          "Der Termin konnte leider nicht erstellt werden.",
        action: "booking_error",
      })
    }

    // =====================================================
    // ERFOLG
    // =====================================================

    return NextResponse.json({
      answer:
        `Alles klar, ${booking.name}. Ich habe deine Terminanfrage für den ${booking.booking_date} um ${booking.booking_time} Uhr für ${booking.car} aufgenommen. Das Anliegen ist: ${booking.problem}. Der Termin wartet jetzt auf die Bestätigung von MB-Performance.`,

      action: "booking_created",

      bookingId:
        result.bookingId,

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
