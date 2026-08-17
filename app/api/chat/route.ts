import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
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

    // OpenAI aufrufen
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Deine Aufgaben:
- Beantworte Fragen auf Deutsch.
- Sei freundlich, professionell und kurz.
- Hilf bei Fragen rund um MB-Performance.
- Wenn du etwas nicht weißt, sage ehrlich, dass du es nicht weißt.
- Erfinde keine Termine oder Kundendaten.
- Du kannst später mit der Supabase-Datenbank von MB-Performance verbunden werden.
          `,
        },

        {
          role: "user",
          content: message,
        },
      ],
    })

    const answer =
      completion.choices[0]?.message?.content

    if (!answer) {
      return NextResponse.json(
        {
          error: "JARVIS konnte keine Antwort erzeugen.",
        },
        {
          status: 500,
        }
      )
    }

    // Antwort an die Webseite
    return NextResponse.json({
      answer,
    })
  } catch (error) {
    console.error("JARVIS API ERROR:", error)

    return NextResponse.json(
      {
        error: "JARVIS konnte die Anfrage nicht verarbeiten.",
      },
      {
        status: 500,
      }
    )
  }
}
