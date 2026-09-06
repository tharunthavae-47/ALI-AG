"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Order = { id: string; supplier_name: string; delivery_date: string; supplier_id?: string; total_amount: number; paid_amount: number; return_amount: number; adjusted_total_amount: number; refund_amount: number }
type Item = { id: string; order_id: string; item_name: string; quantity: number; unit_price: number }
type ReturnItem = { item_id: string; item_name: string; quantity: number }
type ReturnRequest = { id: string; order_id: string; supplier_id?: string; supplier_name: string; selected_items: ReturnItem[]; reason: string | null; status: string; owner_note: string | null; return_amount: number; refund_amount: number; created_at: string }

const supabase = createClient()
const money = (v: number) => `${Number(v || 0).toFixed(2)} CHF`

export function SupplierReturnsV2() {
  const pathname = usePathname()
  const mode = pathname === "/lieferant" ? "supplier" : pathname?.startsWith("/besitzer") ? "owner" : null
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [selectedOrder, setSelectedOrder] = useState("")
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [reason, setReason] = useState("")
  const [ownerNote, setOwnerNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { if (mode) void load() }, [mode])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let oq = supabase.from("supplier_orders").select("id,supplier_name,delivery_date,supplier_id,total_amount,paid_amount,return_amount,adjusted_total_amount,refund_amount").order("delivery_date", { ascending: false })
    if (mode === "supplier") oq = oq.eq("supplier_id", user.id)
    const { data: od } = await oq
    const nextOrders = (od as Order[]) || []
    setOrders(nextOrders)
    const ids = nextOrders.map((o) => o.id)
    if (ids.length) {
      const { data } = await supabase.from("supplier_order_items").select("id,order_id,item_name,quantity,unit_price").in("order_id", ids)
      setItems((data as Item[]) || [])
    } else setItems([])
    let rq = supabase.from("supplier_returns").select("id,order_id,supplier_id,supplier_name,selected_items,reason,status,owner_note,return_amount,refund_amount,created_at").order("created_at", { ascending: false })
    if (mode === "supplier") rq = rq.eq("supplier_id", user.id)
    const { data: rd } = await rq
    setReturns((rd as ReturnRequest[]) || [])
  }

  const order = orders.find((o) => o.id === selectedOrder)
  const orderItems = useMemo(() => items.filter((i) => i.order_id === selectedOrder), [items, selectedOrder])
  const selectedValue = useMemo(() => orderItems.reduce((s, i) => s + (selectedItems[i.id] || 0) * Number(i.unit_price || 0), 0), [orderItems, selectedItems])

  async function submitReturn() {
    setMessage("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !order) return setMessage("Bitte zuerst einen Auftrag auswählen.")
    const chosen = orderItems.filter((i) => (selectedItems[i.id] || 0) > 0)
    if (!chosen.length) return setMessage("Bitte mindestens ein Teil auswählen.")
    setSaving(true)
    const { error } = await supabase.from("supplier_returns").insert({ order_id: order.id, supplier_id: user.id, supplier_name: order.supplier_name, selected_items: chosen.map((i) => ({ item_id: i.id, item_name: i.item_name, quantity: selectedItems[i.id] })), reason: reason || null, status: "offen" })
    if (error) setMessage(error.message)
    else { setMessage("Retoure eingereicht. Der Preis wird erst nach Besitzer-Bestätigung angepasst."); setSelectedOrder(""); setSelectedItems({}); setReason(""); await load() }
    setSaving(false)
  }

  async function reviewReturn(entry: ReturnRequest, status: "bestaetigt" | "abgelehnt") {
    setMessage("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    if (status === "abgelehnt") {
      const { error } = await supabase.from("supplier_returns").update({ status, owner_note: ownerNote.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", entry.id).eq("status", "offen")
      if (error) setMessage(error.message)
      else { setOwnerNote(""); setMessage("Retoure wurde abgelehnt."); await load() }
      setSaving(false)
      return
    }

    const { data, error } = await supabase.rpc("apply_supplier_return_financials", { p_return_id: entry.id, p_status: "bestaetigt", p_owner_note: ownerNote.trim() || null })
    if (error) {
      setMessage(`Bestätigung fehlgeschlagen: ${error.message}`)
    } else {
      const result = data as { return_value?: number; original_total?: number; new_total?: number; status?: string }
      setOwnerNote("")
      setMessage(`Retoure bestätigt. ${money(Number(result.return_value || 0))} wurden abgezogen. Neuer Auftragswert: ${money(Number(result.new_total || 0))}.`)
      await load()
    }
    setSaving(false)
  }

  if (!mode) return null

  if (mode === "supplier") {
    return <section className="mx-auto mt-14 max-w-6xl border-t border-border px-4 pt-10 sm:px-6">
      <div className="border border-border bg-card p-5 sm:p-7">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Retouren</p>
        <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">Teile zurückgeben</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm">Auftrag<select value={selectedOrder} onChange={(e) => { setSelectedOrder(e.target.value); setSelectedItems({}) }} className="mt-2 w-full border border-border bg-background px-4 py-3"><option value="">Auftrag auswählen...</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.supplier_name} · {new Date(o.delivery_date).toLocaleDateString("de-CH")} · {money(o.adjusted_total_amount)}</option>)}</select></label>
          <label className="text-sm">Grund<select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full border border-border bg-background px-4 py-3"><option value="">Grund auswählen...</option><option>Falsch geliefert</option><option>Beschädigt</option><option>Zu viel geliefert</option><option>Nicht benötigt</option><option>Sonstiges</option></select></label>
        </div>
        {order && <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Ursprünglich</p><b>{money(order.total_amount)}</b></div><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Bereits retourniert</p><b>- {money(order.return_amount)}</b></div><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Diese Retoure</p><b>- {money(selectedValue)}</b></div><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Danach</p><b>{money(Math.max(0, Number(order.adjusted_total_amount) - selectedValue))}</b></div></div>}
        <div className="mt-5 space-y-2">{orderItems.map((i) => <div key={i.id} className="flex items-center justify-between gap-3 border border-border p-4"><label className="flex items-center gap-3"><input type="checkbox" checked={!!selectedItems[i.id]} onChange={(e) => setSelectedItems((x) => { const n = { ...x }; if (e.target.checked) n[i.id] = 1; else delete n[i.id]; return n })}/>{i.item_name} <span className="text-xs text-muted-foreground">{i.quantity} × {money(i.unit_price)}</span></label>{selectedItems[i.id] ? <input type="number" min="1" max={i.quantity} value={selectedItems[i.id]} onChange={(e) => setSelectedItems((x) => ({ ...x, [i.id]: Math.min(i.quantity, Math.max(1, Number(e.target.value) || 1)) }))} className="w-20 border border-border bg-background px-2 py-2"/> : null}</div>)}</div>
        {selectedValue > 0 && <div className="mt-5 border border-border p-4 text-sm"><div className="flex justify-between"><span>Retoure</span><b>- {money(selectedValue)}</b></div><div className="mt-2 flex justify-between"><span>Neuer Auftragswert</span><b>{money(Math.max(0, Number(order?.adjusted_total_amount || 0) - selectedValue))}</b></div>{Number(order?.paid_amount || 0) > Math.max(0, Number(order?.adjusted_total_amount || 0) - selectedValue) && <div className="mt-2 flex justify-between"><span>Rückzahlung/Gutschrift</span><b>{money(Number(order?.paid_amount || 0) - Math.max(0, Number(order?.adjusted_total_amount || 0) - selectedValue))}</b></div>}</div>}
        {message && <p className="mt-5 border border-border p-4 text-sm">{message}</p>}
        <button disabled={saving || !order || selectedValue <= 0} onClick={submitReturn} className="mt-6 w-full bg-primary px-5 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{saving ? "Wird gesendet..." : "Retoure einreichen"}</button>
      </div>
      <div className="mt-8 space-y-3 pb-12"><h3 className="font-display text-xl font-bold uppercase">Meine Retouren</h3>{returns.map((r) => <div key={r.id} className="border border-border bg-card p-5"><div className="flex justify-between"><b>{r.status}</b><span>{new Date(r.created_at).toLocaleString("de-CH")}</span></div><p className="mt-2 text-sm">{r.selected_items.map((i) => `${i.item_name} × ${i.quantity}`).join(", ")}</p>{r.status === "bestaetigt" && <p className="mt-2 font-semibold">Retourenwert: - {money(r.return_amount)} · Rückzahlung/Gutschrift: {money(r.refund_amount)}</p>}{r.owner_note && <p className="mt-2 text-sm">Besitzer: {r.owner_note}</p>}</div>)}</div>
    </section>
  }

  const open = returns.filter((r) => r.status === "offen")
  return <section className="mx-auto mt-14 max-w-7xl border-t border-border px-4 pt-10 sm:px-6 lg:px-8">
    <div className="mb-6"><p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Lieferanten</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Retouren prüfen</h2><p className="mt-2 text-sm text-muted-foreground">Bestätigen oder ablehnen. Die Bestätigung aktualisiert Retoure und Auftrag gemeinsam.</p></div>
    {message && <p className="mb-4 border border-border p-4 text-sm">{message}</p>}
    {open.length === 0 ? <div className="border border-border bg-card p-6 text-sm text-muted-foreground">Keine offenen Retourenanfragen.</div> : <div className="space-y-4">{open.map((r) => { const o = orders.find((x) => x.id === r.order_id); const map = new Map(items.filter((x) => x.order_id === r.order_id).map((x) => [x.id, x])); const amount = r.selected_items.reduce((s, x) => s + Number(x.quantity || 0) * Number(map.get(x.item_id)?.unit_price || 0), 0); const newTotal = Math.max(0, Number(o?.adjusted_total_amount || 0) - amount); const refund = Math.max(0, Number(o?.paid_amount || 0) - newTotal); return <div key={r.id} className="border border-border bg-card p-5 sm:p-6"><div className="flex justify-between gap-3"><div><b className="font-display text-lg uppercase">{r.supplier_name}</b><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("de-CH")}</p></div><span className="border border-border px-3 py-1 text-xs uppercase">Offen</span></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Auftrag aktuell</p><b>{money(o?.adjusted_total_amount || 0)}</b></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Retoure</p><b>- {money(amount)}</b></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Danach</p><b>{money(newTotal)}</b></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Rückzahlung/Gutschrift</p><b>{money(refund)}</b></div></div><div className="mt-4 space-y-2">{r.selected_items.map((x) => <div key={x.item_id} className="flex justify-between border-b border-border pb-2 text-sm"><span>{x.item_name} × {x.quantity}</span><span>{money(Number(x.quantity || 0) * Number(map.get(x.item_id)?.unit_price || 0))}</span></div>)}</div>{r.reason && <p className="mt-4 text-sm text-muted-foreground">Grund: {r.reason}</p>}<textarea value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} rows={2} placeholder="Bemerkung für Lieferant (optional)" className="mt-4 w-full resize-none border border-border bg-background px-4 py-3"/><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => reviewReturn(r, "bestaetigt")} className="bg-primary px-4 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{saving ? "Wird verarbeitet..." : "Retoure bestätigen"}</button><button type="button" disabled={saving} onClick={() => reviewReturn(r, "abgelehnt")} className="border border-border px-4 py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-50">Retoure ablehnen</button></div></div> })}</div>}
    <div className="mt-10 pb-12"><h3 className="font-display text-xl font-bold uppercase">Verlauf</h3><div className="mt-4 space-y-3">{returns.filter((r) => r.status !== "offen").map((r) => <div key={r.id} className="border border-border bg-card p-5"><div className="flex justify-between"><b>{r.supplier_name}</b><span>{r.status}</span></div>{r.status === "bestaetigt" && <p className="mt-2 text-sm font-semibold">Retourenwert: - {money(r.return_amount)} · Rückzahlung/Gutschrift: {money(r.refund_amount)}</p>}</div>)}</div></div>
  </section>
}
