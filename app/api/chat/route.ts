import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: Request) {
  try {
    // Gemini API-Key prüfen
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.error("GEMINI_API_KEY fehlt")

      return NextResponse.json(
        {
          error: "GEMINI_API_KEY fehlt in Vercel.",
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

    // Gemini initialisieren
    const ai = new GoogleGenAI({
      apiKey,
    })

    // Gemini aufrufen
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: message,

      config: {
        systemInstruction: `
Du bist JARVIS, der persönliche KI-Assistent von MB-Performance.

Deine Aufgaben:

- Antworte immer auf Deutsch.
- Sei freundlich, professionell und verständlich.
- Halte normale Antworten relativ kurz.
- Hilf bei Fragen rund um MB-Performance.
- Unterstütze bei Fragen zu Fahrzeugen, Reparaturen, Inspektionen,
  MFK, Ölwechsel, Reifenservice und Terminvereinbarungen.
- Erfinde niemals Termine, Kunden oder andere Daten.
- Wenn du etwas nicht weißt, sage ehrlich, dass du es nicht weißt.
- Wenn du keine Daten aus der MB-Performance-Datenbank erhalten hast,
  behaupte niemals, dass du einen bestimmten Termin gesehen hast.
- Du bist der digitale Assistent von MB-Performance und heißt JARVIS.
        `,
      },
    })

    const answer = response.text

    if (!answer) {
      throw new Error(
        "Gemini hat keine Antwort zurückgegeben."
      )
    }

    console.log("JARVIS Antwort:", answer)

    return NextResponse.json({
      answer,
    })
  } catch (error) {
    console.error("========== JARVIS GEMINI ERROR ==========")
    console.error(error)
    console.error("==========================================")

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unbekannter Gemini-Fehler."

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
