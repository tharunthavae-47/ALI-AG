"use client"

import { useEffect } from "react"

export function JarvisElevenLabs() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return

    const synthesis = window.speechSynthesis
    const originalSpeak = synthesis.speak.bind(synthesis)
    const originalCancel = synthesis.cancel.bind(synthesis)
    let currentAudio: HTMLAudioElement | null = null
    let requestId = 0

    const stopAudio = () => {
      requestId += 1
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        currentAudio = null
      }
    }

    synthesis.cancel = () => {
      stopAudio()
      try {
        originalCancel()
      } catch (error) {
        console.error("JARVIS SPEECH CANCEL ERROR:", error)
      }
    }

    synthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      try {
        const text = utterance.text?.trim()
        if (!text) return

        stopAudio()
        const thisRequest = requestId

        // Wichtig: Die TTS-Anfrage läuft komplett unabhängig vom Chat.
        // Ein ElevenLabs-/Audio-Fehler darf niemals die JARVIS-Antwort verhindern.
        void fetch("/api/jarvis/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`TTS ${response.status}`)
            return response.blob()
          })
          .then((blob) => {
            if (thisRequest !== requestId) return

            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            currentAudio = audio

            utterance.onstart?.(new Event("start") as SpeechSynthesisEvent)

            audio.onended = () => {
              if (currentAudio === audio) currentAudio = null
              URL.revokeObjectURL(url)
              utterance.onend?.(new Event("end") as SpeechSynthesisEvent)
            }

            audio.onerror = () => {
              if (currentAudio === audio) currentAudio = null
              URL.revokeObjectURL(url)
              utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
            }

            void audio.play().catch((error) => {
              console.error("JARVIS AUDIO PLAY ERROR:", error)
              audio.onerror?.(new Event("error"))
            })
          })
          .catch((error) => {
            if (thisRequest !== requestId) return
            console.error("JARVIS ELEVENLABS ERROR:", error)
            // Keine Exception nach außen: JARVIS muss textlich weiter funktionieren.
            utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
          })
      } catch (error) {
        // Sprachfehler niemals an askJarvis weitergeben.
        console.error("JARVIS VOICE ERROR:", error)
      }
    }

    return () => {
      stopAudio()
      synthesis.speak = originalSpeak
      synthesis.cancel = originalCancel
      try {
        originalCancel()
      } catch {
        // Ignore cleanup errors.
      }
    }
  }, [])

  return null
}
