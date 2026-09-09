"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function OccasionMarketplaceManager() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [chats, setChats] = useState<any[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: requestData }, { data: listingData }] = await Promise.all([
      supabase.from("occasion_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("occasion_listings").select("*, occasion_requests(*)").order("published_at", { ascending: false }),
    ])
    setRequests(requestData || [])
    setListings(listingData || [])
    await loadChats()
    setLoading(false)
  }

  async function loadChats() {
    const { data } = await supabase
      .from("occasion_chats")
      .select("*, occasion_listings(*, occasion_requests(*))")
      .order("updated_at", { ascending: false })
    setChats(data || [])
  }

  async function publish(requestId: string) {
    setBusy(requestId)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setBusy(null); return }
    const { error } = await supabase.from("occasion_listings").upsert({
      occasion_request_id: requestId,
      owner_id: userData.user.id,
      published: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "occasion_request_id" })
    if (!error) await load()
    else console.error(error)
    setBusy(null)
  }

  async function unpublish(listingId: string) {
    setBusy(listingId)
    await supabase.from("occasion_listings").update({ published: false, updated_at: new Date().toISOString() }).eq("id", listingId)
    await load()
    setBusy(null)
  }

  async function openChat(chatId: string) {
    setSelectedChat(chatId)
    const { data } = await supabase.from("occasion_messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true })
    setMessages(data || [])
  }

  useEffect(() => {
    if (!selectedChat) return
    const channel = supabase.channel(`occasion-owner-chat-${selectedChat}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "occasion_messages", filter: `chat_id=eq.${selectedChat}` }, (payload) => {
        setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedChat])

  async function sendMessage() {
    const text = draft.trim()
    if (!text || !selectedChat) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { error } = await supabase.from("occasion_messages").insert({ chat_id: selectedChat, sender_id: userData.user.id, message: text })
    if (!error) {
      setDraft("")
      await supabase.from("occasion_chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat)
    }
  }

  const publishedIds = new Set(listings.filter((l) => l.published).map((l) => l.occasion_request_id))
  const unpublished = requests.filter((r) => !publishedIds.has(r.id))
  const published = listings.filter((l) => l.published)

  if (loading) return <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">Occasion-Marktplatz wird geladen...</div>

  return (
    <section className="space-y-10">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Marketplace</p>
        <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Occasion veröffentlichen</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Prüfe eingereichte Fahrzeuge und veröffentliche sie manuell bei „Occasion kaufen“.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {unpublished.map((r) => (
          <div key={r.id} className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{r.jahrgang}</p><h3 className="mt-1 text-xl font-bold">{r.marke} {r.modell}</h3></div>
              <p className="font-semibold">CHF {Number(r.preisvorstellung).toLocaleString("de-CH")}</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{Number(r.kilometer).toLocaleString("de-CH")} km · {r.treibstoff} · {r.getriebe}</p>
            <button disabled={busy === r.id} onClick={() => publish(r.id)} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">{busy === r.id ? "Wird veröffentlicht..." : "Fahrzeug veröffentlichen"}</button>
          </div>
        ))}
        {unpublished.length === 0 && <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">Keine weiteren Fahrzeuge zur Veröffentlichung.</div>}
      </div>

      <div>
        <h3 className="font-display text-2xl font-bold uppercase tracking-wide">Online</h3>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {published.map((l) => {
            const r = l.occasion_requests
            return <div key={l.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">🟢 Online</p><h4 className="mt-1 text-xl font-bold">{r?.marke} {r?.modell}</h4></div><p className="font-semibold">CHF {Number(r?.preisvorstellung || 0).toLocaleString("de-CH")}</p></div>
              <button disabled={busy === l.id} onClick={() => unpublish(l.id)} className="mt-5 rounded-xl border border-border px-4 py-3 text-sm font-bold uppercase tracking-wider hover:bg-secondary disabled:opacity-50">Anzeige deaktivieren</button>
            </div>
          })}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-4"><div><h3 className="font-display text-2xl font-bold uppercase tracking-wide">Kunden-Chats</h3><p className="mt-2 text-sm text-muted-foreground">Live-Nachrichten zu deinen veröffentlichten Fahrzeugen.</p></div><span className="rounded-full border border-border px-3 py-1 text-xs">{chats.length} Chats</span></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {chats.map((chat) => { const r = chat.occasion_listings?.occasion_requests; return <button key={chat.id} onClick={() => openChat(chat.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedChat === chat.id ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary"}`}><p className="text-xs text-muted-foreground">{r?.marke} {r?.modell}</p><p className="mt-1 font-semibold">Kunde</p><p className="mt-1 text-xs text-muted-foreground">{new Date(chat.updated_at).toLocaleString("de-CH")}</p></button> })}
            {chats.length === 0 && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Noch keine Kunden-Chats.</div>}
          </div>
          <div className="min-h-[420px] rounded-3xl border border-border bg-card p-5">
            {!selectedChat ? <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">Wähle einen Chat aus.</div> : <>
              <div className="h-[320px] space-y-3 overflow-y-auto pr-2">{messages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === chats.find((c) => c.id === selectedChat)?.owner_id ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.message}<p className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</p></div>)}</div>
              <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="mt-4 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nachricht schreiben..." className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"/><button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Senden</button></form>
            </>}
          </div>
        </div>
      </div>
    </section>
  )
}
