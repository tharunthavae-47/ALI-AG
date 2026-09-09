"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Listing = {
  id: string
  owner_id: string
  occasion_request_id: string
  published: boolean
  published_at: string | null
  occasion_requests: any
}

type ImageRow = { id: string; occasion_request_id: string; image_url: string; image_name: string | null; image_position: number }

export default function KaufenPage() {
  const supabase = createClient()
  const [listings, setListings] = useState<Listing[]>([])
  const [images, setImages] = useState<ImageRow[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load() {
    const { data, error: listingError } = await supabase
      .from("occasion_listings")
      .select("*, occasion_requests(*)")
      .eq("published", true)
      .order("published_at", { ascending: false })
    if (listingError) { setError(listingError.message); return }
    const rows = data || []
    setListings(rows)
    if (rows.length) setImages((await supabase.from("occasion_images").select("*").in("occasion_request_id", rows.map((x: any) => x.occasion_request_id)).order("image_position", { ascending: true })).data || [])
  }

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  const selectedImages = useMemo(() => selected ? images.filter((x) => x.occasion_request_id === selected.occasion_request_id).sort((a,b) => a.image_position - b.image_position) : [], [selected, images])

  function imageUrl(path: string) {
    return supabase.storage.from("occasion-images").getPublicUrl(path).data.publicUrl
  }

  async function startChat(listing: Listing) {
    setError("")
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setError("Bitte zuerst anmelden, um den Verkäufer zu kontaktieren."); return }
    const { data: existing } = await supabase.from("occasion_chats").select("id").eq("occasion_listing_id", listing.id).eq("customer_id", auth.user.id).maybeSingle()
    let id = existing?.id || null
    if (!id) {
      const { data: created, error: createError } = await supabase.from("occasion_chats").insert({ occasion_listing_id: listing.id, customer_id: auth.user.id, owner_id: listing.owner_id }).select("id").single()
      if (createError) { setError(createError.message); return }
      id = created.id
    }
    setChatId(id)
    const { data: msgs } = await supabase.from("occasion_messages").select("*").eq("chat_id", id).order("created_at", { ascending: true })
    setMessages(msgs || [])
  }

  useEffect(() => {
    if (!chatId) return
    const channel = supabase.channel(`occasion-customer-chat-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "occasion_messages", filter: `chat_id=eq.${chatId}` }, (payload) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  async function sendMessage() {
    const text = draft.trim()
    if (!text || !chatId || !userId) return
    const { error: sendError } = await supabase.from("occasion_messages").insert({ chat_id: chatId, sender_id: userId, message: text })
    if (sendError) setError(sendError.message)
    else { setDraft(""); await supabase.from("occasion_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId) }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Link href="/" className="font-bold tracking-[0.2em]">MB PERFORMANCE</Link><Link href="/occasion" className="text-sm text-zinc-400 hover:text-white">← Occasion</Link></div></header>
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">Occasion</p>
        <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><h1 className="text-4xl font-bold tracking-tight md:text-6xl">Fahrzeuge kaufen</h1><p className="mt-4 max-w-2xl text-zinc-400">Geprüfte Fahrzeuge, die von MB Performance manuell für den Verkauf veröffentlicht wurden.</p></div><Link href="/auth/login" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white hover:text-black">Anmelden</Link></div>
        {error && <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>}
        {listings.length === 0 ? <div className="mt-12 rounded-3xl border border-white/10 bg-zinc-950 p-12 text-center text-zinc-500">Aktuell sind keine Fahrzeuge online.</div> : <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => { const r = listing.occasion_requests; const first = images.find((i) => i.occasion_request_id === listing.occasion_request_id); return <button key={listing.id} onClick={() => { setSelected(listing); setChatId(null) }} className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-left transition hover:-translate-y-1 hover:border-white/25">{first ? <img src={imageUrl(first.image_url)} alt={`${r.marke} ${r.modell}`} className="aspect-[16/10] w-full object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center text-5xl">🚗</div>}<div className="p-6"><p className="text-xs uppercase tracking-widest text-zinc-500">{r.jahrgang}</p><h2 className="mt-1 text-2xl font-bold">{r.marke} {r.modell}</h2><p className="mt-3 text-sm text-zinc-400">{Number(r.kilometer).toLocaleString("de-CH")} km · {r.treibstoff} · {r.getriebe}</p><p className="mt-5 text-xl font-semibold">CHF {Number(r.preisvorstellung).toLocaleString("de-CH")}</p></div></button> })}</div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"><div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-zinc-500">Fahrzeug</p><h2 className="mt-1 text-3xl font-bold">{selected.occasion_requests.marke} {selected.occasion_requests.modell}</h2></div><button onClick={() => setSelected(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm">Schliessen</button></div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div><div className="grid gap-3 sm:grid-cols-2">{selectedImages.map((img) => <img key={img.id} src={imageUrl(img.image_url)} alt={img.image_name || "Fahrzeug"} className="aspect-[4/3] w-full rounded-2xl object-cover" />)}</div><div className="mt-7 grid grid-cols-2 gap-3 text-sm">{[["Jahrgang", selected.occasion_requests.jahrgang],["Kilometer", `${Number(selected.occasion_requests.kilometer).toLocaleString("de-CH")} km`],["Treibstoff", selected.occasion_requests.treibstoff],["Getriebe", selected.occasion_requests.getriebe],["Leistung", selected.occasion_requests.leistung],["Antrieb", selected.occasion_requests.antrieb],["Farbe", selected.occasion_requests.fahrzeugfarbe],["MFK", selected.occasion_requests.mfk || "–"]].map(([k,v]) => <div key={k} className="rounded-xl bg-black/40 p-3"><p className="text-xs text-zinc-600">{k}</p><p className="mt-1 text-zinc-200">{v}</p></div>)}</div><p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{selected.occasion_requests.beschreibung}</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/40 p-5"><p className="text-sm text-zinc-500">Preis</p><p className="mt-1 text-3xl font-bold">CHF {Number(selected.occasion_requests.preisvorstellung).toLocaleString("de-CH")}</p>{!chatId ? <button onClick={() => startChat(selected)} className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-bold uppercase tracking-wider text-black">💬 Verkäufer kontaktieren</button> : <><div className="mt-6 h-[360px] space-y-3 overflow-y-auto">{messages.map((m) => <div key={m.id} className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === userId ? "ml-auto bg-white text-black" : "bg-zinc-800 text-white"}`}>{m.message}<p className="mt-1 text-[10px] opacity-50">{new Date(m.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</p></div>)}</div><form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="mt-4 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nachricht schreiben..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-white/30"/><button className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">Senden</button></form></>}</div>
        </div></div></div>}
    </main>
  )
}
