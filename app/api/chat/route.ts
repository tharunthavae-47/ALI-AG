import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createBooking } from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const apiKey = process.env.GEMINI_API_KEY

/* =====================================================
   TYPES
===================================================== */

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

type JarvisResponse = {
  intent: "chat" | "booking"
  answer: string
  booking: BookingData
}

/* =====================================================
   EMPTY BOOKING
===================================================== */

const EMPTY_BOOKING: BookingData = {
  booking_date: null,
  booking_time: null,
  name: null,
  phone: null,
  email: null,
  car: null,
  problem: null,
}

/* =====================================================
   GEMINI CLIENT
===================================================== */

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
})

/* =====================================================
   JSON BEREINIGEN
===================================================== */

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

/* =====================================================
   SCHWEIZER DATUM
===================================================== */

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

/* =====================================================
   BOOKING MERGEN
===================================================== */

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

/* =====================================================
   FEHLENDE FELDER
===================================================== */

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

/* =====================================================
   FRAGEN
===================================================== */

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
      return "Welche E-Mail-Adresse soll ich für die Terminbestätigung verwenden?"

    case "car":
      return "Welches Fahrzeug hast du? Zum Beispiel BMW M4, Baujahr 2021."

    case "problem":
      return "Was soll an deinem Fahrzeug gemacht oder überprüft werden?"

    default:
      return "Welche Information fehlt noch?"
  }
}

/* =====================================================
   DATUM PRÜFEN
===================================================== */

function isValidDate(
  value: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] =
    value.split("-").map(Number)

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

/* =====================================================
   UHRZEIT PRÜFEN
===================================================== */

function isValidTime(
  value: string,
) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hour, minute] =
    value.split(":").map(Number)

  if (
    hour < 15 ||
    hour > 22
  ) {
    return false
  }

  if (
    minute !== 0 &&
    minute !== 30
  ) {
    return false
  }

  return true
}

/* =====================================================
   DATUM FORMATIEREN
===================================================== */

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

/* =====================================================
   GEMINI RETRY
===================================================== */

async function generateWithRetry(
  prompt: string,
) {
  /*
   * Wir probieren zuerst dieses Modell.
   */
  const models = [
    "gemini-3.5-flash",
    "gemini-3.1-flash",
  ]

  let lastError: unknown = null

  for (const model of models) {
    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      try {
        console.log(
          `JARVIS: ${model} – Versuch ${attempt}`,
        )

        const response =
          await ai.models.generateContent({
            model,

            contents: prompt,

            config: {
              temperature: 0.1,

              maxOutputTokens: 800,

              responseMimeType:
                "application/json",
            },
          })

        console.log(
          `JARVIS: ${model} erfolgreich`,
        )

        return response
      } catch (error) {
        lastError = error

        const errorText =
          error instanceof Error
            ? error.message
            : JSON.stringify(error)

        console.error(
          `JARVIS ${model} Fehler:`,
          errorText,
        )

        /*
         * 404:
         * Modell nicht vorhanden.
         * Direkt nächstes Modell testen.
         */
        if (
          errorText.includes(
            "404",
          ) ||
          errorText.includes(
            "NOT_FOUND",
          ) ||
          errorText.includes(
            "not found",
          )
        ) {
          break
        }

        /*
         * 503:
         * Google ist gerade überlastet.
         * Noch einmal versuchen.
         */
        if (
          errorText.includes(
            "503",
          ) ||
          errorText.includes(
            "UNAVAILABLE",
          ) ||
          errorText.includes(
            "high demand",
          )
        ) {
          if (
            attempt < 2
          ) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  attempt *
                    2000,
                ),
            )

            continue
          }
        }

        break
      }
    }
  }

  throw lastError
}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: Request,
) {
  try {
    /* =================================================
       API KEY
    ================================================= */

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

    /* =================================================
       REQUEST
    ================================================= */

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

    /* =================================================
       NUR GÜLTIGE NACHRICHTEN
    ================================================= */

    const validMessages =
      messages.filter(
        (message) =>
          message &&
          (
            message.role ===
              "user" ||
            message.role ===
              "assistant"
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

    /* =================================================
       AKTUELLES DATUM
    ================================================= */

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    /* =================================================
       VORHERIGE BOOKING DATA
    ================================================= */

    const previousBooking: BookingData =
      body?.bookingData &&
      typeof body.bookingData ===
        "object"
        ? {
            ...EMPTY_BOOKING,
            ...body.bookingData,
          }
        : {
            ...EMPTY_BOOKING,
          }

    /* =================================================
       CHAT
    ================================================= */

    const conversation =
      validMessages
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

    /* =================================================
       GEMINI PROMPT
    ================================================= */

    const prompt = `
Du bist JARVIS, der intelligente persönliche KI-Assistent von MB-Performance.

Sprache:
Deutsch

Zeitzone:
Europe/Zurich

Aktuelles Datum:
${currentDate}

Aktuelles Datum und Uhrzeit:
${currentDateTime}

==================================================
DEINE AUFGABE
==================================================

Analysiere die letzte Nachricht des BENUTZERS.

Es gibt zwei Möglichkeiten:

1. normale Frage
2. Terminwunsch

Normale Frage:

intent = "chat"

Terminwunsch:

intent = "booking"

==================================================
WICHTIG
==================================================

Antworte ausschließlich mit gültigem JSON.

Keine Markdown-Codeblöcke.

Keine zusätzlichen Texte außerhalb des JSON.

Erfinde niemals Kundendaten.

Nur Informationen aus BENUTZER-Nachrichten dürfen
als Kundendaten verwendet werden.

==================================================
TERMIN-DATEN
==================================================

Ein Termin benötigt:

booking_date
booking_time
name
phone
email
car
problem

==================================================
BEREITS BEKANNTE DATEN
==================================================

${JSON.stringify(
  previousBooking,
  null,
  2,
)}

Diese Daten müssen erhalten bleiben.

Wenn der Benutzer nur eine neue Information nennt,
darfst du die bereits vorhandenen Informationen
NICHT löschen.

==================================================
DATUM
==================================================

Heute:

${currentDate}

Wenn der Benutzer beispielsweise sagt:

"18 Oktober"

muss das Datum als YYYY-MM-DD zurückgegeben werden.

Beispiel:

"18 Oktober 2026"

→

"2026-10-18"

Wenn das Jahr nicht genannt wird,
verwende das passende kommende Datum.

Beispiel:

"15 September"

→

entsprechendes Datum im kommenden Zeitraum.

Weitere Beispiele:

"morgen"
→ tatsächliches Datum von morgen

"übermorgen"
→ tatsächliches Datum von übermorgen

"nächsten Freitag"
→ tatsächliches Datum des nächsten Freitags

==================================================
UHRZEIT
==================================================

Beispiele:

"20 Uhr"
→ "20:00"

"20:30"
→ "20:30"

"halb sieben"
→ "18:30"

"halb acht"
→ "19:30"

"um sieben"
→ "19:00"

Termine sind zwischen:

15:00 und 22:00 Uhr

möglich.

==================================================
BEISPIEL
==================================================

JARVIS:
"Für welchen Tag möchtest du den Termin?"

BENUTZER:
"18 Oktober"

Dann:

{
  "intent": "booking",
  "booking": {
    "booking_date": "2026-10-18",
    "booking_time": null,
    "name": null,
    "phone": null,
    "email": null,
    "car": null,
    "problem": null
  },
  "answer": "Um welche Uhrzeit möchtest du den Termin?"
}

==================================================
NOCH EIN BEISPIEL
==================================================

JARVIS:
"Um welche Uhrzeit möchtest du den Termin?"

BENUTZER:
"20 Uhr"

Dann:

booking_time:

"20:00"

==================================================
ANTWORTEN
==================================================

Wenn Informationen fehlen,
soll answer die nächste sinnvolle Frage sein.

Wenn alle Informationen vorhanden sind:

answer:

"TERMIN_BEREIT"

==================================================
JSON FORMAT
==================================================

{
  "intent": "chat",
  "answer": "...",
  "booking": {
    "booking_date": null,
    "booking_time": null,
    "name": null,
    "phone": null,
    "email": null,
    "car": null,
    "problem": null
  }
}

oder:

{
  "intent": "booking",
  "answer": "...",
  "booking": {
    "booking_date": "YYYY-MM-DD",
    "booking_time": "HH:MM",
    "name": "...",
    "phone": "...",
    "email": "...",
    "car": "...",
    "problem": "..."
  }
}

==================================================
BISHERIGER CHAT
==================================================

${conversation}

Analysiere jetzt die letzte BENUTZER-Nachricht.
`

    /* =================================================
       GEMINI
    ================================================= */

    const response =
      await generateWithRetry(
        prompt,
      )

    const raw =
      response.text?.trim() ||
      ""

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

    console.log(
      "JARVIS GEMINI RAW:",
      raw,
    )

    /* =================================================
       JSON PARSEN
    ================================================= */

    let parsed: any

    try {
      parsed =
        JSON.parse(
          cleanJson(raw),
        )
    } catch (error) {
      console.error(
        "JARVIS JSON FEHLER:",
        error,
      )

      console.error(
        "RAW GEMINI:",
        raw,
      )

      return NextResponse.json(
        {
          error:
            "JARVIS konnte die Anfrage nicht verstehen.",
        },
        {
          status: 500,
        },
      )
    }

    /* =================================================
       ANALYSE
    ================================================= */

    const analysis:
      JarvisResponse = {
      intent:
        parsed?.intent ===
        "booking"
          ? "booking"
          : "chat",

      answer:
        typeof parsed?.answer ===
        "string"
          ? parsed.answer
          : "",

      booking: {
        ...EMPTY_BOOKING,

        ...(parsed?.booking &&
        typeof parsed.booking ===
          "object"
          ? parsed.booking
          : {}),
      },
    }

    /* =================================================
       NORMALER CHAT
    ================================================= */

    if (
      analysis.intent ===
      "chat"
    ) {
      return NextResponse.json({
        answer:
          analysis.answer ||
          "Natürlich. Wie kann ich dir helfen?",

        bookingCreated:
          false,

        bookingInProgress:
          false,

        bookingData:
          previousBooking,
      })
    }

    /* =================================================
       BOOKING ZUSAMMENFÜHREN
    ================================================= */

    const booking =
      mergeBookingData(
        previousBooking,
        analysis.booking,
      )

    console.log(
      "JARVIS BOOKING DATA:",
      booking,
    )

    /* =================================================
       DATUM VALIDIEREN
    ================================================= */

    if (
      booking.booking_date &&
      !isValidDate(
        booking.booking_date,
      )
    ) {
      return NextResponse.json({
        answer:
          "Das Datum konnte ich nicht richtig erkennen. Für welchen Tag möchtest du den Termin?",

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

    /* =================================================
       UHRZEIT VALIDIEREN
    ================================================= */

    if (
      booking.booking_time &&
      !isValidTime(
        booking.booking_time,
      )
    ) {
      return NextResponse.json({
        answer:
          "Diese Uhrzeit ist nicht möglich. Termine können zwischen 15:00 und 22:00 Uhr vereinbart werden.",

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData: {
          ...booking,
          booking_time:
            null,
        },
      })
    }

    /* =================================================
       VERGANGENES DATUM
    ================================================= */

    if (
      booking.booking_date &&
      booking.booking_date <
        currentDate
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

    /* =================================================
       FEHLENDES FELD
    ================================================= */

    const missing =
      getMissingField(
        booking,
      )

    if (missing) {
      return NextResponse.json({
        answer:
          getQuestion(missing),

        bookingCreated:
          false,

        bookingInProgress:
          true,

        bookingData:
          booking,
      })
    }

    /* =================================================
       ALLE DATEN VORHANDEN
    ================================================= */

    console.log(
      "JARVIS: Erstelle Termin...",
    )

    /* =================================================
       SUPABASE BOOKING
    ================================================= */

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

    /* =================================================
       BOOKING FEHLER
    ================================================= */

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

    /* =================================================
       ERFOLG
    ================================================= */

    console.log(
      "JARVIS: Termin erstellt:",
      result.bookingId,
    )

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${formatDate(
          booking.booking_date!,
        )} um ${
          booking.booking_time
        } Uhr. Fahrzeug: ${
          booking.car
        }. Anliegen: ${
          booking.problem
        }. Die Terminbestätigung wird zusätzlich per E-Mail verschickt.`,

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
      "JARVIS CHAT ERROR:",
      error,
    )

    const errorMessage =
      error instanceof Error
        ? error.message
        : JSON.stringify(error)

    return NextResponse.json(
      {
        error:
          `JARVIS konnte die Anfrage nicht verarbeiten. Fehler: ${errorMessage}`,
      },
      {
        status: 500,
      },
    )
  }
}
