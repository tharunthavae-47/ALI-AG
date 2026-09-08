"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  Trash2,
  CalendarDays,
} from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
}

type BookingData = {
  booking_date: string | null
  booking_time: string | null
  name: string | null
  phone: string | null
  email: string | null
  car: string | null
  problem: string | null
}

type SpeechRecognitionResult = {
  [index: number]: {
    transcript: string
  }
  isFinal?: boolean
}

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: SpeechRecognitionResult
    length: number
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

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hallo. Ich bin JARVIS. Wie kann ich dir helfen?",
}

const EMPTY_BOOKING: BookingData = {
  booking_date: null,
  booking_time: null,
  name: null,
  phone: null,
  email: null,
  car: null,
  problem: null,
}

export function Jarvis() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [bookingData, setBookingData] = useState<BookingData>(EMPTY_BOOKING)
  const [bookingInProgress, setBookingInProgress] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-chat")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }

      const savedBooking = localStorage.getItem("jarvis-booking")
      if (savedBooking) {
        const parsedBooking = JSON.parse(savedBooking)
        setBookingData({ ...EMPTY_BOOKING, ...parsedBooking })
      }
    } catch (error) {
      console.error("JARVIS LOAD ERROR:", error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("jarvis-chat", JSON.stringify(messages))
    } catch (error) {
      console.error("JARVIS CHAT SAVE ERROR:", error)
    }
  }, [messages])

  useEffect(() => {
    try {
      localStorage.setItem("jarvis-booking", JSON.stringify(bookingData))
    } catch (error) {
      console.error("JARVIS BOOKING SAVE ERROR:", error)
    }
  }, [bookingData])

  function getFemaleVoice() {
    const germanVoices = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith("de"),
    )

    const preferred = germanVoices.find((voice) => {
      const name = voice.name.toLowerCase()
      return (
        name.includes("katja") ||
        name.includes("helena") ||
        name.includes("anna") ||
        name.includes("petra") ||
        name.includes("vicki") ||
        name.includes("female")
      )
    })

    return preferred || germanVoices[0] || voices[0]
  }

  function cleanTextForSpeech(text: string) {
    return text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function speak(text: string) {
    if (!voiceEnabled) return
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return
    }

    const cleanText = cleanTextForSpeech(text)
    if (!cleanText) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    const voice = getFemaleVoice()

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = "de-DE"
    }

    utterance.rate = 1.05
    utterance.pitch = 1.08
    utterance.volume = 1

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  async function askJarvis(text?: string) {
    const userMessage = (text ?? message).trim()

    if (!userMessage || loading) return

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
      recognitionRef.current = null
      setListening(false)
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }

    const userChatMessage: Message = {
      role: "user",
      content: userMessage,
    }

    const updatedMessages = [...messages, userChatMessage]
    setMessages(updatedMessages)
    setMessage("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          bookingData,
        }),
      })

      let data: {
        answer?: string
        error?: string
        bookingCreated?: boolean
        bookingInProgress?: boolean
        bookingData?: BookingData
        bookingId?: string
      }

      try {
        data = await response.json()
      } catch {
        throw new Error(`Ungültige Serverantwort (${response.status})`)
      }

      if (!response.ok) {
        throw new Error(data.error || `Serverfehler: ${response.status}`)
      }

      if (data.bookingData) {
        setBookingData({ ...EMPTY_BOOKING, ...data.bookingData })
      }

      if (data.bookingInProgress) {
        setBookingInProgress(true)
      }

      if (data.bookingCreated) {
        setBookingInProgress(false)
        setBookingData(EMPTY_BOOKING)
        localStorage.removeItem("jarvis-booking")
      }

      const jarvisAnswer =
        data.answer || "Ich konnte leider keine Antwort erzeugen."

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: jarvisAnswer },
      ])

      speak(jarvisAnswer)
    } catch (error) {
      console.error("JARVIS ERROR:", error)

      const errorMessage =
        error instanceof Error ? error.message : "Unbekannter Fehler."

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "JARVIS konnte die Anfrage nicht verarbeiten.\n\nFehler: " +
            errorMessage,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function clearConversation() {
    if (loading) return

    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel()
    }

    try {
      recognitionRef.current?.abort()
    } catch {}

    recognitionRef.current = null
    setListening(false)
    setSpeaking(false)
    setMessages([INITIAL_MESSAGE])
    setBookingData(EMPTY_BOOKING)
    setBookingInProgress(false)
    localStorage.removeItem("jarvis-chat")
    localStorage.removeItem("jarvis-booking")
  }

  async function startListening() {
    if (typeof window === "undefined") return

    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        try {
          recognitionRef.current?.abort()
        } catch {}
      }
      setListening(false)
      return
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Dein Browser unterstützt die Spracherkennung nicht. Bitte nutze auf dem Handy Google Chrome oder Safari mit aktiviertem Mikrofon.",
        },
      ])
      return
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"

    if (window.location.protocol !== "https:" && !isLocalhost) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Das Mikrofon benötigt eine sichere HTTPS-Verbindung.",
        },
      ])
      return
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Mikrofonzugriff nicht verfügbar.")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error("MICROPHONE ERROR:", error)
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Der Mikrofonzugriff wurde blockiert. Bitte erlaube dieser Website das Mikrofon in den Handy- oder Browser-Einstellungen.",
        },
      ])
      return
    }

    const recognition = new SpeechRecognition()
    let latestTranscript = ""
    let submitted = false

    // Schweizer Deutsch bevorzugen; die meisten Browser verwenden intern
    // trotzdem dieselbe deutsche Spracherkennung.
    recognition.lang = "de-CH"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "🎤 Ich höre zu. Sprich jetzt...",
        },
      ])
    }

    recognition.onresult = (event) => {
      let transcript = ""

      // Mobile Browser können mehrere Result-Blöcke liefern.
      // Deshalb werden alle vorhandenen Ergebnisse zusammengeführt.
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript || ""
      }

      transcript = transcript.trim()
      if (!transcript) return

      latestTranscript = transcript
      setMessage(transcript)
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null

      const transcript = latestTranscript.trim()

      if (!transcript || submitted) {
        if (!transcript && !submitted) {
          setMessages((previous) => [
            ...previous,
            {
              role: "assistant",
              content:
                "Ich habe leider nichts verstanden. Bitte sprich direkt nach dem Mikrofonstart und versuche es erneut.",
            },
          ])
        }
        return
      }

      submitted = true
      setMessage(transcript)

      // Wichtig auf Mobilgeräten: erst nach dem Ende der Erkennung senden.
      void askJarvis(transcript)
    }

    recognition.onerror = (event) => {
      console.error("SPEECH ERROR:", event.error)
      setListening(false)
      recognitionRef.current = null

      if (event.error === "aborted") return

      let errorMessage = "Die Spracherkennung ist fehlgeschlagen."

      if (event.error === "no-speech") {
        errorMessage =
          "Ich habe keine Sprache erkannt. Bitte sprich direkt nach dem Mikrofonstart."
      } else if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        errorMessage =
          "Der Mikrofonzugriff wurde blockiert. Bitte erlaube der Website das Mikrofon."
      } else if (event.error === "audio-capture") {
        errorMessage =
          "Das Mikrofon konnte nicht geöffnet werden. Prüfe bitte die Mikrofonberechtigung auf deinem Handy."
      } else if (event.error === "network") {
        errorMessage =
          "Die mobile Spracherkennung hat ein Netzwerkproblem. Bitte prüfe deine Internetverbindung und versuche es erneut."
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: errorMessage,
        },
      ])
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (error) {
      console.error("RECOGNITION START ERROR:", error)
      recognitionRef.current = null
      setListening(false)
    }
  }

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {}

      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.abort()
      } catch {}

      recognitionRef.current = null

      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel()
      }

      setListening(false)
      setSpeaking(false)
    }
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="JARVIS öffnen"
        className="fixed bottom-6 right-6 z-[9999] flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-cyan-400/30 bg-black shadow-[0_0_40px_rgba(34,211,238,0.35)] transition-all duration-300 hover:scale-110"
      >
        <span className="absolute inset-0 animate-ping rounded-full border border-cyan-400/20" />
        <Image
          src="/tharun.jpg"
          alt="NURAHT47"
          width={42}
          height={42}
          className="relative z-10 object-contain"
        />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex h-[650px] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#07090b] text-white shadow-[0_20px_80px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
            <div
              className={`absolute inset-0 rounded-full border border-cyan-400/30 ${
                loading || speaking || listening ? "animate-ping" : ""
              }`}
            />
            <Image
              src="/tharun.jpg"
              alt="NURAHT47"
              width={36}
              height={36}
              className="relative z-10 rounded-full object-contain"
            />
          </div>

          <div>
            <div className="font-semibold tracking-wider">JARVIS</div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading
                    ? "animate-pulse bg-yellow-400"
                    : listening
                      ? "animate-pulse bg-red-400"
                      : speaking
                        ? "animate-pulse bg-blue-400"
                        : bookingInProgress
                          ? "animate-pulse bg-cyan-400"
                          : "bg-green-400"
                }`}
              />
              {loading
                ? "DENKT..."
                : listening
                  ? "HÖRT ZU..."
                  : speaking
                    ? "SPRICHT..."
                    : bookingInProgress
                      ? "TERMIN..."
                      : "ONLINE"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearConversation}
            disabled={loading}
            title="Neue Unterhaltung"
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Trash2 size={17} />
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex h-32 shrink-0 items-center justify-center overflow-hidden border-b border-white/10">
        <div
          className={`absolute h-28 w-28 rounded-full border border-cyan-400/10 ${
            loading || listening || speaking || bookingInProgress
              ? "animate-pulse"
              : ""
          }`}
        />
        <div
          className={`absolute h-20 w-20 rounded-full border border-cyan-400/20 ${
            listening || bookingInProgress ? "animate-ping" : ""
          }`}
        />
        <div
          className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.25)] ${
            speaking ? "animate-pulse" : ""
          }`}
        >
          <Image
            src="/tharun.jpg"
            alt="NURAHT47"
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
      </div>

      {bookingInProgress && (
        <div className="flex items-center gap-2 border-b border-cyan-400/10 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-300">
          <CalendarDays size={14} />
          <span>Termin wird vorbereitet</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.map((chatMessage, index) => (
            <div
              key={`${index}-${chatMessage.role}`}
              className={`flex ${
                chatMessage.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  chatMessage.role === "user"
                    ? "bg-cyan-300 text-black"
                    : "border border-white/10 bg-white/5 text-white/80"
                }`}
              >
                {chatMessage.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:300ms]" />
              JARVIS denkt...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                askJarvis()
              }
            }}
            placeholder="JARVIS fragen..."
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />

          <button
            type="button"
            onClick={startListening}
            disabled={loading}
            aria-label={listening ? "Spracherkennung stoppen" : "JARVIS zuhören lassen"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            type="button"
            onClick={() => askJarvis()}
            disabled={loading || !message.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-white/30">MB-PERFORMANCE AI</span>

          <button
            type="button"
            onClick={() => {
              if (voiceEnabled) {
                window.speechSynthesis.cancel()
                setSpeaking(false)
              }
              setVoiceEnabled((value) => !value)
            }}
            className="flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
          >
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {voiceEnabled ? "Stimme an" : "Stimme aus"}
          </button>
        </div>
      </div>
    </div>
  )
}
