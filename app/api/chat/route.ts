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

const apiKey =
  process.env.GEMINI_API_KEY

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
// LEERE TERMIN-DATEN
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
// SCHWEIZER DATUM
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
// SCHWEIZER DATUM + UHRZEIT
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
// JSON BEREINIGEN
// =====================================================

function cleanJson(text: string) {
  return text
    .replace(
      /^```json\s*/i,
      "",
    )
    .replace(
      /^```\s*/i,
      "",
    )
    .replace(
      /\s*```$/i,
      "",
    )
    .trim()
}

// =====================================================
// LEEREN TERMIN ERSTELLEN
// =====================================================

function emptyBooking(): BookingData {
  return {
    ...EMPTY_BOOKING,
  }
}

// =====================================================
// TERMIN-DATEN ZUSAMMENFÜHREN
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
// UHRZEIT ERKENNEN
//
// Beispiele:
//
// 20 Uhr       -> 20:00
// 20uhr        -> 20:00
// um 20 Uhr   -> 20:00
// 20:00        -> 20:00
// 20.00        -> 20:00
// 8 Uhr abends -> 20:00
// halb 8       -> 19:30
// =====================================================

function normalizeTime(
  text: string,
): string | null {
  const value = text
    .toLowerCase()
    .trim()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")

  // ---------------------------------------------------
  // "halb 8"
  // ---------------------------------------------------

  const halbMatch =
    value.match(
      /\bhalb\s+(\d{1,2})\b/,
    )

  if (halbMatch) {
    let hour =
      Number(halbMatch[1]) - 1

    if (hour < 15) {
      hour += 12
    }

    if (
      hour >= 15 &&
      hour <= 21
    ) {
      return `${String(hour).padStart(2, "0")}:30`
    }
  }

  // ---------------------------------------------------
  // "20 Uhr"
  // "20 uhr"
  // "um 20 Uhr"
  // "8 Uhr abends"
  // ---------------------------------------------------

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

    // 8 Uhr abends -> 20:00
    if (
      value.includes("abends") &&
      hour >= 1 &&
      hour <= 12
    ) {
      hour += 12
    }

    // 8 Uhr morgens -> 08:00
    // wird später wegen Öffnungszeiten
    // abgelehnt, falls nötig.

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    }

    return null
  }

  // ---------------------------------------------------
  // "20:00"
  // "20.00"
  // ---------------------------------------------------

  const numericMatch =
    value.match(
      /\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/,
    )

  if (numericMatch) {
    const hour =
      Number(numericMatch[1])

    const minute =
      Number(numericMatch[2])

    if (
      hour >= 15 &&
      hour <= 22 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    }
  }

  // ---------------------------------------------------
  // Nur "20"
  //
  // Nur verwenden, wenn es sehr wahrscheinlich
  // eine Uhrzeit ist.
  // ---------------------------------------------------

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
      return `${String(hour).padStart(2, "0")}:00`
    }
  }

  return null
}

// =====================================================
// MONATSNAMEN
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
//
// Beispiele:
//
// 18. Oktober
// 18 Oktober
// am 18. Oktober
// 18.10.
// 18.10.2026
// =====================================================

function normalizeDate(
  text: string,
  today: string,
): string | null {
  const value = text
    .toLowerCase()
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")

  const [
    currentYear,
    currentMonth,
    currentDay,
  ] = today
    .split("-")
    .map(Number)

  // ---------------------------------------------------
  // "morgen"
  // ---------------------------------------------------

  if (
    /\bmorgen\b/.test(
      value,
    )
  ) {
    const date =
      new Date(
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
  // "übermorgen"
  // ---------------------------------------------------

  if (
    /\bübermorgen\b/.test(
      value,
    ) ||
    /\buebermorgen\b/.test(
      value,
    )
  ) {
    const date =
      new Date(
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
  // DD.MM.YYYY
  // DD.MM.YY
  // ---------------------------------------------------

  const numericFull =
    value.match(
      /\b(?:am\s+)?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/,
    )

  if (numericFull) {
    const day =
      Number(numericFull[1])

    const month =
      Number(numericFull[2])

    let year =
      numericFull[3]
        ? Number(
            numericFull[3],
          )
        : currentYear

    if (
      year < 100
    ) {
      year += 2000
    }

    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  // ---------------------------------------------------
  // "18. Oktober"
  // "18 Oktober"
  // ---------------------------------------------------

  const monthNames =
    Object.keys(
      MONTHS,
    ).join("|")

  const namedDate =
    value.match(
      new RegExp(
        `\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
        "i",
      ),
    )

  if (namedDate) {
    const day =
      Number(namedDate[1])

    const month =
      MONTHS[
        namedDate[2].toLowerCase()
      ]

    const year =
      namedDate[3]
        ? Number(namedDate[3])
        : currentYear

    if (
      month &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  return null
}

// =====================================================
// DATUM GÜLTIG?
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

  const date =
    new Date(
      `${value}T00:00:00`,
    )

  return !Number.isNaN(
    date.getTime(),
  )
}

// =====================================================
// UHRZEIT GÜLTIG?
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
// DATUM IN BENUTZER-FORMAT
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
// FEHLENDE DATEN
// =====================================================

function getMissingField(
  booking: BookingData,
): keyof BookingData | null {
  if (
    !booking.booking_date
  ) {
    return "booking_date"
  }

  if (
    !booking.booking_time
  ) {
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
// FRAGE FÜR FEHLENDES FELD
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
// TERMIN-ABSICHT ERKENNEN
// =====================================================

function containsBookingIntent(
  text: string,
) {
  const value =
    text.toLowerCase()

  const patterns = [
    "termin",
    "termin machen",
    "termin erstellen",
    "termin buchen",
    "termin vereinbaren",
    "werkstatttermin",
    "buchung",
    "buchen",
    "reservieren",
    "vereinbaren",
    "mach mir einen termin",
    "mache mir einen termin",
  ]

  return patterns.some(
    (pattern) =>
      value.includes(
        pattern,
      ),
  )
}

// =====================================================
// EINFACHE DATEN AUS BENUTZER-TEXT ERKENNEN
// =====================================================

function extractDirectBookingData(
  text: string,
  today: string,
): Partial<BookingData> {
  const result: Partial<BookingData> =
    {}

  const detectedTime =
    normalizeTime(text)

  if (detectedTime) {
    result.booking_time =
      detectedTime
  }

  const detectedDate =
    normalizeDate(
      text,
      today,
    )

  if (detectedDate) {
    result.booking_date =
      detectedDate
  }

  return result
}

// =====================================================
// TERMIN-ZWISCHENSTAND AUS CLIENT SICHER NORMALISIEREN
// =====================================================

function normalizeClientBooking(
  input: unknown,
): BookingData {
  if (
    !input ||
    typeof input !==
      "object"
  ) {
    return emptyBooking()
  }

  const data =
    input as Partial<BookingData>

  return {
    booking_date:
      typeof data.booking_date ===
      "string"
        ? data.booking_date
        : null,

    booking_time:
      typeof data.booking_time ===
      "string"
        ? data.booking_time
        : null,

    name:
      typeof data.name ===
      "string"
        ? data.name
        : null,

    phone:
      typeof data.phone ===
      "string"
        ? data.phone
        : null,

    email:
      typeof data.email ===
      "string"
        ? data.email
        : null,

    car:
      typeof data.car ===
      "string"
        ? data.car
        : null,

    problem:
      typeof data.problem ===
      "string"
        ? data.problem
        : null,
  }
}

// =====================================================
// GEMINI AUFRUF
// =====================================================

async function askGemini(
  prompt: string,
) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY ist nicht eingerichtet.",
    )
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    })

  /*
   * WICHTIG:
   *
   * Wir verwenden hier das Modell,
   * das in deiner bisherigen API-Konfiguration
   * vorgesehen ist.
   *
   * Falls Google bei deinem API-Key ein anderes
   * Modell freigibt, kannst du es über
   * GEMINI_MODEL in Vercel/.env.local ändern.
   */

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash"

  try {
    const response =
      await ai.models.generateContent(
        {
          model,
          contents: prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 700,
            responseMimeType:
              "application/json",
          },
        },
      )

    return (
      response.text?.trim() ||
      ""
    )
  } catch (error) {
    console.error(
      "GEMINI ERROR:",
      error,
    )

    throw error
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
    // REQUEST
    // =================================================

    const body =
      await request.json()

    const messages =
      body?.messages as ChatMessage[]

    if (
      !Array.isArray(
        messages,
      ) ||
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
    // GÜLTIGE NACHRICHTEN
    // =================================================

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
          message.content.trim()
            .length > 0,
      )

    if (
      validMessages.length ===
      0
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
    // AKTUELLES DATUM
    // =================================================

    const currentDate =
      getZurichDate()

    const currentDateTime =
      getZurichDateTime()

    // =================================================
    // CLIENT-BOOKING
    // =================================================

    let booking =
      normalizeClientBooking(
        body?.bookingData,
      )

    // =================================================
    // LETZTE BENUTZER-NACHRICHT
    // =================================================

    const lastUserMessage =
      [...validMessages]
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
    // DIREKT DATUM/UHRZEIT ERKENNEN
    //
    // DAS IST WICHTIG:
    //
    // "20 Uhr" wird hier direkt zu
    // "20:00", ohne dass Gemini das
    // zwingend erkennen muss.
    // =================================================

    const directData =
      extractDirectBookingData(
        lastUserText,
        currentDate,
      )

    booking =
      mergeBookingData(
        booking,
        directData,
      )

    console.log(
      "JARVIS DIRECT DATA:",
      directData,
    )

    console.log(
      "JARVIS BOOKING BEFORE GEMINI:",
      booking,
    )

    // =================================================
    // TERMINABSICHT
    // =================================================

    const bookingIntent =
      containsBookingIntent(
        lastUserText,
      ) ||
      !!body?.bookingData &&
        getMissingField(
          booking,
        ) !== null

    // =================================================
    // KONVERSATION
    // =================================================

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

    // =================================================
    // GEMINI PROMPT
    // =================================================

    const extractionPrompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Du kommunizierst auf Deutsch.

AKTUELLES DATUM:
${currentDate}

AKTUELLES DATUM UND UHRZEIT:
${currentDateTime}

ZEITZONE:
Europe/Zurich

TERMINZEITEN:
15:00 bis 22:00 Uhr.

-----------------------------------------------------
WICHTIG
-----------------------------------------------------

Analysiere den bisherigen Chat.

Der Benutzer möchte eventuell einen Werkstatttermin erstellen.

Wenn der Benutzer einen Termin möchte:

intent = "booking"

Wenn der Benutzer nur eine normale Frage stellt:

intent = "chat"

Erfinde niemals Kundendaten.

Verwende nur Informationen, die der Benutzer genannt hat.

-----------------------------------------------------
DATUM
-----------------------------------------------------

Deutsches Datum muss in YYYY-MM-DD umgewandelt werden.

Beispiele:

"18. Oktober"
"18 Oktober"
"am 18. Oktober"

Wenn das aktuelle Jahr ${currentDate.slice(
      0,
      4,
    )} ist und kein Jahr genannt wurde,
verwende dieses Jahr.

"morgen" = tatsächliches morgiges Datum.

"übermorgen" = tatsächliches übermorgiges Datum.

-----------------------------------------------------
UHRZEIT
-----------------------------------------------------

Ganz wichtig:

"20 Uhr" = "20:00"

"20 uhr" = "20:00"

"um 20 Uhr" = "20:00"

"20:00" = "20:00"

"20.00" = "20:00"

"halb 8" = "19:30"

"8 Uhr abends" = "20:00"

Termine sind nur zwischen 15:00 und 22:00 Uhr möglich.

-----------------------------------------------------
BEREITS ERKANNTE TERMIN-DATEN
-----------------------------------------------------

${JSON.stringify(
      booking,
      null,
      2,
    )}

Diese bereits erkannten Daten dürfen NICHT verloren gehen.

Wenn booking_time bereits "20:00" ist,
darfst du booking_time NICHT wieder auf null setzen.

Wenn booking_date bereits gesetzt ist,
darfst du booking_date NICHT wieder auf null setzen.

-----------------------------------------------------
BENÖTIGTE TERMIN-DATEN
-----------------------------------------------------

booking_date
booking_time
name
phone
email
car
problem

-----------------------------------------------------
JSON-FORMAT
-----------------------------------------------------

Antworte ausschließlich mit gültigem JSON.

Format:

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

-----------------------------------------------------
NORMALE FRAGE
-----------------------------------------------------

Bei einer normalen Frage:

intent = "chat"

Beispiel:

BENUTZER:
Was ist ein BMW M4?

Dann antworte natürlich auf Deutsch.

-----------------------------------------------------
TERMIN
-----------------------------------------------------

Bei einem Terminwunsch:

intent = "booking"

Wenn Angaben fehlen, answer darf eine kurze Frage enthalten.

Beispiel:

"Wie ist dein Name?"

Wenn alle Angaben vorhanden sind:

answer = "TERMIN_BEREIT"

-----------------------------------------------------
BISHERIGER CHAT
-----------------------------------------------------

${conversation}

-----------------------------------------------------
LETZTE BENUTZER-NACHRICHT
-----------------------------------------------------

${lastUserText}

Analysiere jetzt die Anfrage.

Denke besonders daran:

"20 Uhr" muss immer als "20:00" erkannt werden.

Gib ausschließlich gültiges JSON zurück.
`

    // =================================================
    // GEMINI NUR BEI BEDARF
    // =================================================

    let analysis: JarvisAnalysis

    /*
     * Wenn wir eindeutig eine reine Antwort auf
     * eine Terminfrage erhalten haben, können wir
     * Gemini trotzdem benutzen, aber wir geben ihm
     * den bereits erkannten Wert mit.
     */

    try {
      const raw =
        await askGemini(
          extractionPrompt,
        )

      if (!raw) {
        throw new Error(
          "Gemini hat keine Antwort zurückgegeben.",
        )
      }

      console.log(
        "GEMINI RAW:",
        raw,
      )

      const parsed =
        JSON.parse(
          cleanJson(raw),
        )

      const parsedBooking =
        parsed?.booking &&
        typeof parsed.booking ===
          "object"
          ? parsed.booking
          : {}

      analysis = {
        intent:
          parsed?.intent ===
          "booking"
            ? "booking"
            : "chat",

        booking: {
          ...EMPTY_BOOKING,
          ...parsedBooking,
        },

        answer:
          typeof parsed?.answer ===
          "string"
            ? parsed.answer
            : "",
      }
    } catch (error) {
      console.error(
        "GEMINI PARSE ERROR:",
        error,
      )

      /*
       * FALLBACK:
       *
       * Wenn Gemini die Antwort nicht versteht,
       * verwenden wir die direkt erkannten
       * Termin-Daten.
       *
       * Das verhindert z.B., dass
       * "20 Uhr" die komplette Buchung zerstört.
       */

      if (
        bookingIntent
      ) {
        analysis = {
          intent: "booking",
          booking: {
            ...EMPTY_BOOKING,
          },
          answer: "",
        }
      } else {
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
    }

    // =================================================
    // ANALYSE MIT CLIENT-DATEN ZUSAMMENFÜHREN
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

      // Direkte Erkennung hat Priorität
      // bei Datum und Uhrzeit.

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
    // NORMALE FRAGE
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
    // TERMIN ERKANNT
    // =================================================

    console.log(
      "JARVIS FINAL BOOKING:",
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
    // UHRZEIT PRÜFEN
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
          booking_date:
            null,
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
    // TERMINZEIT NOCHMAL PRÜFEN
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
          booking_time:
            null,
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

    console.log(
      "========================================",
    )

    console.log(
      "JARVIS → CREATE BOOKING",
    )

    console.log(
      booking,
    )

    console.log(
      "========================================",
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
        "CREATE BOOKING FAILED:",
        result.error,
      )

      /*
       * Wenn der Slot bereits vergeben ist,
       * soll JARVIS direkt nach einer anderen
       * Uhrzeit fragen.
       */

      if (
        result.error
          ?.toLowerCase()
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
            booking_time:
              null,
          },

          missing:
            "booking_time",
        })
      }

      return NextResponse.json({
        answer:
          `Ich konnte den Termin leider nicht erstellen. ${
            result.error ||
            "Bitte versuche es erneut."
          }`,

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
      "========================================",
    )

    console.log(
      "JARVIS BOOKING CREATED",
    )

    console.log(
      "Booking ID:",
      result.bookingId,
    )

    console.log(
      "========================================",
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
    // =================================================
    // GLOBALER FEHLER
    // =================================================

    console.error(
      "========================================",
    )

    console.error(
      "JARVIS CHAT ERROR",
    )

    console.error(
      error,
    )

    console.error(
      "========================================",
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
