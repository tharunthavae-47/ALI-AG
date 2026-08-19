import { NextResponse } from "next/server"
import { EdgeTTS } from "node-edge-tts"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = body?.text

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return NextResponse.json(
        {
          error: "Kein Text zum Vorlesen erhalten.",
        },
        {
          status: 400,
        }
      )
    }

    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/`/g, "")
      .replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      )
      .replace(
        /https?:\/\/\S+/g,
        ""
      )
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    if (!cleanText) {
      return NextResponse.json(
        {
          error: "Nach der Bereinigung ist kein Text übrig.",
        },
        {
          status: 400,
        }
      )
    }

    const tts = new EdgeTTS({
      voice: "de-DE-KatjaNeural",
      lang: "de-DE",
      outputFormat:
        "audio-24khz-48kbitrate-mono-mp3",
      rate: "+5%",
      pitch: "+0Hz",
      volume: "+0%",
    })

    const audio = await tts.synthesize(
      cleanText
    )

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error(
      "JARVIS TTS ERROR:",
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "TTS konnte nicht erzeugt werden.",
      },
      {
        status: 500,
      }
    )
  }
}
