import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(request: Request) {
  try {
    // API-Key prüfen
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("OPENAI_API_KEY fehlt")

      return NextResponse.json(
        {
          error: "OPENAI_API_KEY fehlt in Vercel.",
        },
        {
          status: 500,
        }
      )
    }

    // Anfrage lesen
    const body = await request.json()

    const message = body?.message

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: "Keine Nachricht erhalten.",
        },
        {
          status: 400,
        }
      )
    }

    console.log("JARVIS Anfrage:", message)

    // OpenAI erstellen
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    // OpenAI Anfrage
    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content: `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Deine Aufgaben:
- Antworte auf Deutsch.
- Sei freundlich und professionell.
- Halte Antworten verständlich und relativ kurz.
- Hilf bei Fragen rund um MB-Performance.
- Erfinde niemals Termine, Kunden oder andere Daten.
- Wenn du etwas nicht weißt, sage es ehrlich.
            `,
          },
          {
            role: "user",
            content: message,
          },
        ],
      })

    // Antwort holen
    const answer =
      completion.choices[0]?.message?.content

    if (!answer) {
      throw new Error(
        "OpenAI hat keine Antwort zurückgegeben."
      )
    }

    console.log("JARVIS Antwort:", answer)

    return NextResponse.json({
      answer,
    })
  } catch (error) {
    console.error("========== JARVIS ERROR ==========")
    console.error(error)
    console.error("===================================")

    let errorMessage =
      "Unbekannter Fehler bei JARVIS."

    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      {
        status: 500,
      }
    )
  }
}
