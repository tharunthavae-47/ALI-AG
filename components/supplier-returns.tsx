"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Order = {
  id: string
  supplier_name: string
  delivery_date: string
  supplier_id?: string
  total_amount: number
  paid_amount: number
  return_amount: number
  adjusted_total_amount: number
  refund_amount: number
}
type Item = { id: string; order_id: string; item_name: string; quantity: number; unit_price: number }
type ReturnItem = { item_id: string; item_name: string; quantity: number }
type ReturnRequest = {
  id: string
  order_id: string
  supplier_id?: string
  supplier_name: string
  selected_items: ReturnItem[]
  reason: string | null
  status: string
  owner_note: string | null
  return_amount: number
  refund_amount: number
  created_at: string
}

const supabase = createClient()
const money = (value: number) => `${Number(value || 0).toFixed(2)} CHF`

export function SupplierReturns() {
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
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => { if (mode) load() }, [mode])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let orderQuery = supabase
      .from("supplier_orders")
      .select("id,supplier_name,delivery_date,supplier_id,total_amount,paid_amount,return_amount,adjusted_total_amount,refund_amount")
      .order("delivery_date", { ascending: false })
    if (mode === "supplier") orderQuery = orderQuery.eq("supplier_id", user.id)

    const { data: orderData } = await orderQuery
    const nextOrders = (orderData as Order[]) ?? []
    setOrders(nextOrders)

    const orderIds = nextOrders.map((order) => order.id)
    if (orderIds.length > 0) {
      const { data: itemData } = await supabase
        .from("supplier_order_items")
        .select("id,order_id,item_name,quantity,unit_price")
        .in("order_id", orderIds)
      setItems((itemData as Item[]) ?? [])
    } else {
      setItems([])
    }

    let returnQuery = supabase
      .from("supplier_returns")
      .select("id,order_id,supplier_id,supplier_name,selected_items,reason,status,owner_note,return_amount,refund_amount,created_at")
      .order("created_at", { ascending: false })
    if (mode === "supplier") returnQuery = returnQuery.eq("supplier_id", user.id)
    const { data: returnData } = await returnQuery
    setReturns((returnData ?? []) as ReturnRequest[])
    setLoading(false)
  }

  const selectedOrderData = orders.find((order) => order.id === selectedOrder)
  const orderItems = useMemo(() => items.filter((item) => item.order_id === selectedOrder), [items, selectedOrder])
  const selectedReturnAmount = useMemo(
    () => orderItems.reduce((sum, item) => sum + (Number(selectedItems[item.id]) || 0) * (Number(item.unit_price) || 0), 0),
    [orderItems, selectedItems],
  )
  const selectedAdjustedTotal = Math.max(0, Number(selectedOrderData?.total_amount || 0) - Number(selectedOrderData?.return_amount || 0) - selectedReturnAmount)
  const selectedRefund = Math.max(0, Number(selectedOrderData?.paid_amount || 0) - selectedAdjustedTotal)

  function toggleItem(item: Item, checked: boolean) {
    setSelectedItems((current) => {
      const next = { ...current }
      if (!checked) delete next[item.id]
      else next[item.id] = Math.max(1, Number(item.quantity) || 1)
      return next
    })
  }

  function setQuantity(item: Item, value: string) {
    const max = Number(item.quantity) || 0
    const quantity = Math.min(max, Math.max(1, Number(value) || 1))
    setSelectedItems((current) => ({ ...current, [item.id]: quantity }))
  }

  async function submitReturn() {
    setMessage("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedOrder) return setMessage("Bitte zuerst einen Auftrag auswählen.")
    const chosen = orderItems.filter((item) => selectedItems[item.id] > 0)
    if (chosen.length === 0) return setMessage("Bitte mindestens ein Teil auswählen.")

    setSaving(true)
    const order = orders.find((entry) => entry.id === selectedOrder)
    const payload = chosen.map((item) => ({ item_id: item.id, item_name: item.item_name, quantity: selectedItems[item.id] }))
    const { error } = await supabase.from("supplier_returns").insert({
      order_id: selectedOrder,
      supplier_id: user.id,
      supplier_name: order?.supplier_name ?? "",
      selected_items: payload,
      reason: reason.trim() || null,
      status: "offen",
    })
    if (error) setMessage(error.message)
    else {
      setMessage("Retoure wurde eingereicht. Der Preis wird erst nach Bestätigung durch den Besitzer angepasst.")
      setSelectedItems({})
      setSelectedOrder("")
      setReason("")
      await load()
    }
    setSaving(false)
  }

  async function reviewReturn(entry: ReturnRequest, status: "bestaetigt" | "abgelehnt") {
    setMessage("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)

    if (status === "abgelehnt") {
      const { error } = await supabase
        .from("supplier_returns")
        .update({ status, owner_note: ownerNote.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", entry.id)
        .eq("status", "offen")
      if (error) setMessage(error.message)
      else { setOwnerNote(""); await load(); setMessage("Retoure wurde abgelehnt.") }
      setSaving(false)
      return
    }

    const order = orders.find((item) => item.id === entry.order_id)
    if (!order) {
      setMessage("Der zugehörige Auftrag wurde nicht gefunden.")
      setSaving(false)
      return
    }

    const orderItemMap = new Map(items.filter((item) => item.order_id === entry.order_id).map((item) => [item.id, item]))
    const returnAmount = entry.selected_items.reduce((sum, returned) => {
      const item = orderItemMap.get(returned.item_id)
      return sum + (Number(returned.quantity) || 0) * (Number(item?.unit_price) || 0)
    }, 0)

    if (returnAmount <= 0) {
      setMessage("Der Retourenwert konnte nicht berechnet werden. Bitte prüfe die Auftragspositionen.")
      setSaving(false)
      return
    }

    const newReturnAmount = Number(order.return_amount || 0) + returnAmount
    const adjustedTotal = Math.max(0, Number(order.total_amount || 0) - newReturnAmount)
    const refundAmount = Math.max(0, Number(order.paid_amount || 0) - adjustedTotal)

    const { error: returnError } = await supabase
      .from("supplier_returns")
      .update({
        status: "bestaetigt",
        return_amount: returnAmount,
        refund_amount: refundAmount,
        owner_note: ownerNote.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", entry.id)
      .eq("status", "offen")

    if (returnError) {
      setMessage(returnError.message)
      setSaving(false)
      return
    }

    const { error: orderError } = await supabase
      .from("supplier_orders")
      .update({ return_amount: newReturnAmount })
      .eq("id", order.id)

    if (orderError) {
      setMessage(`Retoure bestätigt, aber der Auftragspreis konnte nicht aktualisiert werden: ${orderError.message}`)
    } else {
      setOwnerNote("")
      await load()
      setMessage(`Retoure bestätigt. ${money(returnAmount)} wurden abgezogen.${refundAmount > 0 ? ` Rückzahlung/Gutschrift: ${money(refundAmount)}.` : ""}`)
    }
    setSaving(false)
  }

  if (!mode) return null
  if (loading) return <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6"><div className="border border-border bg-card p-6 text-sm text-muted-foreground">Retouren werden geladen...</div></div>

  if (mode === "supplier") {
    return (
      <section className="mx-auto mt-14 max-w-6xl border-t border-border px-4 pt-10 sm:px-6">
        <div className="border border-border bg-card p-5 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Retouren</p>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">Teile zurückgeben</h2>
          <p className="mt-2 text-sm text-muted-foreground">Wähle einen bestehenden Auftrag und genau die Teile und Mengen aus, die retourniert werden sollen.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm">Auftrag<select value={selectedOrder} onChange={(e) => { setSelectedOrder(e.target.value); setSelectedItems({}) }} className="mt-2 w-full border border-border bg-background px-4 py-3"><option value="">Auftrag auswählen...</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.supplier_name} · {new Date(order.delivery_date).toLocaleDateString("de-CH")} · {money(order.adjusted_total_amount)}</option>)}</select></label>
            <label className="text-sm">Grund<select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full border border-border bg-background px-4 py-3"><option value="">Grund auswählen...</option><option>Falsch geliefert</option><option>Beschädigt</option><option>Zu viel geliefert</option><option>Nicht benötigt</option><option>Sonstiges</option></select></label>
          </div>
          {selectedOrderData && <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Auftragswert</p><p className="mt-1 font-bold">{money(selectedOrderData.total_amount)}</p></div><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Bereits retourniert</p><p className="mt-1 font-bold">{money(selectedOrderData.return_amount)}</p></div><div className="border border-border p-4"><p className="text-xs text-muted-foreground">Aktueller Wert</p><p className="mt-1 font-bold">{money(selectedOrderData.adjusted_total_amount)}</p></div></div>}
          {orderItems.length > 0 && <div className="mt-6 space-y-2">{orderItems.map((item) => <div key={item.id} className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-3"><input type="checkbox" checked={Boolean(selectedItems[item.id])} onChange={(e) => toggleItem(item, e.target.checked)} /><span>{item.item_name}</span><span className="text-xs text-muted-foreground">geliefert: {item.quantity} · {money(item.unit_price)} / Stk.</span></label>{selectedItems[item.id] ? <input type="number" min="1" max={item.quantity} value={selectedItems[item.id]} onChange={(e) => setQuantity(item, e.target.value)} className="w-24 border border-border bg-background px-3 py-2" /> : null}</div>)}</div>}
          {selectedReturnAmount > 0 && <div className="mt-5 border border-border p-4"><div className="flex justify-between text-sm"><span>Diese Retoure</span><strong>- {money(selectedReturnAmount)}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Neuer Auftragswert nach Bestätigung</span><strong>{money(selectedAdjustedTotal)}</strong></div>{selectedRefund > 0 && <div className="mt-2 flex justify-between text-sm"><span>Voraussichtliche Rückzahlung/Gutschrift</span><strong>{money(selectedRefund)}</strong></div>}</div>}
          {message && <p className="mt-5 border border-border p-4 text-sm">{message}</p>}
          <button type="button" disabled={saving || !selectedOrder} onClick={submitReturn} className="mt-6 w-full bg-primary px-5 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{saving ? "Wird gesendet..." : "Retoure einreichen"}</button>
        </div>
        <div className="mt-8 space-y-3 pb-12"><h3 className="font-display text-xl font-bold uppercase tracking-wide">Meine Retouren</h3>{returns.length === 0 ? <p className="border border-border p-5 text-sm text-muted-foreground">Noch keine Retouren.</p> : returns.map((entry) => <div key={entry.id} className="border border-border bg-card p-5"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><strong>{entry.supplier_name}</strong><span className="text-xs uppercase tracking-widest text-muted-foreground">{entry.status}</span></div><p className="mt-3 text-sm">{entry.selected_items.map((item) => `${item.item_name} × ${item.quantity}`).join(", ")}</p>{entry.status === "bestaetigt" && <p className="mt-2 text-sm font-semibold">Retourenwert: - {money(entry.return_amount)} · Rückzahlung/Gutschrift: {money(entry.refund_amount)}</p>}{entry.reason && <p className="mt-2 text-xs text-muted-foreground">Grund: {entry.reason}</p>}{entry.owner_note && <p className="mt-2 text-sm">Besitzer: {entry.owner_note}</p>}</div>)}</div>
      </section>
    )
  }

  const openReturns = returns.filter((entry) => entry.status === "offen")
  return (
    <section className="mx-auto mt-14 max-w-7xl border-t border-border px-4 pt-10 sm:px-6 lg:px-8">
      <div className="mb-6"><p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Lieferanten</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Retouren prüfen</h2><p className="mt-2 text-sm text-muted-foreground">Retourenanfragen von Lieferanten bestätigen oder ablehnen. Bei Bestätigung wird der Retourenwert automatisch vom Auftrag abgezogen.</p></div>
      {openReturns.length === 0 ? <div className="border border-border bg-card p-6 text-sm text-muted-foreground">Keine offenen Retourenanfragen.</div> : <div className="space-y-4">{openReturns.map((entry) => { const order = orders.find((item) => item.id === entry.order_id); const itemMap = new Map(items.filter((item) => item.order_id === entry.order_id).map((item) => [item.id, item])); const amount = entry.selected_items.reduce((sum, returned) => sum + (Number(returned.quantity) || 0) * (Number(itemMap.get(returned.item_id)?.unit_price) || 0), 0); return <div key={entry.id} className="border border-border bg-card p-5 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display text-lg font-bold uppercase">{entry.supplier_name}</p><p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("de-CH")}</p></div><span className="border border-border px-3 py-1 text-xs uppercase tracking-widest">Offen</span></div>{order && <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Auftrag</p><p className="font-semibold">{money(order.total_amount)}</p></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Bereits retourniert</p><p className="font-semibold">{money(order.return_amount)}</p></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Retourenwert</p><p className="font-semibold">- {money(amount)}</p></div><div className="border border-border p-3"><p className="text-xs text-muted-foreground">Neuer Auftragswert</p><p className="font-semibold">{money(Math.max(0, Number(order.total_amount) - Number(order.return_amount) - amount))}</p></div></div>}<div className="mt-5 space-y-2">{entry.selected_items.map((item) => <div key={item.item_id} className="flex justify-between border-b border-border pb-2 text-sm"><span>{item.item_name} × {item.quantity}</span><span>{money((Number(itemMap.get(item.item_id)?.unit_price) || 0) * Number(item.quantity))}</span></div>)}</div>{entry.reason && <p className="mt-4 text-sm text-muted-foreground">Grund: {entry.reason}</p>}<textarea value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} rows={2} placeholder="Bemerkung für Lieferant (optional)" className="mt-4 w-full resize-none border border-border bg-background px-4 py-3"/><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => reviewReturn(entry, "bestaetigt")} className="bg-primary px-4 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground">Retoure bestätigen</button><button type="button" disabled={saving} onClick={() => reviewReturn(entry, "abgelehnt")} className="border border-border px-4 py-3 text-sm font-bold uppercase tracking-widest">Retoure ablehnen</button></div></div> })}</div>}
      <div className="mt-10 pb-12"><h3 className="font-display text-xl font-bold uppercase tracking-wide">Verlauf</h3><div className="mt-4 space-y-3">{returns.filter((entry) => entry.status !== "offen").map((entry) => <div key={entry.id} className="border border-border bg-card p-5"><div className="flex justify-between gap-3"><strong>{entry.supplier_name}</strong><span className="text-xs uppercase tracking-widest">{entry.status}</span></div><p className="mt-2 text-sm">{entry.selected_items.map((item) => `${item.item_name} × ${item.quantity}`).join(", ")}</p>{entry.status === "bestaetigt" && <p className="mt-2 text-sm font-semibold">Retourenwert: - {money(entry.return_amount)} · Rückzahlung/Gutschrift: {money(entry.refund_amount)}</p>}{entry.owner_note && <p className="mt-2 text-sm text-muted-foreground">Besitzer: {entry.owner_note}</p>}</div>)}</div></div>
    </section>
  )
}
