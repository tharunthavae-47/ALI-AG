import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error(
    "GEMINI_API_KEY fehlt."
  )
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
})

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export async function POST(
  request: Request
) {
  try {
    // ==========================================
    // REQUEST LESEN
    // ==========================================

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
        }
      )
    }

    // ==========================================
    // NUR GÜLTIGE NACHRICHTEN
    // ==========================================

    const validMessages =
      messages.filter(
        (msg) =>
          msg &&
          (msg.role === "user" ||
            msg.role === "assistant") &&
          typeof msg.content ===
            "string" &&
          msg.content.trim()
      )

    // ==========================================
    // CHATVERLAUF FÜR GEMINI
    // ==========================================

    const conversation =
      validMessages
        .map((msg) => {
          const role =
            msg.role === "assistant"
              ? "JARVIS"
              : "BENUTZER"

          return `${role}: ${msg.content}`
        })
        .join("\n\n")

    // ==========================================
    // SYSTEM-INSTRUKTION
    // ==========================================

    const prompt = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

WICHTIG:

- Du antwortest auf Deutsch.
- Du bist freundlich, professionell und natürlich.
- Du antwortest möglichst schnell und direkt.
- Halte Antworten normalerweise kurz.
- Bei einfachen Fragen reichen 1 bis 3 Sätze.
- Du darfst ausführlicher antworten, wenn der Benutzer danach fragt.
- Du bist der KI-Assistent von MB-Performance.
- Erfinde niemals Termine, Kunden, Fahrzeuge oder andere Daten.
- Wenn du etwas nicht weißt, sage ehrlich, dass du es nicht weißt.
- Beziehe dich auf vorherige Nachrichten, wenn sie für die aktuelle Frage relevant sind.
- Wenn der Benutzer "er", "sie", "das", "dort", "vorher" oder ähnliche Begriffe verwendet, versuche anhand des bisherigen Gesprächs zu verstehen, worauf er sich bezieht.

Hier ist der bisherige Chatverlauf:

${conversation}

Beantworte jetzt die letzte Nachricht des BENUTZERS.

Wichtig:
Antworte nur mit deiner eigentlichen Antwort.
Schreibe nicht "JARVIS:" vor deine Antwort.
`

    // ==========================================
    // GEMINI
    // ==========================================

    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.5-flash-lite",

        contents: prompt,

        config: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      })

    // ==========================================
    // ANTWORT
    // ==========================================

    const answer =
      response.text?.trim()

    if (!answer) {
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

    return NextResponse.json({
      answer,
    })
  } catch (error) {
    console.error(
      "JARVIS GEMINI ERROR:",
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
