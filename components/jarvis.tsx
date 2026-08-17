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
  onresult:
    | ((event: SpeechRecognitionResultEvent) => void)
    | null
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror:
    | ((event: SpeechRecognitionErrorEvent) => void)
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

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)

  // =====================================================
  // TEXT FÜR SPRACHAUSGABE BEREINIGEN
  // =====================================================

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

  // =====================================================
  // JARVIS SPRICHT
  // =====================================================

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

    const utterance =
      new SpeechSynthesisUtterance(cleanText)

    utterance.lang = "de-DE"
    utterance.rate = 0.95
    utterance.pitch = 0.9
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

  // =====================================================
  // JARVIS FRAGE
  // =====================================================

  async function askJarvis(text?: string) {
    const cleanMessage = (text ?? message).trim()

    if (!cleanMessage || loading) {
      return
    }

    // Mikrofon stoppen
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        recognitionRef.current?.abort()
      }

      setListening(false)
    }

    // Aktuelle Sprachausgabe stoppen
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }

    setMessage("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanMessage,
        }),
      })

      let data: {
        answer?: string
        error?: string
      }

      try {
        data = await response.json()
      } catch {
        throw new Error(
          `Ungültige Antwort vom Server (${response.status})`
        )
      }

      console.log("JARVIS API:", data)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Serverfehler: ${response.status}`
        )
      }

      const jarvisAnswer =
        data?.answer ||
        "Ich konnte leider keine Antwort erzeugen."

      setAnswer(jarvisAnswer)

      speak(jarvisAnswer)
    } catch (error) {
      console.error("JARVIS ERROR:", error)

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler."

      setAnswer(
        `JARVIS konnte die Anfrage nicht verarbeiten.\n\nFehler: ${errorMessage}`
      )
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // MIKROFON
  // =====================================================

  async function startListening() {
    if (typeof window === "undefined") {
      return
    }

    // Wenn JARVIS bereits zuhört -> stoppen
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        recognitionRef.current?.abort()
      }

      setListening(false)
      return
    }

    // ===================================================
    // SPEECH RECOGNITION PRÜFEN
    // ===================================================

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setAnswer(
        "Dein Browser unterstützt leider keine Spracherkennung. Bitte verwende Google Chrome oder Microsoft Edge."
      )
      return
    }

    // ===================================================
    // HTTPS PRÜFEN
    // ===================================================

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"

    const isSecure =
      window.location.protocol === "https:"

    if (!isSecure && !isLocalhost) {
      setAnswer(
        "Das Mikrofon benötigt eine sichere HTTPS-Verbindung."
      )
      return
    }

    // ===================================================
    // SPRACHAUSGABE STOPPEN
    // ===================================================

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }

    // ===================================================
    // MIKROFON-BERECHTIGUNG
    // ===================================================

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAnswer(
          "Dein Browser stellt keinen Mikrofonzugriff bereit."
        )
        return
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

      // Nur die Berechtigung prüfen.
      // Danach wird der Stream geschlossen.
      stream.getTracks().forEach((track) => {
        track.stop()
      })
    } catch (error) {
      console.error(
        "MICROPHONE PERMISSION ERROR:",
        error
      )

      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
          case "PermissionDeniedError":
            setAnswer(
              "Der Mikrofonzugriff wurde blockiert. Erlaube den Mikrofonzugriff für diese Website in den Browser-Einstellungen und versuche es erneut."
            )
            break

          case "NotFoundError":
          case "DevicesNotFoundError":
            setAnswer(
              "Ich konnte kein Mikrofon finden. Überprüfe, ob dein Mikrofon angeschlossen und aktiviert ist."
            )
            break

          case "NotReadableError":
          case "TrackStartError":
            setAnswer(
              "Das Mikrofon wird gerade von einer anderen Anwendung verwendet. Schließe andere Programme, die dein Mikrofon verwenden."
            )
            break

          case "SecurityError":
            setAnswer(
              "Der Browser verhindert den Mikrofonzugriff aus Sicherheitsgründen. Verwende HTTPS."
            )
            break

          default:
            setAnswer(
              "Der Mikrofonzugriff konnte nicht gestartet werden. Bitte überprüfe die Browser-Berechtigungen."
            )
        }
      } else {
        setAnswer(
          "Der Mikrofonzugriff konnte nicht gestartet werden."
        )
      }

      return
    }

    // ===================================================
    // RECOGNITION ERSTELLEN
    // ===================================================

    const recognition = new SpeechRecognition()

    recognition.lang = "de-DE"
    recognition.continuous = false
    recognition.interimResults = false

    // ===================================================
    // START
    // ===================================================

    recognition.onstart = () => {
      console.log(
        "JARVIS MICROPHONE: START"
      )

      setListening(true)

      setAnswer(
        "🎤 Ich höre zu. Sprich jetzt..."
      )
    }

    // ===================================================
    // SPRACHE ERKANNT
    // ===================================================

    recognition.onresult = (
      event: SpeechRecognitionResultEvent
    ) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim()

      console.log(
        "JARVIS SPRACHE ERKANNT:",
        transcript
      )

      if (!transcript) {
        setAnswer(
          "Ich habe leider nichts verstanden. Bitte versuche es erneut."
        )
        return
      }

      setMessage(transcript)

      // Erkannte Sprache direkt an JARVIS senden
      askJarvis(transcript)
    }

    // ===================================================
    // ENDE
    // ===================================================

    recognition.onend = () => {
      console.log(
        "JARVIS MICROPHONE: END"
      )

      setListening(false)
    }

    // ===================================================
    // FEHLER
    // ===================================================

    recognition.onerror = (
      event: SpeechRecognitionErrorEvent
    ) => {
      console.error(
        "JARVIS SPEECH ERROR:",
        event.error
      )

      setListening(false)

      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          setAnswer(
            "Der Browser hat den Mikrofonzugriff für die Spracherkennung blockiert. Erlaube den Mikrofonzugriff für diese Website."
          )
          break

        case "no-speech":
          setAnswer(
            "Ich habe keine Sprache erkannt. Sprich bitte etwas lauter und versuche es erneut."
          )
          break

        case "audio-capture":
          setAnswer(
            "Ich konnte dein Mikrofon nicht erreichen. Überprüfe dein Mikrofon und die Windows-Mikrofoneinstellungen."
          )
          break

        case "network":
          setAnswer(
            "Die Spracherkennung konnte keine Verbindung herstellen. Überprüfe deine Internetverbindung."
          )
          break

        case "aborted":
          // Benutzer hat die Erkennung selbst beendet.
          break

        default:
          setAnswer(
            `Die Spracherkennung ist fehlgeschlagen: ${event.error}`
          )
      }
    }

    recognitionRef.current = recognition

    // ===================================================
    // RECOGNITION STARTEN
    // ===================================================

    try {
      recognition.start()

      console.log(
        "JARVIS MICROPHONE: STARTING"
      )
    } catch (error) {
      console.error(
        "JARVIS RECOGNITION START ERROR:",
        error
      )

      setListening(false)

      setAnswer(
        "Die Spracherkennung konnte nicht gestartet werden. Bitte versuche es erneut."
      )
    }
  }

  // =====================================================
  // AUFRÄUMEN
  // =====================================================

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        // Ignorieren
      }

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // =====================================================
  // JARVIS GESCHLOSSEN
  // =====================================================

  useEffect(() => {
    if (!open) {
      try {
        recognitionRef.current?.abort()
      } catch {
        // Ignorieren
      }

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel()
      }

      setListening(false)
      setSpeaking(false)
    }
  }, [open])

  // =====================================================
  // JARVIS BUTTON
  // =====================================================

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="JARVIS öffnen"
        className="fixed bottom-6 right-6 z-[9999] flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black text-white shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 hover:scale-110"
      >
        <span className="absolute inset-0 animate-ping rounded-full border border-white/20" />

        <Bot
          size={28}
          className="relative"
        />
      </button>
    )
  }

  // =====================================================
  // JARVIS FENSTER
  // =====================================================

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex h-[620px] w-[390px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#090909] text-white shadow-[0_20px_80px_rgba(0,0,0,0.6)]">

      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

        <div className="flex items-center gap-3">

          <div className="relative flex h-11 w-11 items-center justify-center">

            <div
              className={`absolute inset-0 rounded-full border border-white/30 ${
                loading ||
                speaking ||
                listening
                  ? "animate-ping"
                  : ""
              }`}
            />

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/5">
              <Bot size={20} />
            </div>

          </div>

          <div>

            <div className="font-semibold tracking-wider">
              JARVIS
            </div>

            <div className="flex items-center gap-2 text-xs text-white/50">

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
                  ? "HÖRT ZU..."
                  : speaking
                    ? "SPRICHT..."
                    : "ONLINE"}

            </div>

          </div>

        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="JARVIS schließen"
          className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>

      </div>

      {/* ANIMATION */}

      <div className="relative flex h-40 items-center justify-center overflow-hidden border-b border-white/10">

        <div
          className={`absolute h-32 w-32 rounded-full border border-white/10 ${
            loading ||
            listening ||
            speaking
              ? "animate-pulse"
              : ""
          }`}
        />

        <div
          className={`absolute h-24 w-24 rounded-full border border-white/20 ${
            listening
              ? "animate-ping"
              : ""
          }`}
        />

        <div
          className={`relative flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/5 ${
            loading ||
            speaking
              ? "animate-pulse"
              : ""
          }`}
        >
          <Bot size={30} />
        </div>

      </div>

      {/* CHAT */}

      <div className="flex-1 overflow-y-auto p-5">

        <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">
          {answer}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/40">

            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />

            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />

            JARVIS verarbeitet deine Anfrage...

          </div>
        )}

      </div>

      {/* INPUT */}

      <div className="border-t border-white/10 p-4">

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">

          <input
            type="text"
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
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
            onClick={startListening}
            disabled={loading}
            aria-label={
              listening
                ? "Mikrofon stoppen"
                : "Mikrofon starten"
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {listening ? (
              <MicOff size={18} />
            ) : (
              <Mic size={18} />
            )}
          </button>

          {/* SENDEN */}

          <button
            type="button"
            onClick={() => askJarvis()}
            disabled={
              loading ||
              !message.trim()
            }
            aria-label="Nachricht senden"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send size={18} />
          </button>

        </div>

        {/* STIMME */}

        <div className="mt-3 flex items-center justify-between">

          <span className="text-[11px] text-white/30">
            MB-PERFORMANCE AI
          </span>

          <button
            type="button"
            onClick={() => {
              if (
                voiceEnabled &&
                "speechSynthesis" in window
              ) {
                window.speechSynthesis.cancel()
                setSpeaking(false)
              }

              setVoiceEnabled(
                (value) => !value
              )
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