import { NextResponse } from "next/server"

const VOICE_ID = "Gvx1qZk9R4BUiBfsNPBU"
const MODEL_ID = "eleven_multilingual_v2"

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY fehlt auf dem Server." },
        { status: 500 },
      )
    }

    const body = await request.json()
    const text = typeof body?.text === "string" ? body.text.trim() : ""

    if (!text) {
      return NextResponse.json(
        { error: "Kein Text für die Sprachausgabe." },
        { status: 400 },
      )
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!response.ok) {
      const details = await response.text()
      console.error("ELEVENLABS TTS ERROR:", response.status, details)
      return NextResponse.json(
        { error: "ElevenLabs konnte die Stimme nicht erzeugen." },
        { status: response.status },
      )
    }

    const audio = await response.arrayBuffer()

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("JARVIS TTS ERROR:", error)
    return NextResponse.json(
      { error: "Fehler bei der Sprachausgabe." },
      { status: 500 },
    )
  }
}
