"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Mic, MicOff, Send, Volume2, VolumeX, X, Trash2, CalendarDays } from "lucide-react"

type Message = { role: "user" | "assistant"; content: string }
type BookingData = {
  booking_date: string | null
  booking_time: string | null
  name: string | null
  phone: string | null
  email: string | null
  car: string | null
  problem: string | null
}
type SpeechRecognitionResult = { [index: number]: { transcript: string }; isFinal?: boolean }
type SpeechRecognitionResultEvent = Event & { results: { [index: number]: SpeechRecognitionResult; length: number } }
type SpeechRecognitionErrorEvent = Event & { error: string }
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; stop: () => void; abort: () => void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onstart: (() => void) | null; onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const INITIAL_MESSAGE: Message = { role: "assistant", content: "Hallo. Ich bin JARVIS. Wie kann ich dir helfen?" }
const EMPTY_BOOKING: BookingData = { booking_date: null, booking_time: null, name: null, phone: null, email: null, car: null, problem: null }
const JARVIS_POSITION_KEY = "jarvis-launcher-position"

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
  const [launcherPosition, setLauncherPosition] = useState<{ left: number; top: number } | null>(null)
  const [launcherDragging, setLauncherDragging] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const speechPrimedRef = useRef(false)
  const speechRunRef = useRef(0)
  const launcherDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null)
  const suppressLauncherClickRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-chat")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed)
      }
      const savedBooking = localStorage.getItem("jarvis-booking")
      if (savedBooking) setBookingData({ ...EMPTY_BOOKING, ...JSON.parse(savedBooking) })
      const savedPosition = localStorage.getItem(JARVIS_POSITION_KEY)
      if (savedPosition) {
        const parsedPosition = JSON.parse(savedPosition)
        if (typeof parsedPosition?.left === "number" && typeof parsedPosition?.top === "number") {
          setLauncherPosition({ left: parsedPosition.left, top: parsedPosition.top })
        }
      }
    } catch (error) { console.error("JARVIS LOAD ERROR:", error) }
  }, [])

  useEffect(() => { try { localStorage.setItem("jarvis-chat", JSON.stringify(messages)) } catch {} }, [messages])
  useEffect(() => { try { localStorage.setItem("jarvis-booking", JSON.stringify(bookingData)) } catch {} }, [bookingData])

  function getFemaleVoice() {
    const germanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("de"))
    const preferred = germanVoices.find((voice) => {
      const name = voice.name.toLowerCase()
      return name.includes("katja") || name.includes("helena") || name.includes("anna") || name.includes("petra") || name.includes("vicki") || name.includes("female") || name.includes("frau")
    })
    return preferred || germanVoices[0] || voices[0]
  }

  function cleanTextForSpeech(text: string) {
    return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,6}\s/g, "").replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
  }

  function primeSpeechSynthesis() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    try {
      const synthesis = window.speechSynthesis
      synthesis.getVoices()
      const prime = new SpeechSynthesisUtterance(" ")
      prime.volume = 0
      prime.rate = 10
      prime.lang = "de-DE"
      prime.onend = () => { speechPrimedRef.current = true }
      prime.onerror = () => { speechPrimedRef.current = true }
      synthesis.speak(prime)
      speechPrimedRef.current = true
    } catch (error) { console.error("SPEECH PRIME ERROR:", error) }
  }

  function speak(text: string) {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return
    const cleanText = cleanTextForSpeech(text)
    if (!cleanText) return

    const synthesis = window.speechSynthesis
    const run = ++speechRunRef.current
    const selectedVoice = getFemaleVoice()
    const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText]

    const speakChunk = (index: number) => {
      if (run !== speechRunRef.current || !voiceEnabled) return
      const chunk = chunks[index]?.trim()
      if (!chunk) {
        setSpeaking(false)
        return
      }

      try {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = selectedVoice?.lang || "de-DE"
        if (selectedVoice) utterance.voice = selectedVoice
        utterance.rate = 1.03
        utterance.pitch = 1.08
        utterance.volume = 1
        utterance.onstart = () => setSpeaking(true)
        utterance.onend = () => {
          if (index + 1 < chunks.length) window.setTimeout(() => speakChunk(index + 1), 20)
          else setSpeaking(false)
        }
        utterance.onerror = (event) => {
          console.error("SPEECH SYNTHESIS ERROR:", event)
          setSpeaking(false)
          if (index === 0) {
            window.setTimeout(() => {
              if (run !== speechRunRef.current || !voiceEnabled) return
              try { synthesis.resume(); synthesis.speak(utterance) } catch {}
            }, 400)
          }
        }
        if (synthesis.paused) synthesis.resume()
        synthesis.speak(utterance)
      } catch (error) {
        console.error("SPEAK ERROR:", error)
        setSpeaking(false)
      }
    }

    // Nicht mehr cancel() verwenden: auf mobilen Browsern kann cancel() die
    // zuvor durch den Mikrofon-Klick freigeschaltete Audio-Session zerstören.
    if (synthesis.paused) synthesis.resume()
    window.setTimeout(() => speakChunk(0), speechPrimedRef.current ? 120 : 250)
  }

  function clampLauncherPosition(left: number, top: number) {
    if (typeof window === "undefined") return { left, top }
    const size = 64
    const margin = 8
    return {
      left: Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - size - margin)),
      top: Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - size - margin)),
    }
  }

  function handleLauncherPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (typeof window === "undefined" || window.innerWidth > 767) return
    const rect = event.currentTarget.getBoundingClientRect()
    launcherDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    }
    suppressLauncherClickRef.current = false
    setLauncherDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleLauncherPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = launcherDragRef.current
    if (!drag || drag.pointerId !== event.pointerId || typeof window === "undefined" || window.innerWidth > 767) return

    const nextPosition = clampLauncherPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY)
    const movedEnough = Math.abs(event.clientX - (nextPosition.left + drag.offsetX)) >= 0 || Math.abs(event.clientY - (nextPosition.top + drag.offsetY)) >= 0
    if (Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1) drag.moved = true
    if (movedEnough) setLauncherPosition(nextPosition)
    if (drag.moved) suppressLauncherClickRef.current = true
  }

  function finishLauncherDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = launcherDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved) suppressLauncherClickRef.current = true
    launcherDragRef.current = null
    setLauncherDragging(false)
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
  }

  function handleLauncherClick() {
    if (suppressLauncherClickRef.current) {
      suppressLauncherClickRef.current = false
      return
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!launcherPosition) return
    try { localStorage.setItem(JARVIS_POSITION_KEY, JSON.stringify(launcherPosition)) } catch {}
  }, [launcherPosition])

  useEffect(() => {
    const keepLauncherInBounds = () => {
      if (typeof window === "undefined" || window.innerWidth > 767 || !launcherPosition) return
      setLauncherPosition(clampLauncherPosition(launcherPosition.left, launcherPosition.top))
    }
    window.addEventListener("resize", keepLauncherInBounds)
    return () => window.removeEventListener("resize", keepLauncherInBounds)
  }, [launcherPosition])

  async function askJarvis(text?: string) {
    const userMessage = (text ?? message).trim()
    if (!userMessage || loading) return

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { try { recognitionRef.current.abort() } catch {} }
      recognitionRef.current = null
      setListening(false)
    }

    const userChatMessage: Message = { role: "user", content: userMessage }
    const updatedMessages = [...messages, userChatMessage]
    setMessages(updatedMessages)
    setMessage("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, bookingData }),
      })
      let data: { answer?: string; error?: string; bookingCreated?: boolean; bookingInProgress?: boolean; bookingData?: BookingData; bookingId?: string }
      try { data = await response.json() } catch { throw new Error(`Ungültige Serverantwort (${response.status})`) }
      if (!response.ok) throw new Error(data.error || `Serverfehler: ${response.status}`)

      if (data.bookingData) setBookingData({ ...EMPTY_BOOKING, ...data.bookingData })
      if (data.bookingInProgress) setBookingInProgress(true)
      if (data.bookingCreated) {
        setBookingInProgress(false)
        setBookingData(EMPTY_BOOKING)
        localStorage.removeItem("jarvis-booking")
      }

      const jarvisAnswer = data.answer || "Ich konnte leider keine Antwort erzeugen."
      setMessages([...updatedMessages, { role: "assistant", content: jarvisAnswer }])
      if (voiceEnabled) window.setTimeout(() => speak(jarvisAnswer), 180)
    } catch (error) {
      console.error("JARVIS ERROR:", error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler."
      const answer = "JARVIS konnte die Anfrage nicht verarbeiten.\n\nFehler: " + errorMessage
      setMessages([...updatedMessages, { role: "assistant", content: answer }])
      if (voiceEnabled) window.setTimeout(() => speak(answer), 180)
    } finally { setLoading(false) }
  }

  function clearConversation() {
    if (loading) return
    if (typeof window !== "undefined") {
      speechRunRef.current++
      window.speechSynthesis.cancel()
    }
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null
    speechPrimedRef.current = false
    setListening(false); setSpeaking(false); setMessages([INITIAL_MESSAGE]); setBookingData(EMPTY_BOOKING); setBookingInProgress(false)
    localStorage.removeItem("jarvis-chat"); localStorage.removeItem("jarvis-booking")
  }

  async function startListening() {
    if (typeof window === "undefined") return
    if (listening) {
      try { recognitionRef.current?.stop() } catch { try { recognitionRef.current?.abort() } catch {} }
      setListening(false)
      return
    }

    if (voiceEnabled) primeSpeechSynthesis()
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMessages((previous) => [...previous, { role: "assistant", content: "Dein Browser unterstützt die Spracherkennung nicht. Bitte nutze auf dem Handy Google Chrome oder Safari mit aktiviertem Mikrofon." }])
      return
    }

    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (window.location.protocol !== "https:" && !isLocalhost) {
      setMessages((previous) => [...previous, { role: "assistant", content: "Das Mikrofon benötigt eine sichere HTTPS-Verbindung." }])
      return
    }

    // Wichtig: hier KEIN speechSynthesis.cancel(). Die Audio-Session wurde
    // gerade durch den Benutzer aktiviert und muss für die spätere Antwort
    // erhalten bleiben.
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofonzugriff nicht verfügbar.")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      console.error("MICROPHONE ERROR:", error)
      setMessages((previous) => [...previous, { role: "assistant", content: "Der Mikrofonzugriff wurde blockiert. Bitte erlaube dieser Website das Mikrofon in den Handy- oder Browser-Einstellungen." }])
      return
    }

    const recognition = new SpeechRecognition()
    let latestTranscript = ""
    let submitted = false
    recognition.lang = "de-CH"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      setMessages((previous) => [...previous, { role: "assistant", content: "🎤 Ich höre zu. Sprich jetzt..." }])
    }

    recognition.onresult = (event) => {
      let transcript = ""
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i]?.[0]?.transcript || ""
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
        if (!transcript && !submitted) setMessages((previous) => [...previous, { role: "assistant", content: "Ich habe leider nichts verstanden. Bitte sprich direkt nach dem Mikrofonstart und versuche es erneut." }])
        return
      }
      submitted = true
      setMessage(transcript)
      void askJarvis(transcript)
    }

    recognition.onerror = (event) => {
      console.error("SPEECH ERROR:", event.error)
      setListening(false); recognitionRef.current = null
      if (event.error === "aborted") return
      let errorMessage = "Die Spracherkennung ist fehlgeschlagen."
      if (event.error === "no-speech") errorMessage = "Ich habe keine Sprache erkannt. Bitte sprich direkt nach dem Mikrofonstart."
      else if (event.error === "not-allowed" || event.error === "service-not-allowed") errorMessage = "Der Mikrofonzugriff wurde blockiert. Bitte erlaube der Website das Mikrofon."
      else if (event.error === "audio-capture") errorMessage = "Das Mikrofon konnte nicht geöffnet werden. Prüfe bitte die Mikrofonberechtigung auf deinem Handy."
      else if (event.error === "network") errorMessage = "Die mobile Spracherkennung hat ein Netzwerkproblem. Bitte prüfe deine Internetverbindung und versuche es erneut."
      setMessages((previous) => [...previous, { role: "assistant", content: errorMessage }])
    }

    recognitionRef.current = recognition
    try { recognition.start() } catch (error) { console.error("RECOGNITION START ERROR:", error); recognitionRef.current = null; setListening(false) }
  }

  useEffect(() => () => {
    try { recognitionRef.current?.abort() } catch {}
    if (typeof window !== "undefined") { speechRunRef.current++; window.speechSynthesis.cancel() }
  }, [])

  useEffect(() => {
    if (!open) {
      try { recognitionRef.current?.abort() } catch {}
      recognitionRef.current = null
      if (typeof window !== "undefined") { speechRunRef.current++; window.speechSynthesis.cancel() }
      setListening(false); setSpeaking(false)
    }
  }, [open])

  if (!open) return (
    <button
      type="button"
      onClick={handleLauncherClick}
      onPointerDown={handleLauncherPointerDown}
      onPointerMove={handleLauncherPointerMove}
      onPointerUp={finishLauncherDrag}
      onPointerCancel={finishLauncherDrag}
      aria-label="JARVIS öffnen"
      style={launcherPosition && typeof window !== "undefined" && window.innerWidth <= 767 ? { left: launcherPosition.left, top: launcherPosition.top } : undefined}
      className={`fixed z-50 h-16 w-16 overflow-hidden rounded-full border border-white/20 bg-black shadow-2xl ${launcherDragging ? "scale-105 cursor-grabbing" : "cursor-grab"} ${launcherPosition ? "max-[767px]:!bottom-auto max-[767px]:!right-auto" : "bottom-5 right-5"}`}
    >
      <Image src="/tharun.jpg" alt="JARVIS" fill className="pointer-events-none object-cover" draggable={false} />
    </button>
  )

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[min(720px,calc(100vh-32px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20"><Image src="/tharun.jpg" alt="JARVIS" fill className="object-cover" /></div>
          <div><div className="font-semibold text-white">JARVIS</div><div className="text-xs text-white/50">{speaking ? "Spricht…" : loading ? "Denkt…" : listening ? "Hört zu…" : "Online"}</div></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setVoiceEnabled((enabled) => !enabled); if (voiceEnabled && typeof window !== "undefined") { speechRunRef.current++; window.speechSynthesis.cancel(); setSpeaking(false) } }} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={voiceEnabled ? "Sprachausgabe ausschalten" : "Sprachausgabe einschalten"}>{voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button type="button" onClick={clearConversation} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Chat löschen"><Trash2 size={18} /></button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="JARVIS schließen"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((item, index) => <div key={`${index}-${item.role}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${item.role === "user" ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white"}`}>{item.content}</div></div>)}
        {loading && <div className="text-sm text-white/50">JARVIS denkt…</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => void startListening()} disabled={loading} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${listening ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"} disabled:cursor-not-allowed disabled:opacity-50`} aria-label={listening ? "Aufnahme stoppen" : "Mit JARVIS sprechen"}>{listening ? <MicOff size={20} /> : <Mic size={20} />}</button>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askJarvis() } }} placeholder="Schreib oder sprich mit JARVIS…" rows={1} className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25" />
          <button type="button" onClick={() => void askJarvis()} disabled={loading || !message.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Nachricht senden"><Send size={19} /></button>
        </div>
        {bookingInProgress && <div className="mt-2 flex items-center gap-2 text-xs text-white/50"><CalendarDays size={14} />Termin wird vorbereitet…</div>}
      </div>
    </div>
  )
}
