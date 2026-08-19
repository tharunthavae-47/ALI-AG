import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import {
  createBooking,
  getBookedSlots,
} from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const apiKey = process.env.GEMINI_API_KEY

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
  booking: Partial<BookingData>
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
// HILFSFUNKTIONEN
// =====================================================

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

// =====================================================
// SCHWEIZER DATUM
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
// DATUM PRÜFEN
// =====================================================

function isValidDate(value: string | null) {
  if (!value) return false

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(
    `${value}T00:00:00`
  )

  return !Number.isNaN(date.getTime())
}

// =====================================================
// UHRZEIT PRÜFEN
// =====================================================

function isValidTime(value: string | null) {
  if (!value) return false

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hourString, minuteString] =
    value.split(":")

  const hour = Number(hourString)
  const minute = Number(minuteString)

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return false
  }

  if (hour < 15 || hour > 22) {
    return false
  }

  if (minute < 0 || minute > 59) {
    return false
  }

  return true
}

// =====================================================
// BOOKING NORMALISIEREN
// =====================================================

function normalizeBooking(
  input: Partial<BookingData> | null | undefined
): BookingData {
  return {
    booking_date:
      typeof input?.booking_date === "string" &&
      input.booking_date.trim()
        ? input.booking_date.trim()
        : null,

    booking_time:
      typeof input?.booking_time === "string" &&
      input.booking_time.trim()
        ? input.booking_time.trim()
        : null,

    name:
      typeof input?.name === "string" &&
      input.name.trim()
        ? input.name.trim()
        : null,

    phone:
      typeof input?.phone === "string" &&
      input.phone.trim()
        ? input.phone.trim()
        : null,

    email:
      typeof input?.email === "string" &&
      input.email.trim()
        ? input.email.trim().toLowerCase()
        : null,

    car:
      typeof input?.car === "string" &&
      input.car.trim()
        ? input.car.trim()
        : null,

    problem:
      typeof input?.problem === "string" &&
      input.problem.trim()
        ? input.problem.trim()
        : null,
  }
}

// =====================================================
// BOOKING ZUSAMMENFÜHREN
// =====================================================

function mergeBookingData(
  oldData: BookingData,
  newData: Partial<BookingData>
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

// =====================================================
// FEHLENDE DATEN
// =====================================================

function getMissingField(
  booking: BookingData
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
// FRAGE FÜR FEHLENDE ANGABE
// =====================================================

function getQuestionForField(
  field: keyof BookingData
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

// =====================================================
// CHAT AUFBAUEN
// =====================================================

function buildConversation(
  messages: ChatMessage[]
) {
  return messages
    .map((msg) => {
      const role =
        msg.role === "user"
          ? "BENUTZER"
          : "JARVIS"

      return `${role}: ${msg.content}`
    })
    .join("\n\n")
}

// =====================================================
// DATUM FORMATIEREN
// =====================================================

function formatDateForUser(
  date: string
) {
  const parts = date.split("-")

  if (parts.length !== 3) {
    return date
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request
) {
  try {
    // ===================================================
    // API KEY
    // ===================================================

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY fehlt in .env.local.",
        },
        {
          status: 500,
        }
      )
    }

    // ===================================================
    // REQUEST
    // ===================================================

    const body = await request.json()

    const messages =
      body?.messages as ChatMessage[]

    const clientBookingData =
      normalizeBooking(
        body?.bookingData
      )

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
        }
      )
    }

    // ===================================================
    // NUR GÜLTIGE NACHRICHTEN
    // ===================================================

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
          message.content.trim()
      )

    if (validMessages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine gültigen Nachrichten erhalten.",
        },
        {
          status: 400,
        }
      )
    }

    // ===================================================
    // DATUM / ZEIT SCHWEIZ
    // ===================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // ===================================================
    // KONVERSATION
    // ===================================================

    const conversation =
      buildConversation(
        validMessages
      )

    // ===================================================
    // GEMINI
    // ===================================================

    const ai = new GoogleGenAI({
      apiKey,
    })

    const extractionPrompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Du kommunizierst auf Deutsch.

AKTUELLES DATUM IN DER SCHWEIZ:
${currentDate}

AKTUELLES DATUM UND UHRZEIT:
${currentDateTime}

ZEITZONE:
Europe/Zurich

TERMINZEITEN:
15:00 bis 22:00 Uhr

--------------------------------------------------
DEINE AUFGABE
--------------------------------------------------

Analysiere den gesamten Chat.

Du musst feststellen:

1. Ist es eine normale Frage?
2. Oder möchte der Benutzer einen Werkstatttermin erstellen?

Wenn der Benutzer einen Termin möchte, ist:

intent = "booking"

Wenn der Benutzer keinen Termin möchte, ist:

intent = "chat"

--------------------------------------------------
WICHTIG
--------------------------------------------------

Antworte AUSSCHLIESSLICH mit gültigem JSON.

Kein Markdown.

Keine Erklärungen außerhalb des JSON.

Erfinde NIEMALS Kundendaten.

Verwende nur Informationen, die der Benutzer tatsächlich genannt hat.

Du darfst keine Telefonnummer,
E-Mail-Adresse,
Name,
Fahrzeugdaten oder andere persönlichen Daten erfinden.

--------------------------------------------------
TERMIN-DATEN
--------------------------------------------------

Für einen Termin werden benötigt:

booking_date
booking_time
name
phone
email
car
problem

--------------------------------------------------
DATUM
--------------------------------------------------

booking_date muss immer dieses Format haben:

YYYY-MM-DD

Beispiele:

"morgen"
→ berechne das tatsächliche Datum.

"übermorgen"
→ berechne das tatsächliche Datum.

"Freitag"
→ berechne den nächsten passenden Freitag.

--------------------------------------------------
UHRZEIT
--------------------------------------------------

booking_time muss immer dieses Format haben:

HH:MM

Beispiele:

"18 Uhr"
→ 18:00

"halb sieben"
→ 18:30

"halb vier"
→ 15:30

"um sieben"
→ 19:00

"achtzehn Uhr dreißig"
→ 18:30

Termine sind nur zwischen 15:00 und 22:00 Uhr erlaubt.

--------------------------------------------------
SEHR WICHTIG: GESAMTEN CHAT ANALYSIEREN
--------------------------------------------------

Wenn der Benutzer Informationen bereits vorher genannt hat,
verwende diese Informationen erneut.

Beispiel:

BENUTZER:
Ich heiße Max.

JARVIS:
Wie lautet deine Telefonnummer?

BENUTZER:
0791234567

Dann muss booking.name weiterhin "Max" sein.

--------------------------------------------------
AKTUELLER BOOKING-STATUS
--------------------------------------------------

Der Client hat aktuell folgende Termindaten:

${JSON.stringify(
  clientBookingData,
  null,
  2
)}

Wenn dort bereits Daten vorhanden sind,
sollen diese erhalten bleiben.

Wenn der Benutzer neue oder korrigierte Daten nennt,
sollen diese aktualisiert werden.

--------------------------------------------------
NORMALE FRAGE
--------------------------------------------------

Beispiel:

BENUTZER:
Was ist ein BMW M4?

Dann:

{
  "intent": "chat",
  "booking": {},
  "answer": "Der BMW M4 ist ..."
}

--------------------------------------------------
TERMINWUNSCH
--------------------------------------------------

Beispiel:

BENUTZER:
Mach mir einen Termin.

Dann:

{
  "intent": "booking",
  "booking": {},
  "answer": ""
}

Wenn nur einige Angaben vorhanden sind,
fülle nur diese Angaben aus.

Wenn eine Angabe fehlt,
setze sie auf null.

--------------------------------------------------
JSON FORMAT
--------------------------------------------------

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

--------------------------------------------------
CHAT
--------------------------------------------------

Wenn intent = chat:

Schreibe eine natürliche kurze Antwort.

--------------------------------------------------
BOOKING
--------------------------------------------------

Wenn intent = booking:

Extrahiere alle vorhandenen Terminangaben.

Wenn noch Angaben fehlen,
kann answer leer bleiben.

Die Anwendung stellt anschließend selbst die nächste Frage.

--------------------------------------------------
BISHERIGER CHAT
--------------------------------------------------

${conversation}

Analysiere jetzt die gesamte Unterhaltung und insbesondere
die letzte BENUTZER-Nachricht.
`

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: extractionPrompt,

        config: {
          temperature: 0.1,
          maxOutputTokens: 800,
          responseMimeType:
            "application/json",
        },
      })

    // ===================================================
    // GEMINI ANTWORT
    // ===================================================

    const raw =
      response.text?.trim() || ""

    console.log(
      "JARVIS GEMINI RESPONSE:",
      raw
    )

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "JARVIS konnte keine Antwort erzeugen.",
        },
        {
          status: 500,
        }
      )
    }

    // ===================================================
    // JSON
    // ===================================================

    let parsed: any

    try {
      parsed = JSON.parse(
        cleanJson(raw)
      )
    } catch (error) {
      console.error(
        "GEMINI JSON ERROR:",
        error
      )

      console.error(
        "GEMINI RAW:",
        raw
      )

      return NextResponse.json(
        {
          error:
            "JARVIS konnte die Anfrage nicht verstehen.",
        },
        {
          status: 500,
        }
      )
    }

    // ===================================================
    // ANALYSE
    // ===================================================

    const intent =
      parsed?.intent === "booking"
        ? "booking"
        : "chat"

    const analysisBooking =
      normalizeBooking(
        parsed?.booking
      )

    // ===================================================
    // NORMALER CHAT
    // ===================================================

    if (intent === "chat") {
      return NextResponse.json({
        answer:
          typeof parsed?.answer ===
            "string" &&
          parsed.answer.trim()
            ? parsed.answer.trim()
            : "Natürlich. Wie kann ich dir helfen?",

        bookingCreated: false,

        bookingInProgress: false,

        bookingData:
          clientBookingData,
      })
    }

    // ===================================================
    // BOOKING DATEN ZUSAMMENFÜHREN
    // ===================================================

    const booking =
      mergeBookingData(
        clientBookingData,
        analysisBooking
      )

    console.log(
      "JARVIS BOOKING DATA:",
      booking
    )

    // ===================================================
    // FEHLENDE ANGABE
    // ===================================================

    const missing =
      getMissingField(
        booking
      )

    if (missing) {
      return NextResponse.json({
        answer:
          getQuestionForField(
            missing
          ),

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: booking,

        missing,
      })
    }

    // ===================================================
    // DATUM PRÜFEN
    // ===================================================

    if (
      !isValidDate(
        booking.booking_date
      )
    ) {
      const correctedBooking = {
        ...booking,
        booking_date: null,
      }

      return NextResponse.json({
        answer:
          "Das Datum konnte ich nicht richtig erkennen. Für welchen Tag möchtest du den Termin?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData:
          correctedBooking,

        missing:
          "booking_date",
      })
    }

    // ===================================================
    // VERGANGENES DATUM
    // ===================================================

    if (
      booking.booking_date! <
      currentDate
    ) {
      const correctedBooking = {
        ...booking,
        booking_date: null,
      }

      return NextResponse.json({
        answer:
          "Dieser Termin liegt bereits in der Vergangenheit. Welchen zukünftigen Tag möchtest du?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData:
          correctedBooking,

        missing:
          "booking_date",
      })
    }

    // ===================================================
    // UHRZEIT PRÜFEN
    // ===================================================

    if (
      !isValidTime(
        booking.booking_time
      )
    ) {
      const correctedBooking = {
        ...booking,
        booking_time: null,
      }

      return NextResponse.json({
        answer:
          "Diese Uhrzeit liegt außerhalb unserer Terminzeiten. Termine sind zwischen 15:00 und 22:00 Uhr möglich. Welche Uhrzeit möchtest du?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData:
          correctedBooking,

        missing:
          "booking_time",
      })
    }

    // ===================================================
    // BELEGTE TERMINE
    // ===================================================

    let bookedSlots: any[] = []

    try {
      bookedSlots =
        await getBookedSlots()
    } catch (error) {
      console.error(
        "GET BOOKED SLOTS ERROR:",
        error
      )
    }

    const alreadyBooked =
      bookedSlots.some(
        (slot) =>
          slot.booking_date ===
            booking.booking_date &&
          slot.booking_time ===
            booking.booking_time
      )

    if (alreadyBooked) {
      const correctedBooking = {
        ...booking,
        booking_time: null,
      }

      return NextResponse.json({
        answer:
          `Der Termin am ${formatDateForUser(
            booking.booking_date!
          )} um ${
            booking.booking_time
          } Uhr ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,

        bookingCreated: false,

        bookingInProgress: true,

        bookingData:
          correctedBooking,

        missing:
          "booking_time",
      })
    }

    // ===================================================
    // TERMIN ERSTELLEN
    // ===================================================

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

    // ===================================================
    // FEHLER
    // ===================================================

    if (!result.ok) {
      return NextResponse.json({
        answer:
          `Ich konnte den Termin leider nicht erstellen. ${
            result.error ||
            "Bitte versuche es erneut."
          }`,

        bookingCreated: false,

        bookingInProgress: true,

        bookingData:
          booking,
      })
    }

    // ===================================================
    // ERFOLG
    // ===================================================

    const dateText =
      formatDateForUser(
        booking.booking_date!
      )

    return NextResponse.json({
      answer:
        `Erledigt, ${booking.name}. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${booking.booking_time} Uhr. Fahrzeug: ${booking.car}. Anliegen: ${booking.problem}. Du erhältst die Bestätigung zusätzlich per E-Mail.`,

      bookingCreated: true,

      bookingId:
        result.bookingId,

      bookingInProgress: false,

      // Nach erfolgreicher Buchung leeren
      bookingData:
        EMPTY_BOOKING,
    })
  } catch (error) {
    console.error(
      "JARVIS CHAT ERROR:",
      error
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
      }
    )
  }
}
