import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY ist nicht in Vercel eingerichtet.",
        },
        { status: 500 }
      )
    }

    const body = await request.json()

    const message = body?.message

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: "Keine Nachricht erhalten.",
        },
        { status: 400 }
      )
    }

    const ai = new GoogleGenAI({
      apiKey,
    })

    const responseStream =
      await ai.models.generateContentStream({
        model: "gemini-3.5-flash-lite",

        contents: message,

        config: {
          systemInstruction: `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Antworte auf Deutsch.

Regeln:
- Antworte sehr schnell und direkt.
- Verwende normalerweise nur 1 bis 3 kurze Sätze.
- Bei einfachen Fragen reicht ein kurzer Satz.
- Sei freundlich, professionell und natürlich.
- Keine unnötigen langen Erklärungen.
- Keine erfundenen Informationen.
- Erfinde niemals Termine, Kundendaten oder Fahrzeugdaten.
- Wenn du etwas nicht weißt, sage ehrlich, dass du es nicht weißt.
- Du bist der digitale Assistent von MB-Performance.
- Wenn der Benutzer nach MB-Performance fragt, bleibe professionell.
- Schreibe keine Markdown-Überschriften, wenn die Antwort gesprochen werden soll.
- Verwende möglichst natürliche deutsche Sprache.
          `,
          temperature: 0.4,
          maxOutputTokens: 300,
        },
      })

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text

            if (text) {
              controller.enqueue(
                encoder.encode(text)
              )
            }
          }

          controller.close()
        } catch (error) {
          console.error(
            "GEMINI STREAM ERROR:",
            error
          )

          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    console.error(
      "JARVIS API ERROR:",
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "JARVIS konnte die Anfrage nicht verarbeiten.",
      },
      { status: 500 }
    )
  }
}
