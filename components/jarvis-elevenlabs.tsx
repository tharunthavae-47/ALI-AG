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
    let unlockedAudio: HTMLAudioElement | null = null

    const unlockAudio = () => {
      try {
        if (!unlockedAudio) {
          unlockedAudio = new Audio()
          unlockedAudio.setAttribute("playsinline", "true")
          unlockedAudio.preload = "auto"
          unlockedAudio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
        }

        const promise = unlockedAudio.play()
        if (promise) {
          void promise.catch(() => undefined)
        }
      } catch {
        // Mobile browsers may still block audio until a direct user gesture.
      }
    }

    // iPhone/iPad and some Android browsers block audio that starts after
    // an async fetch. Unlock the media element on the user's first tap.
    window.addEventListener("touchstart", unlockAudio, { passive: true })
    window.addEventListener("pointerdown", unlockAudio, { passive: true })

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
            audio.setAttribute("playsinline", "true")
            audio.preload = "auto"
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

            // Reuse the already-unlocked mobile audio element when possible.
            const playAudio = unlockedAudio && unlockedAudio !== audio
              ? (() => {
                  unlockedAudio.src = url
                  unlockedAudio.currentTime = 0
                  currentAudio = unlockedAudio
                  return unlockedAudio.play()
                })()
              : audio.play()

            void playAudio.catch((error) => {
              console.error("JARVIS AUDIO PLAY ERROR:", error)
              audio.onerror?.(new Event("error"))
            })
          })
          .catch((error) => {
            if (thisRequest !== requestId) return
            console.error("JARVIS ELEVENLABS ERROR:", error)
            utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
          })
      } catch (error) {
        console.error("JARVIS VOICE ERROR:", error)
      }
    }

    return () => {
      stopAudio()
      window.removeEventListener("touchstart", unlockAudio)
      window.removeEventListener("pointerdown", unlockAudio)
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
