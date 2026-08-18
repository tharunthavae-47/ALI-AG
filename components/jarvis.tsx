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

type SpeechRecognitionEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
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
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Stimmen laden
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    loadVoices()

    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.cancel()
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // Beste weibliche deutsche Stimme auswählen
  function getFemaleGermanVoice() {
    if (!voices.length) return null

    const germanVoices = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith("de")
    )

    const femaleNames = [
      "female",
      "anna",
      "petra",
      "helena",
      "katja",
      "vicki",
      "google deutsch",
      "google german",
      "microsoft katja",
      "microsoft helena",
      "microsoft sabina",
    ]

    const femaleVoice = germanVoices.find((voice) => {
      const name = voice.name.toLowerCase()

      return femaleNames.some((femaleName) =>
        name.includes(femaleName)
      )
    })

    return femaleVoice || germanVoices[0] || voices[0]
  }

  // Antwort vorlesen
  function speak(text: string) {
    if (!voiceEnabled) return
    if (typeof window === "undefined") return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)

    const voice = getFemaleGermanVoice()

    if (voice) {
      utterance.voice = voice
    }

    utterance.lang = "de-DE"
    utterance.rate = 0.95
    utterance.pitch = 1.08
    utterance.volume = 1

    utterance.onstart = () => {
      setSpeaking(true)
    }

    utterance.onend = () => {
      setSpeaking(false)
    }

    utterance.onerror = () => {
      setSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  // Spracheingabe starten
  function startListening() {
    if (typeof window === "undefined") return

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setAnswer(
        "Die Spracheingabe wird von diesem Browser nicht unterstützt."
      )
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

    recognition.onresult = (event) => {
      const transcript =
        event.results[0]?.[0]?.transcript || ""

      setMessage(transcript)

      // Direkt absenden
      setTimeout(() => {
        sendMessage(transcript)
      }, 200)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.onerror = () => {
      setListening(false)
      setAnswer("Ich konnte deine Stimme leider nicht verstehen.")
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  // Nachricht an Gemini senden
  async function sendMessage(text?: string) {
    const userMessage = (text ?? message).trim()

    if (!userMessage || loading) return

    setLoading(true)

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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "JARVIS konnte nicht antworten."
        )
      }

      const newAnswer =
        data?.answer ||
        "Ich habe leider keine Antwort erhalten."

      setAnswer(newAnswer)
      setMessage("")

      // Antwort sprechen
      speak(newAnswer)
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "JARVIS konnte nicht erreicht werden."

      setAnswer(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function stopSpeaking() {
    if (typeof window === "undefined") return

    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  function toggleVoice() {
    if (voiceEnabled) {
      stopSpeaking()
      setVoiceEnabled(false)
    } else {
      setVoiceEnabled(true)
    }
  }

  function handleClose() {
    setOpen(false)
    recognitionRef.current?.stop()
    stopSpeaking()
  }

  return (
    <>
      {/* JARVIS Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="JARVIS öffnen"
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/40 bg-black text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.35)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_45px_rgba(34,211,238,0.6)]"
        >
          <Bot size={30} />
        </button>
      )}

      {/* JARVIS Fenster */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-cyan-400/30 bg-black/95 text-white shadow-[0_0_60px_rgba(34,211,238,0.25)] backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cyan-400/20 px-5 py-4">
            <div className="flex items-center gap-3">
              
              {/* JARVIS Animation */}
              <div className="relative flex h-11 w-11 items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full border border-cyan-400/30 ${
                    speaking || listening
                      ? "animate-ping"
                      : ""
                  }`}
                />

                <div
                  className={`absolute inset-1 rounded-full border ${
                    speaking || listening
                      ? "border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.8)]"
                      : "border-cyan-400/50"
                  }`}
                />

                <Bot
                  size={22}
                  className={`relative z-10 text-cyan-300 ${
                    speaking
                      ? "animate-pulse"
                      : ""
                  }`}
                />
              </div>

              <div>
                <div className="font-bold tracking-wider">
                  JARVIS
                </div>

                <div className="flex items-center gap-1 text-xs text-green-400">
                  <span className="animate-pulse">
                    ●
                  </span>

                  {listening
                    ? " HÖRT ZU"
                    : speaking
                    ? " SPRICHT"
                    : " ONLINE"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleVoice}
                aria-label={
                  voiceEnabled
                    ? "Stimme ausschalten"
                    : "Stimme einschalten"
                }
                className="rounded-lg p-2 text-cyan-300 transition hover:bg-cyan-400/10"
              >
                {voiceEnabled ? (
                  <Volume2 size={19} />
                ) : (
                  <VolumeX size={19} />
                )}
              </button>

              <button
                onClick={handleClose}
                aria-label="JARVIS schließen"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Animation */}
          <div className="flex h-28 items-center justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              
              <div
                className={`absolute inset-0 rounded-full border border-cyan-400/20 ${
                  speaking || listening
                    ? "animate-ping"
                    : ""
                }`}
              />

              <div
                className={`absolute h-14 w-14 rounded-full border border-cyan-300/40 ${
                  speaking || listening
                    ? "animate-pulse shadow-[0_0_35px_rgba(34,211,238,0.6)]"
                    : ""
                }`}
              />

              <div className="h-5 w-5 rounded-full bg-cyan-300 shadow-[0_0_25px_rgba(34,211,238,1)]" />
            </div>
          </div>

          {/* Chat */}
          <div className="h-[300px] overflow-y-auto px-4 pb-4">
            
            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-3 text-sm text-gray-200">
              Hallo. Ich bin JARVIS.
              <br />
              Wie kann ich dir helfen?
            </div>

            {answer && (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm leading-relaxed text-cyan-50">
                <div className="mb-1 text-xs font-semibold text-cyan-300">
                  JARVIS
                </div>

                {answer}
              </div>
            )}

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-cyan-300">
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="ml-1">
                  JARVIS denkt...
                </span>
              </div>
            )}
          </div>

          {/* Eingabe */}
          <div className="border-t border-cyan-400/20 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-white/5 p-2">
              
              {/* Mikrofon */}
              <button
                onClick={startListening}
                disabled={loading}
                aria-label={
                  listening
                    ? "Mikrofon stoppen"
                    : "Mikrofon starten"
                }
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                  listening
                    ? "bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "text-cyan-300 hover:bg-cyan-400/10"
                }`}
              >
                {listening ? (
                  <MicOff size={19} />
                ) : (
                  <Mic size={19} />
                )}
              </button>

              <input
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage()
                  }
                }}
                placeholder="JARVIS fragen..."
                disabled={loading}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-gray-500"
              />

              {/* Senden */}
              <button
                onClick={() => sendMessage()}
                disabled={
                  loading || !message.trim()
                }
                aria-label="Nachricht senden"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send size={18} />
              </button>
            </div>

            <div className="mt-2 text-center text-[10px] tracking-wider text-gray-600">
              JARVIS • MB PERFORMANCE AI
            </div>
          </div>
        </div>
      )}
    </>
  )
}
