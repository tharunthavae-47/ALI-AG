import { NextResponse } from "next/server"

const VOICE_ID = "Gvx1qZk9R4BUiBfsNPBU"

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY fehlt auf dem Server." },
        { status: 500 },
      )
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/voices/${VOICE_ID}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    )

    if (!response.ok) {
      const details = await response.text()
      console.error("ELEVENLABS VOICE INFO ERROR:", response.status, details)
      return NextResponse.json(
        {
          error: "ElevenLabs konnte die Voice-Informationen nicht auslesen.",
          status: response.status,
        },
        { status: response.status },
      )
    }

    const voice = await response.json()

    return NextResponse.json({
      voice_id: voice.voice_id,
      name: voice.name ?? null,
      category: voice.category ?? null,
      labels: voice.labels ?? {},
      description: voice.description ?? null,
      preview_url: voice.preview_url ?? null,
      available_for_tiers: voice.available_for_tiers ?? [],
      settings: voice.settings ?? null,
      verified_languages: voice.verified_languages ?? [],
      high_quality_base_model_ids: voice.high_quality_base_model_ids ?? [],
      is_owner: voice.is_owner ?? null,
      is_mixed: voice.is_mixed ?? null,
      is_legacy: voice.is_legacy ?? null,
    })
  } catch (error) {
    console.error("JARVIS VOICE INFO ERROR:", error)
    return NextResponse.json(
      { error: "Fehler beim Abrufen der ElevenLabs-Voice-Informationen." },
      { status: 500 },
    )
  }
}
