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
      originalCancel()
    }

    synthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      const text = utterance.text?.trim()
      if (!text) return

      stopAudio()
      const thisRequest = requestId

      fetch("/api/jarvis/tts", {
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
          utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
        })
    }

    return () => {
      stopAudio()
      synthesis.speak = originalSpeak
      synthesis.cancel = originalCancel
      originalCancel()
    }
  }, [])

  return null
}
