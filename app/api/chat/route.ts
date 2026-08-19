import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export const runtime = "nodejs"

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

const SYSTEM_INSTRUCTION = `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Antworte auf Deutsch.

Dein Verhalten:
- Sei freundlich, natürlich und professionell.
- Antworte schnell und direkt.
- Bei einfachen Fragen reichen 1 bis 3 kurze Sätze.
- Sprich natürlich, da deine Antworten vorgelesen werden.
- Vermeide unnötige Listen und lange Erklärungen.
- Wenn der Benutzer ausdrücklich nach Details fragt, darfst du ausführlicher antworten.
- Beziehe vorherige Nachrichten ein, wenn sie für die aktuelle Frage relevant sind.
- Verstehe Bezüge wie "er", "sie", "das", "dort" oder "vorher" anhand des Gesprächs.
- Erfinde niemals Termine, Kunden, Fahrzeuge oder andere Daten.
- Wenn du etwas nicht weißt, sage ehrlich, dass du es nicht weißt.
- Schreibe niemals "JARVIS:" vor deine Antwort.
- Verwende keine Markdown-Formatierung, wenn sie nicht nötig ist.
- Deine Antwort wird von einer Sprach-KI vorgelesen, deshalb soll sie natürlich klingen.
`

export async function POST(
  request: Request
) {
  const startTime = Date.now()

  try {
    // =====================================================
    // API KEY PRÜFEN
    // =====================================================

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY ist nicht konfiguriert.",
        },
        {
          status: 500,
        }
      )
    }

    // =====================================================
    // REQUEST LESEN
    // =====================================================

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

    // =====================================================
    // NUR GÜLTIGE NACHRICHTEN
    // =====================================================

    const validMessages =
      messages.filter(
        (msg) =>
          msg &&
          (msg.role === "user" ||
            msg.role === "assistant") &&
          typeof msg.content ===
            "string" &&
          msg.content.trim().length > 0
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
        }
      )
    }

    // =====================================================
    // CHATVERLAUF BEGRENZEN
    //
    // Dadurch muss Gemini nicht jedes Mal
    // den kompletten alten Chat verarbeiten.
    // =====================================================

    const recentMessages =
      validMessages.slice(-12)

    // =====================================================
    // GEMINI CHAT-INHALT
    // =====================================================

    const contents =
      recentMessages.map(
        (msg) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text: msg.content,
            },
          ],
        })
      )

    // =====================================================
    // GEMINI
    // =====================================================

    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.5-flash-lite",

        contents,

        config: {
          systemInstruction:
            SYSTEM_INSTRUCTION,

          temperature: 0.3,

          maxOutputTokens: 250,

          topP: 0.8,
        },
      })

    // =====================================================
    // ANTWORT
    // =====================================================

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

    // =====================================================
    // BEREINIGEN
    // =====================================================

    const cleanAnswer =
      answer
        .replace(/^JARVIS:\s*/i, "")
        .trim()

    const elapsed =
      Date.now() - startTime

    console.log(
      `JARVIS Antwortzeit: ${elapsed} ms`
    )

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        answer:
          cleanAnswer ||
          "Ich konnte leider keine Antwort erzeugen.",

        responseTime: elapsed,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    )
  } catch (error) {
    const elapsed =
      Date.now() - startTime

    console.error(
      "JARVIS GEMINI ERROR:",
      error
    )

    console.error(
      `Fehler nach ${elapsed} ms`
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
