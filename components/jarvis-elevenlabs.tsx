"use client"

import { useEffect } from "react"

export function JarvisElevenLabs() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return

    const synthesis = window.speechSynthesis
    const originalSpeak = synthesis.speak.bind(synthesis)
    const originalCancel = synthesis.cancel.bind(synthesis)

    let requestId = 0
    let audio: HTMLAudioElement | null = null
    let pendingUrl: string | null = null
    let pendingUtterance: SpeechSynthesisUtterance | null = null
    let currentUrl: string | null = null
    let currentUtterance: SpeechSynthesisUtterance | null = null
    let audioUnlocked = false

    const cleanupUrl = (url: string | null) => {
      if (url) URL.revokeObjectURL(url)
    }

    const finishCurrent = () => {
      const utterance = currentUtterance
      currentUtterance = null
      currentUrl = null

      if (utterance) {
        try {
          utterance.onend?.(new Event("end") as SpeechSynthesisEvent)
        } catch (error) {
          console.error("JARVIS TTS END ERROR:", error)
        }
      }
    }

    const stopAudio = () => {
      requestId += 1

      if (audio) {
        audio.pause()
        audio.currentTime = 0
        audio.removeAttribute("src")
        audio.load()
      }

      cleanupUrl(currentUrl)
      cleanupUrl(pendingUrl)
      currentUrl = null
      pendingUrl = null
      currentUtterance = null
      pendingUtterance = null
    }

    const playPending = () => {
      if (!audio || !pendingUrl || !pendingUtterance) return

      const url = pendingUrl
      const utterance = pendingUtterance

      pendingUrl = null
      pendingUtterance = null
      currentUrl = url
      currentUtterance = utterance

      audio.src = url
      audio.currentTime = 0

      void audio.play().then(() => {
        audioUnlocked = true
        try {
          utterance.onstart?.(new Event("start") as SpeechSynthesisEvent)
        } catch (error) {
          console.error("JARVIS TTS START ERROR:", error)
        }
      }).catch((error) => {
        console.error("JARVIS AUDIO PLAY ERROR:", error)

        pendingUrl = url
        pendingUtterance = utterance
        currentUrl = null
        currentUtterance = null
      })
    }

    const unlockAudio = () => {
      if (!audio) return

      // Create/play the element directly from the user's gesture. Once the
      // browser has accepted this media element, later ElevenLabs audio can
      // be played through the same element after the async fetch completes.
      if (!audioUnlocked) {
        const oldSrc = audio.src
        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
        audio.currentTime = 0

        void audio.play().then(() => {
          audioUnlocked = true
          if (oldSrc) audio.src = oldSrc
          playPending()
        }).catch(() => {
          if (oldSrc) audio.src = oldSrc
          playPending()
        })
      } else {
        playPending()
      }
    }

    audio = new Audio()
    audio.setAttribute("playsinline", "true")
    audio.preload = "auto"

    audio.onended = () => {
      const url = currentUrl
      finishCurrent()
      cleanupUrl(url)
      if (audio) {
        audio.removeAttribute("src")
        audio.load()
      }
    }

    audio.onerror = () => {
      const url = currentUrl
      const utterance = currentUtterance
      currentUrl = null
      currentUtterance = null
      cleanupUrl(url)

      if (utterance) {
        try {
          utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
        } catch (error) {
          console.error("JARVIS TTS ERROR CALLBACK:", error)
        }
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("touchstart", unlockAudio, { passive: true })
    window.addEventListener("click", unlockAudio, { passive: true })

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
            if (!response.ok) {
              const details = await response.text().catch(() => "")
              throw new Error(`TTS ${response.status}: ${details}`)
            }
            return response.blob()
          })
          .then((blob) => {
            if (thisRequest !== requestId) return

            const url = URL.createObjectURL(blob)
            pendingUrl = url
            pendingUtterance = utterance

            if (audioUnlocked) {
              playPending()
            }
          })
          .catch((error) => {
            if (thisRequest !== requestId) return
            console.error("JARVIS ELEVENLABS ERROR:", error)
            try {
              utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent)
            } catch {
              // Voice errors must never break the chat.
            }
          })
      } catch (error) {
        console.error("JARVIS VOICE ERROR:", error)
      }
    }

    return () => {
      stopAudio()
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("touchstart", unlockAudio)
      window.removeEventListener("click", unlockAudio)
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
