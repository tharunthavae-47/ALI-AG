import { NextResponse } from "next/server"

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
          error: "Kein Text erhalten.",
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
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const ssml = `
<speak version="1.0"
  xmlns="http://www.w3.org/2001/10/synthesis"
  xmlns:mstts="http://www.w3.org/2001/mstts"
  xml:lang="de-DE">

  <voice name="de-DE-KatjaNeural">
    <prosody rate="+5%" pitch="+2Hz">
      ${escapeXml(cleanText)}
    </prosody>
  </voice>

</speak>
`

    const response = await fetch(
      "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat":
            "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent":
            "Mozilla/5.0",
        },
        body: ssml,
      }
    )

    if (!response.ok) {
      const errorText =
        await response.text()

      console.error(
        "EDGE TTS ERROR:",
        response.status,
        errorText
      )

      return NextResponse.json(
        {
          error:
            `Edge TTS Fehler ${response.status}`,
        },
        {
          status: 500,
        }
      )
    }

    const audio =
      await response.arrayBuffer()

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length":
          String(audio.byteLength),
        "Cache-Control":
          "no-store",
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
            : "TTS Fehler",
      },
      {
        status: 500,
      }
    )
  }
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
