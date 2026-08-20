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
  process.env.GEMINI_MODEL || "gemini-3.7-flash"

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

type JarvisResponse = {
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
  input: unknown,
): BookingData {
  if (
    !input ||
    typeof input !== "object"
  ) {
    return {
      ...EMPTY_BOOKING,
    }
  }

  const data =
    input as Partial<BookingData>

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
// UHRZEIT ERKENNEN
// =====================================================

function normalizeTime(
  text: string,
): string | null {
  const value = text
    .toLowerCase()
    .replace(/,/g, ".")
    .trim()

  // halb 8 = 19:30
  const halb =
    value.match(
      /\bhalb\s+(\d{1,2})\b/,
    )

  if (halb) {
    let hour =
      Number(halb[1]) - 1

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
  const numeric =
    value.match(
      /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
    )

  if (numeric) {
    const hour =
      Number(numeric[1])

    const minute =
      Number(numeric[2])

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

  // Nur 20
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
// MONATE
// =====================================================

const MONTHS: Record<
  string,
  number
> = {
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
  const value = text
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const [
    year,
    month,
    day,
  ] = today
    .split("-")
    .map(Number)

  // Morgen
  if (/\bmorgen\b/.test(value)) {
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day + 1,
        ),
      )

    return date
      .toISOString()
      .slice(0, 10)
  }

  // Übermorgen
  if (
    /\bübermorgen\b/.test(value) ||
    /\buebermorgen\b/.test(value)
  ) {
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day + 2,
        ),
      )

    return date
      .toISOString()
      .slice(0, 10)
  }

  // 20.08.2026
  const numeric =
    value.match(
      /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
    )

  if (numeric) {
    const dateDay =
      Number(numeric[1])

    const dateMonth =
      Number(numeric[2])

    let dateYear =
      numeric[3]
        ? Number(numeric[3])
        : year

    if (
      dateYear < 100
    ) {
      dateYear += 2000
    }

    if (
      dateDay >= 1 &&
      dateDay <= 31 &&
      dateMonth >= 1 &&
      dateMonth <= 12
    ) {
      return `${String(
        dateYear,
      ).padStart(4, "0")}-${String(
        dateMonth,
      ).padStart(2, "0")}-${String(
        dateDay,
      ).padStart(2, "0")}`
    }
  }

  // 20. August
  const monthNames =
    Object.keys(
      MONTHS,
    ).join("|")

  const named =
    value.match(
      new RegExp(
        `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
        "i",
      ),
    )

  if (named) {
    const dateDay =
      Number(named[1])

    const dateMonth =
      MONTHS[
        named[2].toLowerCase()
      ]

    const dateYear =
      named[3]
        ? Number(named[3])
        : year

    if (
      dateDay >= 1 &&
      dateDay <= 31 &&
      dateMonth
    ) {
      return `${String(
        dateYear,
      ).padStart(4, "0")}-${String(
        dateMonth,
      ).padStart(2, "0")}-${String(
        dateDay,
      ).padStart(2, "0")}`
    }
  }

  return null
}

// =====================================================
// DIREKTE DATEN
// =====================================================

function extractDirectBookingData(
  text: string,
  today: string,
): Partial<BookingData> {
  const result: Partial<BookingData> =
    {}

  const time =
    normalizeTime(text)

  if (time) {
    result.booking_time =
      time
  }

  const date =
    normalizeDate(
      text,
      today,
    )

  if (date) {
    result.booking_date =
      date
  }

  return result
}

// =====================================================
// TERMIN-INTENTION
// =====================================================

function containsBookingIntent(
  text: string,
) {
  const value =
    text.toLowerCase()

  const patterns = [
    "termin",
    "werkstatttermin",
    "termin machen",
    "termin buchen",
    "termin erstellen",
    "termin vereinbaren",
    "buchung",
    "buchen",
    "reservieren",
    "vereinbaren",
  ]

  return patterns.some(
    (pattern) =>
      value.includes(pattern),
  )
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
  ] = value
    .split("-")
    .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    )

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
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
  conversation: string,
  booking: BookingData,
  currentDate: string,
  currentDateTime: string,
) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt.",
    )
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    })

  const prompt = `
Du bist JARVIS, der intelligente KI-Assistent von MB-Performance.

Du bist ein normaler, hilfreicher KI-Assistent und kannst normale Fragen beantworten.

Du kannst zum Beispiel Fragen beantworten über:

- Autos
- BMW
- Mercedes
- Technik
- Computer
- Programmierung
- Alltag
- Allgemeinwissen
- Erklärungen
- MB-Performance
- Werkstatt
- Reparaturen
- Wartung

Du darfst normale Fragen ausführlich und natürlich beantworten.

WICHTIG:
Du bist NICHT nur ein Termin-Assistent.

Wenn der Benutzer keine Buchung möchte,
beantworte seine Frage ganz normal.

--------------------------------------------------
AKTUELLE ZEIT
--------------------------------------------------

Datum:
${currentDate}

Datum und Uhrzeit:
${currentDateTime}

Zeitzone:
Europe/Zurich

--------------------------------------------------
TERMINREGELN
--------------------------------------------------

Termine sind zwischen 15:00 und 22:00 Uhr möglich.

Wenn der Benutzer einen Termin möchte,
verwende intent = "booking".

Wenn es eine normale Frage ist,
verwende intent = "chat".

--------------------------------------------------
BEREITS ERKANNTE TERMIN-DATEN
--------------------------------------------------

${JSON.stringify(
  booking,
  null,
  2,
)}

Diese Daten dürfen NICHT verloren gehen.

Wenn beispielsweise:

booking_time = "20:00"

gesetzt ist, darfst du es NICHT wieder auf null setzen.

--------------------------------------------------
KONVERSATION
--------------------------------------------------

${conversation}

--------------------------------------------------
ANTWORT
--------------------------------------------------

Bei normalen Fragen:

intent = "chat"

Beispiel:

Benutzer:
Was ist ein BMW M4?

Dann antworte normal:

"Der BMW M4 ist die sportliche Variante der 4er-Reihe..."

Bei einem Termin:

intent = "booking"

Sammle die Informationen.

Benötigt werden:

booking_date
booking_time
name
phone
email
car
problem

Erfinde niemals Daten.

Wenn Daten fehlen, stelle eine kurze Frage.

--------------------------------------------------
WICHTIG FÜR DIE KONVERSATION
--------------------------------------------------

Beziehe dich auf vorherige Nachrichten.

Wenn der Benutzer sagt:

"Und wie viel PS hat er?"

und vorher über den BMW M4 gesprochen wurde,
verstehe, dass "er" den BMW M4 meint.

Wenn der Benutzer sagt:

"Was ist mit dem M3?"

verstehe den Zusammenhang mit dem bisherigen Gespräch.

Du sollst den Chat wie ein echter Gesprächspartner verstehen.

--------------------------------------------------
JSON
--------------------------------------------------

Antworte ausschließlich mit diesem JSON:

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
  "answer": "deine natürliche Antwort"
}
`

  const response =
    await ai.models.generateContent({
      model: MODEL,
      contents: prompt,

      config: {
        temperature: 0.4,

        maxOutputTokens: 1000,

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
      "Gemini hat keine Antwort geliefert.",
    )
  }

  return JSON.parse(
    text,
  ) as JarvisResponse
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY fehlt in Vercel.",
        },
        {
          status: 500,
        },
      )
    }

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
        (
          message: ChatMessage,
        ) =>
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

    if (
      validMessages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Keine gültigen Nachrichten.",
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
    // BOOKING
    // =================================================

    let booking =
      normalizeBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE USER-NACHRICHT
    // =================================================

    const lastUser =
      [...validMessages]
        .reverse()
        .find(
          (
            message: ChatMessage,
          ) =>
            message.role ===
            "user",
        )

    const lastUserText =
      lastUser?.content || ""

    // =================================================
    // DIREKTE DATEN
    // =================================================

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
      )

    booking =
      mergeBooking(
        booking,
        directData,
      )

    // =================================================
    // BOOKING INTENT
    // =================================================

    const bookingIntent =
      containsBookingIntent(
        lastUserText,
      ) ||
      (
        !!body?.bookingData &&
        getMissingField(
          booking,
        ) !== null
      )

    // =================================================
    // KONVERSATION
    // =================================================

    const conversation =
      validMessages
        .map(
          (
            msg: ChatMessage,
          ) =>
            `${msg.role === "user"
              ? "BENUTZER"
              : "JARVIS"}: ${msg.content}`,
        )
        .join("\n\n")

    // =================================================
    // GEMINI
    // =================================================

    let result: JarvisResponse

    try {
      result =
        await askGemini(
          conversation,
          booking,
          currentDate,
          currentDateTime,
        )
    } catch (error) {
      console.error(
        "GEMINI ERROR:",
        error,
      )

      // ===============================================
      // FALLBACK
      // ===============================================

      if (!bookingIntent) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Gemini konnte nicht antworten.",
          },
          {
            status: 500,
          },
        )
      }

      result = {
        intent: "booking",

        booking: {
          ...booking,
        },

        answer: "",
      }
    }

    // =================================================
    // CHAT
    // =================================================

    if (
      result.intent !==
      "booking"
    ) {
      return NextResponse.json({
        answer:
          result.answer ||
          "Natürlich. Wie kann ich dir helfen?",

        bookingCreated:
          false,

        bookingInProgress:
          false,

        bookingData:
          booking,
      })
    }

    // =================================================
    // BOOKING DATEN
    // =================================================

    booking =
      mergeBooking(
        booking,
        result.booking || {},
      )

    // Direkte Erkennung hat Vorrang

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
    // VERGANGEN
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
          booking_date:
            null,
        },
      })
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
      booking.booking_time =
        null
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
    // TERMIN ERSTELLEN
    // =================================================

    const bookingResult =
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

    if (
      !bookingResult.ok
    ) {
      return NextResponse.json({
        answer:
          bookingResult.error ||
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

      bookingCreated:
        true,

      bookingId:
        bookingResult.bookingId,

      bookingData:
        EMPTY_BOOKING,

      bookingInProgress:
        false,
    })
  } catch (error) {
    console.error(
      "JARVIS API ERROR:",
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
