import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createBooking } from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error("GEMINI_API_KEY fehlt.")
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
})

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

const EMPTY_BOOKING: BookingData = {
  booking_date: null,
  booking_time: null,
  name: null,
  phone: null,
  email: null,
  car: null,
  problem: null,
}

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function getMissingFields(
  booking: BookingData,
) {
  const missing: string[] = []

  if (!booking.booking_date) {
    missing.push("Datum")
  }

  if (!booking.booking_time) {
    missing.push("Uhrzeit")
  }

  if (!booking.name) {
    missing.push("Name")
  }

  if (!booking.phone) {
    missing.push("Telefonnummer")
  }

  if (!booking.email) {
    missing.push("E-Mail-Adresse")
  }

  if (!booking.car) {
    missing.push("Fahrzeug")
  }

  if (!booking.problem) {
    missing.push("Anliegen")

  }

  return missing
}

function mergeBookingData(
  oldData: BookingData,
  newData: BookingData,
): BookingData {
  return {
    booking_date:
      newData.booking_date ||
      oldData.booking_date,

    booking_time:
      newData.booking_time ||
      oldData.booking_time,

    name:
      newData.name ||
      oldData.name,

    phone:
      newData.phone ||
      oldData.phone,

    email:
      newData.email ||
      oldData.email,

    car:
      newData.car ||
      oldData.car,

    problem:
      newData.problem ||
      oldData.problem,
  }
}

function formatDateForUser(
  date: string,
) {
  try {
    const [year, month, day] =
      date.split("-")

    return `${day}.${month}.${year}`
  } catch {
    return date
  }
}

function formatTimeForUser(
  time: string,
) {
  return time
}

function getNextQuestion(
  booking: BookingData,
) {
  if (!booking.booking_date) {
    return "Für welchen Tag möchtest du den Termin?"
  }

  if (!booking.booking_time) {
    return "Um welche Uhrzeit möchtest du den Termin?"
  }

  if (!booking.name) {
    return "Wie ist dein Name?"
  }

  if (!booking.phone) {
    return "Wie lautet deine Telefonnummer?"
  }

  if (!booking.email) {
    return "Wie lautet deine E-Mail-Adresse?"
  }

  if (!booking.car) {
    return "Welches Fahrzeug soll ich für den Termin eintragen?"
  }

  if (!booking.problem) {
    return "Was soll am Fahrzeug gemacht oder überprüft werden?"
  }

  return null
}

function isCompleteBooking(
  booking: BookingData,
) {
  return (
    !!booking.booking_date &&
    !!booking.booking_time &&
    !!booking.name &&
    !!booking.phone &&
    !!booking.email &&
    !!booking.car &&
    !!booking.problem
  )
}

export async function POST(
  request: Request,
) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY ist nicht eingerichtet.",
        },
        { status: 500 },
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
        { status: 400 },
      )
    }

    const validMessages =
      messages.filter(
        (msg) =>
          msg &&
          (msg.role === "user" ||
            msg.role === "assistant") &&
          typeof msg.content ===
            "string" &&
          msg.content.trim(),
      )

    if (validMessages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine gültigen Nachrichten erhalten.",
        },
        { status: 400 },
      )
    }

    // --------------------------------------------------
    // DATUM
    // --------------------------------------------------

    const today =
      new Date().toISOString().slice(0, 10)

    // --------------------------------------------------
    // KONVERSATION
    // --------------------------------------------------

    const conversation =
      validMessages
        .map(
          (msg) =>
            `${msg.role === "user" ? "BENUTZER" : "JARVIS"}: ${msg.content}`,
        )
        .join("\n")

    // --------------------------------------------------
    // GEMINI ANALYSE
    // --------------------------------------------------

    const extractionPrompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Heutiges Datum:
${today}

Du musst erkennen, ob der Benutzer einen Werkstatttermin erstellen möchte.

WICHTIG:

1. Antworte NICHT mit Markdown.
2. Gib ausschließlich gültiges JSON zurück.
3. Der Benutzer möchte auf Deutsch kommunizieren.
4. Nur Informationen aus BENUTZER-Nachrichten dürfen als Kundendaten verwendet werden.
5. Informationen aus JARVIS-Nachrichten dürfen NICHT als neue Kundendaten erfunden werden.
6. Wenn eine Information fehlt, setze sie auf null.
7. Wenn der Benutzer einen Termin möchte, ist intent "booking".
8. Wenn es kein Terminwunsch ist, ist intent "chat".
9. Erfinde niemals Telefonnummern, E-Mail-Adressen, Namen, Fahrzeuge oder andere Daten.
10. Relative Datumsangaben müssen anhand des heutigen Datums berechnet werden.

Beispiele:

"morgen"
→ berechne das tatsächliche Datum.

"übermorgen"
→ berechne das tatsächliche Datum.

"Freitag"
→ berechne den nächsten passenden Freitag.

"18 Uhr"
→ "18:00"

"halb sieben"
→ "18:30"

"um sieben"
→ "19:00"

Der Betrieb nimmt Termine zwischen 15:00 und 22:00 Uhr an.

Wenn der Benutzer sagt:
"Mach mir einen Termin"

dann ist intent:
"booking"

Wenn der Benutzer sagt:
"Was ist ein BMW M4?"

dann ist intent:
"chat"

Erstelle dieses JSON:

{
  "intent": "chat" oder "booking",
  "booking": {
    "booking_date": "YYYY-MM-DD" oder null,
    "booking_time": "HH:MM" oder null,
    "name": "..." oder null,
    "phone": "..." oder null,
    "email": "..." oder null,
    "car": "..." oder null,
    "problem": "..." oder null
  },
  "answer": "..."
}

CHAT:

Wenn intent "chat" ist, schreibe eine kurze natürliche deutsche Antwort.

BOOKING:

Wenn intent "booking" ist, soll answer nur verwendet werden, wenn noch Informationen fehlen.

Wenn alle Informationen vorhanden sind, schreibe:

"TERMIN_BEREIT"

Hier ist der bisherige Chat:

${conversation}
`

    const response =
  await ai.models.generateContent({
    model: "gemini-3.6-flash",

    contents: extractionPrompt,

    config: {
      maxOutputTokens: 500,
      responseMimeType: "application/json",
    },
  })
    const raw =
      response.text?.trim() || ""

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "JARVIS konnte keine Antwort erzeugen.",
        },
        { status: 500 },
      )
    }

    let analysis: JarvisAnalysis

    try {
      const parsed = JSON.parse(
        cleanJson(raw),
      )

      analysis = {
        intent:
          parsed.intent === "booking"
            ? "booking"
            : "chat",

        booking: {
          ...EMPTY_BOOKING,
          ...(parsed.booking || {}),
        },

        answer:
          typeof parsed.answer === "string"
            ? parsed.answer
            : "",
      }
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
            "JARVIS konnte die Anfrage nicht verstehen.",
        },
        { status: 500 },
      )
    }

    // --------------------------------------------------
    // NORMALER CHAT
    // --------------------------------------------------

    if (analysis.intent !== "booking") {
      return NextResponse.json({
        answer:
          analysis.answer ||
          "Natürlich. Wie kann ich dir helfen?",
        bookingCreated: false,
      })
    }

    // --------------------------------------------------
    // TERMIN-DATEN AUS GESAMTEM CHAT SAMMELN
    // --------------------------------------------------

    const previousAssistantBooking: BookingData =
      body?.bookingData || EMPTY_BOOKING

    const booking =
      mergeBookingData(
        previousAssistantBooking,
        analysis.booking,
      )

    // --------------------------------------------------
    // FEHLENDE DATEN
    // --------------------------------------------------

    const missing =
      getMissingFields(booking)

    if (missing.length > 0) {
      const question =
        getNextQuestion(booking)

      return NextResponse.json({
        answer:
          question ||
          "Mir fehlen noch einige Angaben.",
        bookingCreated: false,
        bookingData: booking,
        bookingInProgress: true,
      })
    }

    // --------------------------------------------------
    // ALLE DATEN VORHANDEN
    // --------------------------------------------------

    if (!isCompleteBooking(booking)) {
      return NextResponse.json({
        answer:
          "Mir fehlen noch Angaben für den Termin.",
        bookingCreated: false,
        bookingData: booking,
        bookingInProgress: true,
      })
    }

    // --------------------------------------------------
    // TERMIN ERSTELLEN
    // --------------------------------------------------

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

    // --------------------------------------------------
    // FEHLER
    // --------------------------------------------------

    if (!result.ok) {
      return NextResponse.json({
        answer:
          `Ich konnte den Termin leider nicht erstellen. ${result.error || "Bitte versuche es erneut."}`,
        bookingCreated: false,
        bookingData: booking,
        bookingInProgress: true,
      })
    }

    // --------------------------------------------------
    // ERFOLGREICH
    // --------------------------------------------------

    const dateText =
      formatDateForUser(
        booking.booking_date!,
      )

    const timeText =
      formatTimeForUser(
        booking.booking_time!,
      )

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${timeText}. Für ${booking.car}. Du erhältst die Bestätigung zusätzlich per E-Mail.`,
      bookingCreated: true,
      bookingId: result.bookingId,
      bookingData: EMPTY_BOOKING,
      bookingInProgress: false,
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
      { status: 500 },
    )
  }
}
