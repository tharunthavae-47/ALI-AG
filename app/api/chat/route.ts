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
  process.env.GEMINI_MODEL || "gemini-3.6-flash"

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
  intent: "chat" | "booking"

  booking: Partial<BookingData>

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
// JSON BEREINIGEN
// =====================================================

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

// =====================================================
// BOOKING MERGEN
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
// CLIENT BOOKING NORMALISIEREN
// =====================================================

function normalizeClientBooking(
  input: unknown,
): BookingData {
  if (!input || typeof input !== "object") {
    return emptyBooking()
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
// UHRZEIT ERKENNEN
// =====================================================

function normalizeTime(
  text: string,
): string | null {
  const value = text
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim()

  // ---------------------------------------------------
  // halb 8 -> 19:30
  // halb 7 -> 18:30
  // ---------------------------------------------------

  const halbMatch = value.match(
    /\bhalb\s+(\d{1,2})\b/,
  )

  if (halbMatch) {
    let hour = Number(halbMatch[1]) - 1

    if (hour < 12) {
      hour += 12
    }

    if (hour >= 15 && hour <= 22) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:30`
    }
  }

  // ---------------------------------------------------
  // 20 Uhr
  // 20 Uhr abends
  // um 20 Uhr
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // 20:00
  // 20.00
  // ---------------------------------------------------

  const numericMatch = value.match(
    /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
  )

  if (numericMatch) {
    const hour = Number(
      numericMatch[1],
    )

    const minute = Number(
      numericMatch[2],
    )

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

  // ---------------------------------------------------
  // Nur Stunde
  // z.B. "20"
  // ---------------------------------------------------

  const onlyHour = value.match(
    /^(?:um\s*)?(\d{1,2})$/,
  )

  if (onlyHour) {
    const hour = Number(
      onlyHour[1],
    )

    if (hour >= 15 && hour <= 22) {
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

  // ---------------------------------------------------
  // morgen
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // übermorgen
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // 18.10.2026
  // 18/10/2026
  // 18-10-2026
  // ---------------------------------------------------

  const numericFull = value.match(
    /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
  )

  if (numericFull) {
    const day = Number(
      numericFull[1],
    )

    const month = Number(
      numericFull[2],
    )

    let year = numericFull[3]
      ? Number(numericFull[3])
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

  // ---------------------------------------------------
  // 18. Oktober
  // 18 Oktober
  // ---------------------------------------------------

  const monthNames =
    Object.keys(MONTHS).join("|")

  const namedDate = value.match(
    new RegExp(
      `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
      "i",
    ),
  )

  if (namedDate) {
    const day = Number(
      namedDate[1],
    )

    const month =
      MONTHS[
        namedDate[2].toLowerCase()
      ]

    const year = namedDate[3]
      ? Number(namedDate[3])
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
// DIREKTE DATEN ERKENNEN
// =====================================================

function extractDirectBookingData(
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
    "termin",
    "werkstatttermin",
    "buchung",
    "termin buchen",
    "termin machen",
    "termin erstellen",
    "termin vereinbaren",
    "termin reservieren",
    "einen termin",
    "einem termin",
    "termin bei euch",
    "termin bei euch machen",
  ]

  return patterns.some(
    (pattern) =>
      value.includes(pattern),
  )
}

// =====================================================
// FEHLENDES BUCHUNGSFELD
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
): string {
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
// VALID DATE
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

  const date = new Date(
    `${value}T00:00:00`,
  )

  return !Number.isNaN(
    date.getTime(),
  )
}

// =====================================================
// VALID TIME
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
  ] = value.split(":").map(Number)

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
// GEMINI
// =====================================================

async function askGemini(
  conversation: string,
  booking: BookingData,
  lastUserMessage: string,
  currentDate: string,
  currentDateTime: string,
) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt.",
    )
  }

  const ai = new GoogleGenAI({
    apiKey,
  })

  const systemInstruction = `
Du bist JARVIS, der intelligente KI-Assistent von MB-Performance.

Du bist eine normale, intelligente KI.

Du darfst normale Fragen frei und natürlich beantworten.

WICHTIG:

Nicht jede Nachricht ist eine Terminbuchung.

Wenn der Benutzer eine normale Frage stellt, MUSST du diese direkt beantworten.

Beispiele:

"Was ist ein BMW M4?"
→ normale Antwort über den BMW M4.

"Was bedeutet PS?"
→ normale Erklärung.

"Wie funktioniert ein Turbolader?"
→ normale technische Erklärung.

"Was kannst du?"
→ erkläre deine Fähigkeiten.

"Hallo"
→ freundlich antworten.

Nur wenn der Benutzer tatsächlich einen Werkstatttermin möchte,
soll intent = "booking" verwendet werden.

--------------------------------------------------
MB-PERFORMANCE
--------------------------------------------------

Du bist der Assistent von MB-Performance.

Du kannst unter anderem helfen bei:

- Fahrzeugen
- BMW
- Mercedes
- Audi
- Reparaturen
- Diagnose
- Wartung
- Inspektion
- MFK
- Ölwechsel
- Reifenservice
- allgemeinen Autothemen
- technischen Fragen

Wenn du etwas nicht sicher weißt, erfinde keine Fakten.

--------------------------------------------------
TERMINBUCHUNG
--------------------------------------------------

Ein Termin wird nur gestartet, wenn der Benutzer ausdrücklich
einen Termin buchen, vereinbaren, reservieren oder erstellen möchte.

Benötigte Daten:

booking_date
booking_time
name
phone
email
car
problem

Bereits vorhandene Daten dürfen niemals verloren gehen.

--------------------------------------------------
DATUM
--------------------------------------------------

Heute:

${currentDate}

Aktuelles Datum und Uhrzeit:

${currentDateTime}

Zeitzone:

Europe/Zurich

"Morgen" bedeutet das tatsächliche Datum morgen.

"Übermorgen" bedeutet das tatsächliche Datum übermorgen.

--------------------------------------------------
UHRZEIT
--------------------------------------------------

"20 Uhr" = "20:00"

"um 20 Uhr" = "20:00"

"20:00" = "20:00"

"20.00" = "20:00"

"halb 8" = "19:30"

Termine sind zwischen 15:00 und 22:00 möglich.

--------------------------------------------------
BEREITS ERKANNTE DATEN
--------------------------------------------------

${JSON.stringify(
  booking,
  null,
  2,
)}

--------------------------------------------------
KONVERSATION
--------------------------------------------------

${conversation}

--------------------------------------------------
LETZTE BENUTZERNACHRICHT
--------------------------------------------------

${lastUserMessage}

--------------------------------------------------
ANTWORTFORMAT
--------------------------------------------------

Antworte ausschließlich als gültiges JSON:

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
  "answer": "Deine natürliche Antwort"
}

--------------------------------------------------
SEHR WICHTIG
--------------------------------------------------

Bei normalen Fragen:

intent = "chat"

Beantworte die Frage vollständig und natürlich.

Bei Terminwunsch:

intent = "booking"

Wenn Daten fehlen, frage nur nach der nächsten benötigten Information.

Wenn alle Daten vorhanden sind:

answer = "TERMIN_BEREIT"

Gib niemals eine Buchungsfrage zurück, wenn der Benutzer
gar keinen Termin möchte.
`

  const response =
    await ai.models.generateContent({
      model: MODEL,
      contents: systemInstruction,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1200,
        responseMimeType:
          "application/json",
      },
    })

  const text =
    response.text?.trim()

  if (!text) {
    throw new Error(
      "Gemini hat keine Antwort zurückgegeben.",
    )
  }

  return JSON.parse(
    cleanJson(text),
  ) as GeminiBookingResult
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
    // NUR GÜLTIGE NACHRICHTEN
    // =================================================

    const validMessages =
      messages.filter(
        (message: unknown) => {
          if (
            !message ||
            typeof message !==
              "object"
          ) {
            return false
          }

          const item =
            message as ChatMessage

          return (
            (
              item.role ===
                "user" ||
              item.role ===
                "assistant"
            ) &&
            typeof item.content ===
              "string" &&
            item.content.trim()
              .length > 0
          )
        },
      ) as ChatMessage[]

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
    // ZEIT
    // =================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =================================================
    // BOOKING
    // =================================================

    let booking =
      normalizeClientBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE USER MESSAGE
    // =================================================

    const lastUserMessage =
      [...validMessages]
        .reverse()
        .find(
          (item) =>
            item.role ===
            "user",
        )

    const lastUserText =
      lastUserMessage?.content || ""

    // =================================================
    // DIREKTE DATUM/UHRZEIT
    // =================================================

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
      )

    // =================================================
    // WICHTIG:
    //
    // Direkte Daten werden NUR gespeichert.
    //
    // Sie starten NICHT automatisch eine Buchung.
    // =================================================

    booking =
      mergeBookingData(
        booking,
        directData,
      )

    // =================================================
    // ECHTE TERMINABSICHT
    // =================================================

    const explicitBookingIntent =
      containsBookingIntent(
        lastUserText,
      )

    // Wenn bereits eine Buchung läuft,
    // darf die nächste Antwort weiterhin
    // Teil der Buchung sein.

    const hasBookingData =
      Object.values(booking).some(
        (value) =>
          value !== null &&
          value !== "",
      )

    const bookingInProgress =
      body?.bookingData &&
      hasBookingData

    const shouldHandleBooking =
      explicitBookingIntent ||
      Boolean(bookingInProgress)

    // =================================================
    // KONVERSATION
    // =================================================

    const conversation =
      validMessages
        .map(
          (item) =>
            `${
              item.role ===
              "user"
                ? "BENUTZER"
                : "JARVIS"
            }: ${item.content}`,
        )
        .join("\n")

    // =================================================
    // GEMINI
    // =================================================

    let analysis:
      | GeminiBookingResult
      | null = null

    try {
      analysis =
        await askGemini(
          conversation,
          booking,
          lastUserText,
          currentDate,
          currentDateTime,
        )
    } catch (error) {
      console.error(
        "================================",
      )

      console.error(
        "GEMINI ERROR",
      )

      console.error(
        error,
      )

      console.error(
        "MODEL:",
        MODEL,
      )

      console.error(
        "API KEY PRESENT:",
        Boolean(apiKey),
      )

      console.error(
        "================================",
      )

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Gemini konnte nicht erreicht werden.",
        },
        {
          status: 500,
        },
      )
    }

    // =================================================
    // GEMINI BUCHUNGSDATEN
    // =================================================

    if (
      analysis.intent ===
      "booking"
    ) {
      booking =
        mergeBookingData(
          booking,
          analysis.booking,
        )

      // Direkte Erkennung hat Priorität.

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
    }

    // =================================================
    // NORMALE KI-ANTWORT
    // =================================================

    if (
      analysis.intent !==
      "booking"
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
          booking,
      })
    }

    // =================================================
    // TERMIN
    // =================================================

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
      booking.booking_date =
        null
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
    // ZEIT NOCHMAL PRÜFEN
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

    if (
      alreadyBooked
    ) {
      return NextResponse.json({
        answer:
          `Der Termin am ${formatDate(
            booking.booking_date!,
          )} um ${booking.booking_time} Uhr ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,

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
    // BUCHUNG ERSTELLEN
    // =================================================

    console.log(
      "================================",
    )

    console.log(
      "JARVIS → CREATE BOOKING",
    )

    console.log(
      booking,
    )

    console.log(
      "================================",
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
    // BUCHUNG FEHLGESCHLAGEN
    // =================================================

    if (!result.ok) {
      console.error(
        "CREATE BOOKING FAILED:",
        result.error,
      )

      const errorText =
        result.error ||
        "Bitte versuche es erneut."

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
            )} um ${booking.booking_time} Uhr ist leider bereits vergeben. Welche andere Uhrzeit möchtest du?`,

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
          `Ich konnte den Termin leider nicht erstellen. ${errorText}`,

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
      "JARVIS BOOKING CREATED:",
      result.bookingId,
    )

    return NextResponse.json({
      answer:
        `Erledigt. Dein Termin bei MB-Performance wurde erfolgreich erstellt. 📅 ${dateText} um ${timeText} Uhr für ${booking.car}. Dein Anliegen: ${booking.problem}. Der Termin wurde als Anfrage eingetragen.`,

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
      "================================",
    )

    console.error(
      "JARVIS CHAT ERROR",
    )

    console.error(
      error,
    )

    console.error(
      "================================",
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
