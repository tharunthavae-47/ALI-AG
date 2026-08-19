import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createBooking } from "@/app/actions"

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
// DATUM / ZEIT
// =====================================================

function getZurichDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function getZurichDateTime(): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date())
}

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
// BOOKING LEER
// =====================================================

function emptyBooking(): BookingData {
  return {
    booking_date: null,
    booking_time: null,
    name: null,
    phone: null,
    email: null,
    car: null,
    problem: null,
  }
}

// =====================================================
// BOOKING NORMALISIEREN
// =====================================================

function normalizeBooking(
  input: Partial<BookingData> | null | undefined,
): BookingData {
  const booking = emptyBooking()

  if (!input) {
    return booking
  }

  booking.booking_date =
    typeof input.booking_date === "string" &&
    input.booking_date.trim()
      ? input.booking_date.trim()
      : null

  booking.booking_time =
    typeof input.booking_time === "string" &&
    input.booking_time.trim()
      ? input.booking_time.trim()
      : null

  booking.name =
    typeof input.name === "string" &&
    input.name.trim()
      ? input.name.trim()
      : null

  booking.phone =
    typeof input.phone === "string" &&
    input.phone.trim()
      ? input.phone.trim()
      : null

  booking.email =
    typeof input.email === "string" &&
    input.email.trim()
      ? input.email.trim().toLowerCase()
      : null

  booking.car =
    typeof input.car === "string" &&
    input.car.trim()
      ? input.car.trim()
      : null

  booking.problem =
    typeof input.problem === "string" &&
    input.problem.trim()
      ? input.problem.trim()
      : null

  return booking
}

// =====================================================
// DATEN ZUSAMMENFÜHREN
// =====================================================

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

// =====================================================
// FEHLENDE FELDER
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
// FRAGEN
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
// DATUM VALIDIEREN
// =====================================================

function isValidDate(
  value: string | null,
) {
  if (!value) {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  if (Number.isNaN(date.getTime())) {
    return false
  }

  const [year, month, day] =
    value.split("-").map(Number)

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
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
    value.match(
      /^(\d{2}):(\d{2})$/,
    )

  if (!match) {
    return false
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

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

// =====================================================
// DATUM FORMATIEREN
// =====================================================

function formatDateForUser(
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

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    // -------------------------------------------------
    // API KEY
    // -------------------------------------------------

    if (!apiKey || !ai) {
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

    // -------------------------------------------------
    // REQUEST
    // -------------------------------------------------

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

    // -------------------------------------------------
    // NUR GÜLTIGE NACHRICHTEN
    // -------------------------------------------------

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

    // -------------------------------------------------
    // BISHERIGE BOOKING DATEN
    // -------------------------------------------------

    const previousBooking =
      normalizeBooking(
        body?.bookingData,
      )

    // -------------------------------------------------
    // AKTUELLES DATUM
    // -------------------------------------------------

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // -------------------------------------------------
    // KONVERSATION
    // -------------------------------------------------

    const conversation =
      validMessages
        .map((message) => {
          const role =
            message.role === "user"
              ? "BENUTZER"
              : "JARVIS"

          return `${role}: ${message.content}`
        })
        .join("\n")

    // -------------------------------------------------
    // GEMINI PROMPT
    // -------------------------------------------------

    const prompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Du sprichst natürliches Deutsch.

AKTUELLES DATUM IN DER SCHWEIZ:
${currentDate}

AKTUELLES DATUM UND UHRZEIT:
${currentDateTime}

ZEITZONE:
Europe/Zurich

TERMINE:
Montag bis Sonntag
15:00 bis 22:00 Uhr

==================================================
SEHR WICHTIG
==================================================

Der Benutzer kann einen Termin in mehreren Nachrichten erstellen.

Du musst deshalb den GESAMTEN CHAT berücksichtigen.

Wenn der Benutzer zuerst sagt:

"Ich möchte einen Termin"

und JARVIS fragt:

"Für welchen Tag möchtest du den Termin?"

und der Benutzer danach sagt:

"am 15 september um 20 uhr"

musst du daraus erkennen:

booking_date = "2026-09-15"
booking_time = "20:00"

Das aktuelle Jahr ist 2026.

==================================================
DATUM
==================================================

Verstehe natürliche deutsche Datumsangaben.

Beispiele:

"15 september"
=> 2026-09-15

"15. September"
=> 2026-09-15

"15.09."
=> 2026-09-15

"morgen"
=> berechne das Datum anhand des aktuellen Datums

"übermorgen"
=> berechne das Datum anhand des aktuellen Datums

"nächsten Freitag"
=> berechne den nächsten Freitag

"Freitag"
=> berechne den nächsten passenden Freitag

==================================================
UHRZEIT
==================================================

Beispiele:

"20 Uhr"
=> 20:00

"20 uhr"
=> 20:00

"um acht"
=> 20:00

"acht Uhr abends"
=> 20:00

"halb sieben"
=> 18:30

"halb acht"
=> 19:30

"viertel nach acht"
=> 20:15

"viertel vor neun"
=> 20:45

Wenn die Uhrzeit nicht eindeutig ist, setze booking_time auf null.

==================================================
TERMIN-DATEN
==================================================

Für einen Termin benötigen wir:

booking_date
booking_time
name
phone
email
car
problem

==================================================
WICHTIG ZU KUNDENDATEN
==================================================

Erfinde NIEMALS:

- Namen
- Telefonnummern
- E-Mail-Adressen
- Fahrzeuge
- Anliegen

Wenn diese Informationen nicht im BENUTZER-Text vorhanden sind,
setze sie auf null.

Informationen aus JARVIS-Nachrichten dürfen nicht als neue
Kundendaten verwendet werden.

==================================================
BISHER GESPEICHERTE TERMINDATEN
==================================================

${JSON.stringify(previousBooking)}

==================================================
CHAT
==================================================

${conversation}

==================================================
AUFGABE
==================================================

Erkenne die Absicht.

Wenn es kein Terminwunsch ist:

intent = "chat"

Wenn der Benutzer einen Termin erstellen möchte oder gerade
Informationen für einen Termin liefert:

intent = "booking"

Sammle dabei die bereits gespeicherten Termindaten und die
Informationen aus der letzten BENUTZER-Nachricht.

Gib ausschließlich gültiges JSON zurück.

FORMAT:

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
  "answer": "..."
}

oder:

{
  "intent": "booking",
  "booking": {
    "booking_date": "2026-09-15",
    "booking_time": "20:00",
    "name": null,
    "phone": null,
    "email": null,
    "car": null,
    "problem": null
  },
  "answer": ""
}

Wenn alle benötigten Informationen vorhanden sind,
setze answer auf:

"TERMIN_BEREIT"

NIEMALS Markdown.
NIEMALS Codeblöcke.
NUR JSON.
`

    // -------------------------------------------------
    // GEMINI AUFRUF
    // -------------------------------------------------

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: prompt,

        config: {
          temperature: 0.1,

          maxOutputTokens: 1000,

          responseMimeType:
            "application/json",
        },
      })

    const raw =
      response.text?.trim() ||
      ""

    console.log(
      "JARVIS GEMINI RAW:",
      raw,
    )

    // -------------------------------------------------
    // KEINE ANTWORT
    // -------------------------------------------------

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

    // -------------------------------------------------
    // JSON PARSEN
    // -------------------------------------------------

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
            "JARVIS konnte die Anfrage nicht verstehen.",
        },
        {
          status: 500,
        },
      )
    }

    // -------------------------------------------------
    // BOOKING AUS GEMINI
    // -------------------------------------------------

    const newBooking =
      normalizeBooking(
        parsed?.booking,
      )

    // -------------------------------------------------
    // ALTE + NEUE DATEN
    // -------------------------------------------------

    const booking =
      mergeBookingData(
        previousBooking,
        newBooking,
      )

    console.log(
      "JARVIS BOOKING:",
      booking,
    )

    // -------------------------------------------------
    // NORMALER CHAT
    // -------------------------------------------------

    if (
      parsed?.intent !==
      "booking"
    ) {
      return NextResponse.json({
        answer:
          typeof parsed?.answer ===
          "string"
            ? parsed.answer
            : "Natürlich. Wie kann ich dir helfen?",

        bookingCreated: false,

        bookingInProgress: false,

        bookingData: EMPTY_BOOKING,
      })
    }

    // -------------------------------------------------
    // DATUM PRÜFEN
    // -------------------------------------------------

    if (
      booking.booking_date &&
      !isValidDate(
        booking.booking_date,
      )
    ) {
      return NextResponse.json({
        answer:
          "Ich konnte das Datum nicht eindeutig erkennen. Für welchen Tag möchtest du den Termin?",

        bookingCreated: false,

        bookingInProgress: true,

        bookingData: {
          ...booking,
          booking_date: null,
        },

        missing: "booking_date",
      })
    }

    // -------------------------------------------------
    // ZEIT PRÜFEN
    // -------------------------------------------------

    if (
      booking.booking_time &&
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
      })
    }

    // -------------------------------------------------
    // VERGANGENES DATUM
    // -------------------------------------------------

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
      })
    }

    // -------------------------------------------------
    // FEHLENDE INFORMATION
    // -------------------------------------------------

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
      })
    }

    // -------------------------------------------------
    // TERMIN ERSTELLEN
    // -------------------------------------------------

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

    // -------------------------------------------------
    // FEHLER BEIM ERSTELLEN
    // -------------------------------------------------

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

    // -------------------------------------------------
    // ERFOLGREICH
    // -------------------------------------------------

    const dateText =
      formatDateForUser(
        booking.booking_date!,
      )

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${booking.booking_time} Uhr. Fahrzeug: ${booking.car}. Anliegen: ${booking.problem}. Du erhältst die Bestätigung zusätzlich per E-Mail.`,

      bookingCreated: true,

      bookingId:
        result.bookingId,

      bookingData:
        EMPTY_BOOKING,

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
      {
        status: 500,
      },
    )
  }
}
