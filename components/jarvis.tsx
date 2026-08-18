
"use client"

import { useEffect, useRef, useState } from "react"
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionErrorEvent = Event & {
  error: string
}

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function Jarvis() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [answer, setAnswer] = useState(
    "Hallo. Ich bin JARVIS. Wie kann ich dir helfen?"
  )

  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)

  // ===============================
  // Stimmen laden
  // ===============================
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices())
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // ===============================
  // Beste weibliche Stimme wählen
  // ===============================
  function getFemaleVoice() {
    const germanVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith("de")
    )

    const female = germanVoices.find((v) => {
      const name = v.name.toLowerCase()

      return (
        name.includes("katja") ||
        name.includes("helena") ||
        name.includes("anna") ||
        name.includes("petra") ||
        name.includes("sabina") ||
        name.includes("vicki") ||
        name.includes("female")
      )
    })

    return female || germanVoices[0] || voices[0]
  }

  // ===============================
  // Text bereinigen
  // ===============================
  function clean(text: string) {
    return text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/`/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  // ===============================
  // JARVIS spricht
  // ===============================
  function speak(text: string) {
    if (!voiceEnabled) return
    if (!("speechSynthesis" in window)) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(clean(text))

    const voice = getFemaleVoice()

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = "de-DE"
    }

    utterance.rate = 1.12
    utterance.pitch = 1.05
    utterance.volume = 1

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  // ===============================
  // Nachricht senden (Streaming)
  // ===============================
  async function askJarvis(text?: string) {
    const userMessage = (text ?? message).trim()

    if (!userMessage || loading) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    }

    window.speechSynthesis.cancel()

    setSpeaking(false)
    setLoading(true)
    setMessage("")
    setAnswer("")

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const reader = response.body?.getReader()

      if (!reader) throw new Error("Kein Datenstream erhalten.")

      const decoder = new TextDecoder()

      let fullAnswer = ""

      while (true) {
        const { value, done } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value)

        fullAnswer += chunk

        setAnswer(fullAnswer)
      }

      speak(fullAnswer)
    } catch (error) {
      setAnswer(
        `JARVIS konnte die Anfrage nicht verarbeiten.\n\n${error}`
      )
    } finally {
      setLoading(false)
    }
  }

  // ===============================
  // Mikrofon
  // ===============================
  async function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setAnswer("Bitte verwende Chrome oder Edge.")
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = "de-DE"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setListening(true)
      setAnswer("🎤 Ich höre zu...")
    }

    recognition.onresult = (event) => {
      const transcript =
        event.results[0]?.[0]?.transcript || ""

      setMessage(transcript)

      askJarvis(transcript)
    }

    recognition.onend = () => setListening(false)

    recognition.onerror = () => {
      setListening(false)
      setAnswer("Ich konnte dich leider nicht verstehen.")
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis.cancel()
    }
  }, [])

  // ===============================
  // Geschlossen
  // ===============================
  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort()
      window.speechSynthesis.cancel()

      setListening(false)
      setSpeaking(false)
    }
  }, [open])

  // ===============================
  // Button
  // ===============================
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-black text-cyan-300 shadow-[0_0_35px_rgba(34,211,238,0.35)] transition hover:scale-110"
      >
        <Bot size={28} />
      </button>
    )
  }

  // ===============================
  // Fenster
  // ===============================
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex h-[620px] w-[390px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#090909] text-white shadow-[0_20px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-400/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full border border-cyan-400/30 ${
                speaking || listening || loading
                  ? "animate-ping"
                  : ""
              }`}
            />

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
              <Bot size={20} />
            </div>
          </div>

          <div>
            <div className="font-semibold tracking-wider">
              JARVIS
            </div>

            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading
                    ? "animate-pulse bg-yellow-400"
                    : listening
                    ? "animate-pulse bg-red-400"
                    : speaking
                    ? "animate-pulse bg-blue-400"
                    : "bg-green-400"
                }`}
              />

              {loading
                ? "DENKT..."
                : listening
                ? "HÖRT ZU"
                : speaking
                ? "SPRICHT"
                : "ONLINE"}
            </div>
          </div>
        </div>

        <button
          onClick={() => setOpen(false)}
          className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Animation */}
      <div className="relative flex h-36 items-center justify-center border-b border-cyan-400/10">
        <div
          className={`absolute h-28 w-28 rounded-full border border-cyan-400/20 ${
            speaking || listening || loading
              ? "animate-pulse"
              : ""
          }`}
        />

        <div
          className={`absolute h-20 w-20 rounded-full border border-cyan-300/30 ${
            listening ? "animate-ping" : ""
          }`}
        />

        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.35)]">
          <Bot size={28} />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="whitespace-pre-wrap rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4 text-sm leading-6 text-cyan-50">
          {answer}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-cyan-300">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:300ms]" />
            JARVIS verarbeitet deine Anfrage...
          </div>
        )}
      </div>

      {/* Eingabe */}
      <div className="border-t border-cyan-400/10 p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/10 bg-white/5 p-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askJarvis()
            }}
            placeholder="JARVIS fragen..."
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />

          <button
            onClick={startListening}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {listening ? (
              <MicOff size={18} />
            ) : (
              <Mic size={18} />
            )}
          </button>

          <button
            onClick={() => askJarvis()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-black transition hover:bg-cyan-200"
          >
            <Send size={18} />
          </button>
        </div>

        {/* Stimme */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-white/30">
            MB-PERFORMANCE AI
          </span>

          <button
            onClick={() => {
              if (voiceEnabled) {
                window.speechSynthesis.cancel()
                setSpeaking(false)
              }

              setVoiceEnabled(!voiceEnabled)
            }}
            className="flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
          >
            {voiceEnabled ? (
              <Volume2 size={15} />
            ) : (
              <VolumeX size={15} />
            )}

            {voiceEnabled
              ? "Stimme an"
              : "Stimme aus"}
          </button>
        </div>
      </div>
    </div>
  )
}
