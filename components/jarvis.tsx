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

/* =====================================================
   TYPES
===================================================== */

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

type SpeechRecognitionResultEvent =
  Event & {
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string
        }
      }
    }
  }

type SpeechRecognitionErrorEvent =
  Event & {
    error: string
  }

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean

  start: () => void
  stop: () => void
  abort: () => void

  onresult:
    | ((
        event: SpeechRecognitionResultEvent,
      ) => void)
    | null

  onstart:
    | (() => void)
    | null

  onend:
    | (() => void)
    | null

  onerror:
    | ((
        event: SpeechRecognitionErrorEvent,
      ) => void)
    | null
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

/* =====================================================
   INITIAL MESSAGE
===================================================== */

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hallo. Ich bin JARVIS. Wie kann ich dir helfen?",
}

/* =====================================================
   EMPTY BOOKING
===================================================== */

const EMPTY_BOOKING: BookingData = {
  booking_date: null,
  booking_time: null,
  name: null,
  phone: null,
  email: null,
  car: null,
  problem: null,
}

/* =====================================================
   COMPONENT
===================================================== */

export function Jarvis() {
  const [open, setOpen] =
    useState(false)

  const [messages, setMessages] =
    useState<Message[]>([
      INITIAL_MESSAGE,
    ])

  const [message, setMessage] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [listening, setListening] =
    useState(false)

  const [speaking, setSpeaking] =
    useState(false)

  const [voiceEnabled, setVoiceEnabled] =
    useState(true)

  const [voices, setVoices] =
    useState<SpeechSynthesisVoice[]>([])

  /* =================================================
     TERMIN DATEN
  ================================================= */

  const [bookingData, setBookingData] =
    useState<BookingData>(
      EMPTY_BOOKING,
    )

  const [bookingInProgress, setBookingInProgress] =
    useState(false)

  /* =================================================
     REFS
  ================================================= */

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(
      null,
    )

  const chatEndRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  /* =================================================
     STIMMEN LADEN
  ================================================= */

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return
    }

    const loadVoices = () => {
      const available =
        window.speechSynthesis.getVoices()

      setVoices(available)
    }

    loadVoices()

    window.speechSynthesis.onvoiceschanged =
      loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged =
        null
    }
  }, [])

  /* =================================================
     CHAT SCROLL
  ================================================= */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      },
    )
  }, [
    messages,
    loading,
  ])

  /* =================================================
     CHAT LADEN
  ================================================= */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "jarvis-chat",
        )

      if (saved) {
        const parsed =
          JSON.parse(saved)

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          setMessages(parsed)
        }
      }

      const savedBooking =
        localStorage.getItem(
          "jarvis-booking",
        )

      if (savedBooking) {
        const parsedBooking =
          JSON.parse(
            savedBooking,
          )

        setBookingData({
          ...EMPTY_BOOKING,
          ...parsedBooking,
        })
      }
    } catch (error) {
      console.error(
        "JARVIS LOAD ERROR:",
        error,
      )
    }
  }, [])

  /* =================================================
     CHAT SPEICHERN
  ================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        "jarvis-chat",
        JSON.stringify(messages),
      )
    } catch (error) {
      console.error(
        "JARVIS CHAT SAVE ERROR:",
        error,
      )
    }
  }, [messages])

  /* =================================================
     BOOKING SPEICHERN
  ================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        "jarvis-booking",
        JSON.stringify(
          bookingData,
        ),
      )
    } catch (error) {
      console.error(
        "JARVIS BOOKING SAVE ERROR:",
        error,
      )
    }
  }, [bookingData])

  /* =================================================
     WEIBLICHE DEUTSCHE STIMME
  ================================================= */

  function getFemaleVoice() {
    const germanVoices =
      voices.filter((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith("de"),
      )

    const preferred =
      germanVoices.find(
        (voice) => {
          const name =
            voice.name.toLowerCase()

          return (
            name.includes(
              "katja",
            ) ||
            name.includes(
              "helena",
            ) ||
            name.includes(
              "anna",
            ) ||
            name.includes(
              "petra",
            ) ||
            name.includes(
              "vicki",
            ) ||
            name.includes(
              "female",
            )
          )
        },
      )

    return (
      preferred ||
      germanVoices[0] ||
      voices[0]
    )
  }

  /* =================================================
     TEXT CLEANEN
  ================================================= */

  function cleanTextForSpeech(
    text: string,
  ) {
    return text
      .replace(
        /\*\*/g,
        "",
      )
      .replace(
        /\*/g,
        "",
      )
      .replace(
        /#{1,6}\s/g,
        "",
      )
      .replace(
        /`/g,
        "",
      )
      .replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1",
      )
      .replace(
        /https?:\/\/\S+/g,
        "",
      )
      .replace(
        /\n+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
  }

  /* =================================================
     JARVIS SPRICHT
  ================================================= */

  function speak(
    text: string,
  ) {
    if (!voiceEnabled) {
      return
    }

    if (
      typeof window ===
        "undefined" ||
      !(
        "speechSynthesis" in
        window
      )
    ) {
      return
    }

    const cleanText =
      cleanTextForSpeech(
        text,
      )

    if (!cleanText) {
      return
    }

    window.speechSynthesis.cancel()

    const utterance =
      new SpeechSynthesisUtterance(
        cleanText,
      )

    const voice =
      getFemaleVoice()

    if (voice) {
      utterance.voice =
        voice

      utterance.lang =
        voice.lang
    } else {
      utterance.lang =
        "de-DE"
    }

    utterance.rate =
      1.05

    utterance.pitch =
      1.08

    utterance.volume =
      1

    utterance.onstart =
      () => {
        setSpeaking(true)
      }

    utterance.onend =
      () => {
        setSpeaking(false)
      }

    utterance.onerror =
      () => {
        setSpeaking(false)
      }

    window.speechSynthesis.speak(
      utterance,
    )
  }

  /* =================================================
     JARVIS FRAGEN
  ================================================= */

  async function askJarvis(
    text?: string,
  ) {
    const userMessage =
      (
        text ??
        message
      ).trim()

    if (
      !userMessage ||
      loading
    ) {
      return
    }

    /* -----------------------------------------------
       MIKROFON STOPPEN
    ------------------------------------------------ */

    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        recognitionRef.current?.abort()
      }

      setListening(false)
    }

    /* -----------------------------------------------
       SPRACHE STOPPEN
    ------------------------------------------------ */

    if (
      typeof window !==
        "undefined" &&
      "speechSynthesis" in
        window
    ) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }

    /* -----------------------------------------------
       USER MESSAGE
    ------------------------------------------------ */

    const userChatMessage:
      Message = {
        role: "user",
        content:
          userMessage,
      }

    const updatedMessages =
      [
        ...messages,
        userChatMessage,
      ]

    setMessages(
      updatedMessages,
    )

    setMessage("")
    setLoading(true)

    try {
      /* ---------------------------------------------
         API
      ---------------------------------------------- */

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              messages:
                updatedMessages,

              /*
               * SEHR WICHTIG:
               * Der aktuelle Termin-Zwischenstand
               * wird an die API geschickt.
               */
              bookingData:
                bookingData,
            }),
          },
        )

      let data: {
        answer?: string
        error?: string

        bookingCreated?: boolean

        bookingInProgress?: boolean

        bookingData?: BookingData

        bookingId?: string
      }

      try {
        data =
          await response.json()
      } catch {
        throw new Error(
          `Ungültige Serverantwort (${response.status})`,
        )
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Serverfehler: ${response.status}`,
        )
      }

      /* ---------------------------------------------
         BOOKING DATA AKTUALISIEREN
      ---------------------------------------------- */

      if (
        data.bookingData
      ) {
        setBookingData({
          ...EMPTY_BOOKING,
          ...data.bookingData,
        })
      }

      /* ---------------------------------------------
         BOOKING STATUS
      ---------------------------------------------- */

      if (
        data.bookingInProgress
      ) {
        setBookingInProgress(
          true,
        )
      }

      /* ---------------------------------------------
         TERMIN ERFOLGREICH
      ---------------------------------------------- */

      if (
        data.bookingCreated
      ) {
        setBookingInProgress(
          false,
        )

        setBookingData(
          EMPTY_BOOKING,
        )

        localStorage.removeItem(
          "jarvis-booking",
        )
      }

      /* ---------------------------------------------
         JARVIS ANTWORT
      ---------------------------------------------- */

      const jarvisAnswer =
        data.answer ||
        "Ich konnte leider keine Antwort erzeugen."

      setMessages([
        ...updatedMessages,

        {
          role: "assistant",
          content:
            jarvisAnswer,
        },
      ])

      speak(
        jarvisAnswer,
      )
    } catch (error) {
      console.error(
        "JARVIS ERROR:",
        error,
      )

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler."

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

  /* =================================================
     KONVERSATION LÖSCHEN
  ================================================= */

  function clearConversation() {
    if (loading) {
      return
    }

    if (
      typeof window !==
      "undefined"
    ) {
      window.speechSynthesis.cancel()
    }

    setSpeaking(false)

    setMessages([
      INITIAL_MESSAGE,
    ])

    setBookingData(
      EMPTY_BOOKING,
    )

    setBookingInProgress(
      false,
    )

    localStorage.removeItem(
      "jarvis-chat",
    )

    localStorage.removeItem(
      "jarvis-booking",
    )
  }

  /* =================================================
     MIKROFON
  ================================================= */

  async function startListening() {
    if (
      typeof window ===
      "undefined"
    ) {
      return
    }

    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        recognitionRef.current?.abort()
      }

      setListening(false)

      return
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      const errorMessage:
        Message = {
        role: "assistant",
        content:
          "Dein Browser unterstützt leider keine Spracherkennung. Bitte verwende Google Chrome oder Microsoft Edge.",
      }

      setMessages(
        (previous) => [
          ...previous,
          errorMessage,
        ],
      )

      return
    }

    const isLocalhost =
      window.location.hostname ===
        "localhost" ||
      window.location.hostname ===
        "127.0.0.1"

    const isSecure =
      window.location.protocol ===
      "https:"

    if (
      !isSecure &&
      !isLocalhost
    ) {
      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Das Mikrofon benötigt eine sichere HTTPS-Verbindung.",
          },
        ],
      )

      return
    }

    window.speechSynthesis.cancel()

    setSpeaking(false)

    /* -----------------------------------------------
       MIKROFON BERECHTIGUNG
    ------------------------------------------------ */

    try {
      if (
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        throw new Error(
          "Mikrofonzugriff nicht verfügbar.",
        )
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true,
            },
          },
        )

      stream
        .getTracks()
        .forEach(
          (track) =>
            track.stop(),
        )
    } catch (error) {
      console.error(
        "MICROPHONE ERROR:",
        error,
      )

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Der Mikrofonzugriff wurde nicht erlaubt. Bitte erlaube der Website den Zugriff auf dein Mikrofon.",
          },
        ],
      )

      return
    }

    /* -----------------------------------------------
       SPEECH RECOGNITION
    ------------------------------------------------ */

    const recognition =
      new SpeechRecognition()

    recognition.lang =
      "de-DE"

    recognition.continuous =
      false

    recognition.interimResults =
      false

    recognition.onstart =
      () => {
        setListening(true)

        setMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              content:
                "🎤 Ich höre zu. Sprich jetzt...",
            },
          ],
        )
      }

    recognition.onresult =
      (
        event,
      ) => {
        const transcript =
          event.results?.[0]?.[0]
            ?.transcript
            ?.trim()

        if (!transcript) {
          setListening(false)

          setMessages(
            (previous) => [
              ...previous,
              {
                role: "assistant",
                content:
                  "Ich habe leider nichts verstanden.",
              },
            ],
          )

          return
        }

        setMessage(
          transcript,
        )

        askJarvis(
          transcript,
        )
      }

    recognition.onend =
      () => {
        setListening(false)
      }

    recognition.onerror =
      (event) => {
        console.error(
          "SPEECH ERROR:",
          event.error,
        )

        setListening(false)

        if (
          event.error ===
          "aborted"
        ) {
          return
        }

        let errorMessage =
          "Die Spracherkennung ist fehlgeschlagen."

        if (
          event.error ===
          "no-speech"
        ) {
          errorMessage =
            "Ich habe keine Sprache erkannt. Bitte versuche es erneut."
        }

        if (
          event.error ===
            "not-allowed" ||
          event.error ===
            "service-not-allowed"
        ) {
          errorMessage =
            "Der Mikrofonzugriff wurde blockiert."
        }

        setMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              content:
                errorMessage,
            },
          ],
        )
      }

    recognitionRef.current =
      recognition

    try {
      recognition.start()
    } catch (error) {
      console.error(
        "RECOGNITION START ERROR:",
        error,
      )

      setListening(false)
    }
  }

  /* =================================================
     CLEANUP
  ================================================= */

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {}

      if (
        typeof window !==
        "undefined"
      ) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  /* =================================================
     CLOSE
  ================================================= */

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.abort()
      } catch {}

      if (
        typeof window !==
        "undefined"
      ) {
        window.speechSynthesis.cancel()
      }

      setListening(false)
      setSpeaking(false)
    }
  }, [open])

  /* =================================================
     JARVIS BUTTON
  ================================================= */

  if (!open) {
    return (
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
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

  /* =================================================
     JARVIS WINDOW
  ================================================= */

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex h-[650px] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#07090b] text-white shadow-[0_20px_80px_rgba(0,0,0,0.7)]">

      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

        <div className="flex items-center gap-3">

          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">

            <div
              className={`absolute inset-0 rounded-full border border-cyan-400/30 ${
                loading ||
                speaking ||
                listening
                  ? "animate-ping"
                  : ""
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

            <div className="font-semibold tracking-wider">
              JARVIS
            </div>

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
            onClick={
              clearConversation
            }
            disabled={loading}
            title="Neue Unterhaltung"
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Trash2 size={17} />
          </button>

          <button
            type="button"
            onClick={() =>
              setOpen(false)
            }
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>

        </div>

      </div>

      {/* ANIMATION */}

      <div className="relative flex h-32 shrink-0 items-center justify-center overflow-hidden border-b border-white/10">

        <div
          className={`absolute h-28 w-28 rounded-full border border-cyan-400/10 ${
            loading ||
            listening ||
            speaking ||
            bookingInProgress
              ? "animate-pulse"
              : ""
          }`}
        />

        <div
          className={`absolute h-20 w-20 rounded-full border border-cyan-400/20 ${
            listening ||
            bookingInProgress
              ? "animate-ping"
              : ""
          }`}
        />

        <div
          className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.25)] ${
            speaking
              ? "animate-pulse"
              : ""
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

      {/* BOOKING INDICATOR */}

      {bookingInProgress && (
        <div className="flex items-center gap-2 border-b border-cyan-400/10 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-300">

          <CalendarDays
            size={14}
          />

          <span>
            Termin wird vorbereitet
          </span>

        </div>
      )}

      {/* CHAT */}

      <div className="flex-1 overflow-y-auto p-4">

        <div className="space-y-3">

          {messages.map(
            (
              chatMessage,
              index,
            ) => (
              <div
                key={`${index}-${chatMessage.role}`}
                className={`flex ${
                  chatMessage.role ===
                  "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    chatMessage.role ===
                    "user"
                      ? "bg-cyan-300 text-black"
                      : "border border-white/10 bg-white/5 text-white/80"
                  }`}
                >
                  {
                    chatMessage.content
                  }
                </div>

              </div>
            ),
          )}

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

      {/* INPUT */}

      <div className="border-t border-white/10 p-4">

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">

          <input
            type="text"
            value={message}
            onChange={(
              event,
            ) =>
              setMessage(
                event.target.value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                  "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault()

                askJarvis()
              }
            }}
            placeholder="JARVIS fragen..."
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />

          {/* MIKROFON */}

          <button
            type="button"
            onClick={
              startListening
            }
            disabled={loading}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {listening ? (
              <MicOff
                size={18}
              />
            ) : (
              <Mic size={18} />
            )}
          </button>

          {/* SENDEN */}

          <button
            type="button"
            onClick={() =>
              askJarvis()
            }
            disabled={
              loading ||
              !message.trim()
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send size={18} />
          </button>

        </div>

        {/* FOOTER */}

        <div className="mt-3 flex items-center justify-between">

          <span className="text-[11px] text-white/30">
            MB-PERFORMANCE AI
          </span>

          <button
            type="button"
            onClick={() => {
              if (
                voiceEnabled
              ) {
                window.speechSynthesis.cancel()

                setSpeaking(
                  false,
                )
              }

              setVoiceEnabled(
                (value) =>
                  !value,
              )
            }}
            className="flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
          >

            {voiceEnabled ? (
              <Volume2
                size={15}
              />
            ) : (
              <VolumeX
                size={15}
              />
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
