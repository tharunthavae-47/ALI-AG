"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Listing = {
  id: string; owner_id: string; occasion_request_id: string; published: boolean; published_at: string | null
  marke: string; modell: string; jahrgang: number; kilometer: number; treibstoff: string; getriebe: string
  leistung: string; antrieb: string; tueren: string; fahrzeugfarbe: string; zustand: string; unfallschaden: string
  letzter_service: string | null; mfk: string | null; beschreibung: string; preisvorstellung: number
}
type ImageRow = { id: string; occasion_request_id: string; image_url: string; image_name: string | null; image_position: number }

type ChatMessage = { id: string; chat_id: string; sender_id: string; message: string; created_at: string }

export default function KaufenPage() {
  const supabase = createClient()
  const [listings, setListings] = useState<Listing[]>([])
  const [images, setImages] = useState<ImageRow[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  async function load() {
    setError("")
    const { data, error: listingError } = await supabase.from("occasion_public_listings").select("*").order("published_at", { ascending: false })
    if (listingError) { setError(listingError.message); return }
    const rows = (data || []) as Listing[]
    setListings(rows)
    if (rows.length) {
      const { data: imageData, error: imageError } = await supabase.from("occasion_images").select("*").in("occasion_request_id", rows.map((x) => x.occasion_request_id)).order("image_position", { ascending: true })
      if (imageError) setError(imageError.message)
      setImages((imageData || []) as ImageRow[])
    } else setImages([])
  }

  useEffect(() => { load() }, [])

  const selectedImages = useMemo(() => selected ? images.filter((x) => x.occasion_request_id === selected.occasion_request_id).sort((a, b) => a.image_position - b.image_position) : [], [selected, images])
  function imageUrl(path: string) { return supabase.storage.from("occasion-images").getPublicUrl(path).data.publicUrl }

  async function startChat(listing: Listing) {
    setError("")
    setChatLoading(true)
    try {
      const response = await fetch("/api/occasion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ listingId: listing.id, name: contactName, phone: contactPhone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Der Live-Chat konnte nicht geöffnet werden.")
      setChatId(data.chatId)
      setUserId(data.userId)
      setMessages(data.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Live-Chat konnte nicht geöffnet werden.")
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    if (!chatId) return
    let active = true
    const poll = async () => {
      try {
        const response = await fetch(`/api/occasion/chat?chatId=${encodeURIComponent(chatId)}`, { credentials: "include", cache: "no-store" })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Chat konnte nicht geladen werden.")
        if (active) { setMessages(data.messages || []); setUserId(data.userId || null) }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Chat konnte nicht geladen werden.")
      }
    }
    poll()
    const timer = window.setInterval(poll, 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [chatId])

  async function sendMessage() {
    const text = draft.trim()
    if (!text || !chatId) return
    setError("")
    try {
      const response = await fetch("/api/occasion/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ chatId, message: text }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Nachricht konnte nicht gesendet werden.")
      setUserId(data.userId || userId)
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden.")
    }
  }

  function closeVehicle() { setSelected(null); setChatId(null); setMessages([]); setError("") }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Link href="/" className="font-bold tracking-[0.2em]">MB PERFORMANCE</Link><div className="flex items-center gap-3"><Link href="/occasion" className="text-sm text-zinc-400 hover:text-white">← Occasion</Link></div></div></header>
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">Occasion</p>
        <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><h1 className="text-4xl font-bold tracking-tight md:text-6xl">Fahrzeuge kaufen</h1><p className="mt-4 max-w-2xl text-zinc-400">Geprüfte Fahrzeuge, die von MB Performance manuell für den Verkauf veröffentlicht wurden.</p></div></div>
        {error && <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>}
        {listings.length === 0 ? <div className="mt-12 rounded-3xl border border-white/10 bg-zinc-950 p-12 text-center text-zinc-500">Aktuell sind keine Fahrzeuge online.</div> : <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => { const first = images.find((i) => i.occasion_request_id === listing.occasion_request_id); return <button key={listing.id} onClick={() => { setSelected(listing); setChatId(null); setMessages([]); setError("") }} className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-left transition hover:-translate-y-1 hover:border-white/25">{first ? <img src={imageUrl(first.image_url)} alt={`${listing.marke} ${listing.modell}`} className="aspect-[16/10] w-full object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center text-5xl">🚗</div>}<div className="p-6"><p className="text-xs uppercase tracking-widest text-zinc-500">{listing.jahrgang}</p><h2 className="mt-1 text-2xl font-bold">{listing.marke} {listing.modell}</h2><p className="mt-3 text-sm text-zinc-400">{Number(listing.kilometer).toLocaleString("de-CH")} km · {listing.treibstoff} · {listing.getriebe}</p><p className="mt-5 text-xl font-semibold">CHF {Number(listing.preisvorstellung).toLocaleString("de-CH")}</p></div></button> })}</div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"><div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-zinc-500">Fahrzeug</p><h2 className="mt-1 text-3xl font-bold">{selected.marke} {selected.modell}</h2></div><button onClick={closeVehicle} className="rounded-full border border-white/10 px-4 py-2 text-sm">Schliessen</button></div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div><div className="grid gap-3 sm:grid-cols-2">{selectedImages.map((img) => <img key={img.id} src={imageUrl(img.image_url)} alt={img.image_name || "Fahrzeug"} className="aspect-[4/3] w-full rounded-2xl object-cover" />)}</div><div className="mt-7 grid grid-cols-2 gap-3 text-sm">{[["Jahrgang", selected.jahrgang],["Kilometer", `${Number(selected.kilometer).toLocaleString("de-CH")} km`],["Treibstoff", selected.treibstoff],["Getriebe", selected.getriebe],["Leistung", selected.leistung],["Antrieb", selected.antrieb],["Farbe", selected.fahrzeugfarbe],["MFK", selected.mfk || "–"],["Zustand", selected.zustand],["Unfallschaden", selected.unfallschaden]].map(([k,v]) => <div key={k} className="rounded-xl bg-black/40 p-3"><p className="text-xs text-zinc-600">{k}</p><p className="mt-1 text-zinc-200">{v}</p></div>)}</div><p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{selected.beschreibung}</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/40 p-5"><p className="text-sm text-zinc-500">Preis</p><p className="mt-1 text-3xl font-bold">CHF {Number(selected.preisvorstellung).toLocaleString("de-CH")}</p>{!chatId ? <><div className="mt-6 space-y-3"><div><label className="mb-1 block text-xs text-zinc-500">Name <span className="text-zinc-700">(optional)</span></label><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Dein Name" className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-white/30" /></div><div><label className="mb-1 block text-xs text-zinc-500">Telefon <span className="text-zinc-700">(optional)</span></label><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} type="tel" placeholder="z. B. 079 123 45 67" className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-white/30" /></div></div><button disabled={chatLoading} onClick={() => startChat(selected)} className="mt-5 w-full rounded-xl bg-white px-5 py-4 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-50">{chatLoading ? "Chat wird geöffnet..." : "💬 Verkäufer kontaktieren"}</button><p className="mt-3 text-center text-xs text-zinc-600">Name und Telefonnummer sind freiwillig. Kein Login nötig.</p></> : <><div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">🟢 Live-Chat verbunden</div><div className="mt-4 h-[360px] space-y-3 overflow-y-auto">{messages.length === 0 && <div className="py-12 text-center text-sm text-zinc-600">Noch keine Nachrichten. Schreib dem Verkäufer eine Nachricht.</div>}{messages.map((m) => <div key={m.id} className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === userId ? "ml-auto bg-white text-black" : "bg-zinc-800 text-white"}`}>{m.message}<p className="mt-1 text-[10px] opacity-50">{new Date(m.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</p></div>)}</div><form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="mt-4 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nachricht an den Verkäufer..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-white/30"/><button type="submit" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">Senden</button></form></>}</div>
        </div></div></div>}
    </main>
  )
}
