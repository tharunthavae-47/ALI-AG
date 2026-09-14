"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type Item = { item_name: string; quantity: string; unit_price: string }
type Order = { id: string; supplier_name: string; delivery_date: string; total_amount: number; paid_amount: number; notes: string | null; created_at: string; return_amount?: number; adjusted_total_amount?: number | null; refund_amount?: number | null }
type Credit = { id: string; amount: number; remaining_amount: number; status: string; note: string | null; created_at: string }

export default function LieferantPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paid, setPaid] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<Item[]>([{ item_name: "", quantity: "1", unit_price: "" }])
  const [images, setImages] = useState<File[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({})
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    setEmail(user.email ?? "")
    setSupplierName(user.user_metadata?.company_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "")

    const [{ data: orderData }, { data: creditData }] = await Promise.all([
      supabase.from("supplier_orders").select("id,supplier_name,delivery_date,total_amount,paid_amount,notes,created_at,return_amount,adjusted_total_amount,refund_amount").eq("supplier_id", user.id).order("delivery_date", { ascending: false }),
      supabase.from("supplier_credits").select("id,amount,remaining_amount,status,note,created_at").eq("supplier_id", user.id).gt("remaining_amount", 0.005).order("created_at", { ascending: true })
    ])

    const nextOrders = (orderData as Order[]) ?? []
    const nextCredits = (creditData as Credit[]) ?? []
    setOrders(nextOrders)
    setCredits(nextCredits)
    setPaymentInputs(Object.fromEntries(nextOrders.map(o => [o.id, String(Number(o.paid_amount) || 0)])))
    setLoading(false)
  }

  const total = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0), [items])
  const paidNumber = Math.max(0, Number(paid) || 0)
  const availableCredit = useMemo(() => credits.reduce((sum, c) => sum + Math.max(0, Number(c.remaining_amount) || 0), 0), [credits])
  const creditToUse = Math.min(availableCredit, paidNumber)
  const openAmount = Math.max(0, total - paidNumber - creditToUse)

  const supplierOrderTotal = useMemo(() => orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0), [orders])
  const supplierPaidTotal = useMemo(() => orders.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0), [orders])
  const supplierCreditTotal = useMemo(() => orders.reduce((sum, o) => {
    const original = Number(o.total_amount) || 0
    const adjusted = o.adjusted_total_amount == null ? original : Math.max(0, Number(o.adjusted_total_amount) || 0)
    return sum + Math.max(0, original - adjusted)
  }, 0), [orders])
  const supplierOpenTotal = useMemo(() => orders.reduce((sum, o) => {
    const original = Number(o.total_amount) || 0
    const adjusted = o.adjusted_total_amount == null ? original : Math.max(0, Number(o.adjusted_total_amount) || 0)
    return sum + Math.max(0, adjusted - (Number(o.paid_amount) || 0))
  }, 0), [orders])

  function updateItem(index: number, field: keyof Item, value: string) {
    setItems(c => c.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function addItem() { setItems(c => [...c, { item_name: "", quantity: "1", unit_price: "" }]) }
  function removeItem(index: number) { setItems(c => c.length === 1 ? c : c.filter((_, i) => i !== index)) }
  function selectImages(fileList: FileList | null) {
    if (!fileList) return
    setImages(Array.from(fileList).filter(f => f.type.startsWith("image/")).slice(0, 3))
  }

  async function saveOrder() {
    setMessage("")
    if (!userId) return setMessage("Bitte zuerst anmelden.")
    if (!supplierName.trim()) return setMessage("Bitte Lieferant/Firma eingeben.")
    if (!items.some(i => i.item_name.trim())) return setMessage("Bitte mindestens ein geliefertes Teil eingeben.")
    if (total <= 0) return setMessage("Der Gesamtbetrag muss grösser als CHF 0 sein.")
    if (paidNumber > total) return setMessage("Die Barzahlung darf nicht höher als der Gesamtbetrag sein.")

    setSaving(true)
    const amountFromCredit = Math.min(availableCredit, paidNumber)
    const newPaidAmount = paidNumber + amountFromCredit
    const deductions: Array<{ id: string; oldRemaining: number; newRemaining: number; amount: number }> = []
    let left = amountFromCredit

    for (const credit of credits) {
      if (left <= 0) break
      const oldRemaining = Math.max(0, Number(credit.remaining_amount) || 0)
      const amount = Math.min(oldRemaining, left)
      if (amount > 0) {
        deductions.push({ id: credit.id, oldRemaining, newRemaining: Math.max(0, oldRemaining - amount), amount })
        left -= amount
      }
    }

    const { data: order, error } = await supabase.from("supplier_orders").insert({
      supplier_id: userId,
      supplier_name: supplierName.trim(),
      delivery_date: date,
      total_amount: total,
      paid_amount: newPaidAmount,
      notes: notes.trim() || null
    }).select("id").single()

    if (error || !order) {
      setSaving(false)
      return setMessage(error?.message ?? "Auftrag konnte nicht gespeichert werden.")
    }

    const validItems = items.filter(i => i.item_name.trim())
    const { error: itemError } = await supabase.from("supplier_order_items").insert(validItems.map(i => ({
      order_id: order.id,
      item_name: i.item_name.trim(),
      quantity: Number(i.quantity) || 1,
      unit_price: Number(i.unit_price) || 0
    })))
    if (itemError) {
      setSaving(false)
      return setMessage(itemError.message)
    }

    for (const d of deductions) {
      const { error: creditError } = await supabase.from("supplier_credits").update({
        remaining_amount: d.newRemaining,
        status: d.newRemaining <= 0.005 ? "verrechnet" : "offen",
        updated_at: new Date().toISOString()
      }).eq("id", d.id).eq("supplier_id", userId).gte("remaining_amount", d.oldRemaining - 0.005).lte("remaining_amount", d.oldRemaining + 0.005)

      if (creditError) {
        setSaving(false)
        return setMessage(`Auftrag gespeichert, aber Guthaben konnte nicht vollständig verrechnet werden: ${creditError.message}`)
      }
    }

    for (let index = 0; index < images.length; index++) {
      const file = images[index]
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${order.id}/${index + 1}-${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from("supplier-order-images").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false })
      if (!uploadError) await supabase.from("supplier_order_images").insert({ order_id: order.id, image_path: path, image_position: index + 1 })
    }

    setItems([{ item_name: "", quantity: "1", unit_price: "" }])
    setImages([])
    setPaid("")
    setNotes("")
    setMessage(amountFromCredit > 0
      ? `Auftrag gespeichert. CHF ${amountFromCredit.toFixed(2)} vom Guthaben verwendet. Offen: CHF ${Math.max(0, total - paidNumber - amountFromCredit).toFixed(2)}.`
      : "Auftrag wurde gespeichert.")
    await load()
    setSaving(false)
  }

  async function savePayment(order: Order) {
    setMessage("")
    const value = Number(paymentInputs[order.id])
    if (!Number.isFinite(value) || value < 0) return setMessage("Bitte einen gültigen Zahlungsbetrag eingeben.")
    const effectiveTotal = order.adjusted_total_amount == null ? Number(order.total_amount) : Math.max(0, Number(order.adjusted_total_amount) || 0)
    if (value > effectiveTotal) return setMessage("Die Zahlung darf nicht höher als der angepasste Gesamtbetrag des Auftrags sein.")
    setSavingPayment(order.id)
    const { error } = await supabase.from("supplier_orders").update({ paid_amount: value }).eq("id", order.id).eq("supplier_id", userId)
    if (error) { setMessage(error.message); setSavingPayment(null); return }
    await load()
    setMessage("Zahlung wurde aktualisiert.")
    setSavingPayment(null)
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background">Laden...</main>
  if (!userId) return <main className="flex min-h-screen items-center justify-center bg-background px-6"><div className="w-full max-w-md border border-border bg-card p-8 text-center"><p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">MB-Performance</p><h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Lieferant</h1><p className="mt-4 text-sm text-muted-foreground">Bitte melden Sie sich an, um einen Lieferauftrag zu erfassen.</p><Link href="/auth/login" className="mt-7 flex w-full items-center justify-center bg-primary px-5 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground">Zum Login</Link><Link href="/" className="mt-3 flex w-full items-center justify-center border border-border px-5 py-4 text-sm">Zur Website</Link></div></main>

  return <main className="min-h-screen bg-background">
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><p className="font-display text-[10px] uppercase tracking-[0.35em] text-muted-foreground">MB-Performance</p><h1 className="mt-1 font-display text-xl font-bold uppercase tracking-wide">Lieferanten</h1></div><div className="flex items-center gap-2"><Link href="/besitzer" className="hidden border border-border px-4 py-2 text-xs uppercase tracking-wider sm:inline-flex">Besitzer</Link><span className="hidden text-xs text-muted-foreground md:block">{email}</span></div></div></header>
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8"><p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Neue Lieferung</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Auftrag erfassen</h2><p className="mt-3 text-sm text-muted-foreground">Lieferdatum, gelieferte Teile, Zahlung und bis zu 3 Bilder erfassen.</p></div>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="border border-border bg-card p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm">Lieferant / Firma<input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="mt-2 w-full border border-border bg-background px-4 py-3 outline-none" /></label><label className="text-sm">Datum<input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 w-full border border-border bg-background px-4 py-3 outline-none" /></label></div>
          <div className="mt-8 flex items-center justify-between"><h3 className="font-display text-lg font-bold uppercase tracking-wide">Gelieferte Teile</h3><button type="button" onClick={addItem} className="border border-border px-3 py-2 text-xs font-bold uppercase tracking-wider">+ Teil</button></div>
          <div className="mt-4 space-y-3">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_90px_120px_42px]"><input placeholder="Teil / Artikel" value={item.item_name} onChange={e => updateItem(index, "item_name", e.target.value)} className="border border-border bg-background px-3 py-3" /><input type="number" min="0.01" step="0.01" placeholder="Menge" value={item.quantity} onChange={e => updateItem(index, "quantity", e.target.value)} className="border border-border bg-background px-3 py-3" /><input type="number" min="0" step="0.01" placeholder="CHF / Stück" value={item.unit_price} onChange={e => updateItem(index, "unit_price", e.target.value)} className="border border-border bg-background px-3 py-3" /><button type="button" onClick={() => removeItem(index)} className="border border-border px-2 text-sm">×</button></div>)}</div>
          <label className="mt-7 block text-sm">Bemerkung<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional" className="mt-2 w-full resize-none border border-border bg-background px-4 py-3" /></label>
          <div className="mt-7"><p className="text-sm">Bilder <span className="text-muted-foreground">(max. 3)</span></p><input type="file" accept="image/*" multiple onChange={e => selectImages(e.target.files)} className="mt-2 block w-full text-sm" />{images.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{images.length} Bild(er) ausgewählt.</p>}</div>
        </div>
        <div className="h-fit border border-border bg-card p-5 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Abrechnung</p>
          <div className="mt-6 flex items-center justify-between"><span>Gesamtauftrag</span><strong>CHF {total.toFixed(2)}</strong></div>
          <div className="mt-5 border border-border p-4"><div className="flex items-center justify-between text-sm"><span>Verfügbares Guthaben</span><strong>CHF {availableCredit.toFixed(2)}</strong></div><p className="mt-2 text-xs text-muted-foreground">Das vorhandene Guthaben wird beim Speichern automatisch um den bei „Bar erhalten“ eingegebenen Betrag reduziert.</p></div>
          <label className="mt-5 block text-sm">Bar erhalten<input type="number" min="0" max={total} step="0.01" value={paid} onChange={e => setPaid(e.target.value)} placeholder="z. B. 50.00" className="mt-2 w-full border border-border bg-background px-4 py-3 outline-none" /></label>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><span>Offen</span><strong>CHF {openAmount.toFixed(2)}</strong></div>
          <button type="button" onClick={saveOrder} disabled={saving} className="mt-7 w-full bg-primary px-5 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{saving ? "Wird gespeichert..." : "Auftrag speichern"}</button>
          {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
        </div>
      </div>

      <section className="mt-12 border border-border bg-card p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Aufträge</p><p className="mt-1 text-2xl font-bold">{orders.length}</p></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Gesamt</p><p className="mt-1 text-2xl font-bold">CHF {supplierOrderTotal.toFixed(2)}</p></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Offen</p><p className="mt-1 text-2xl font-bold">CHF {supplierOpenTotal.toFixed(2)}</p></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Verfügbares Guthaben</p><p className="mt-1 text-2xl font-bold">CHF {availableCredit.toFixed(2)}</p></div></div>
        <div className="mt-8 overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-3 pr-4">Datum</th><th className="pb-3 pr-4">Lieferant</th><th className="pb-3 pr-4">Total</th><th className="pb-3 pr-4">Bezahlt</th><th className="pb-3 pr-4">Offen</th><th className="pb-3">Zahlung ändern</th></tr></thead><tbody>{orders.map(order => { const effectiveTotal = order.adjusted_total_amount == null ? Number(order.total_amount) : Math.max(0, Number(order.adjusted_total_amount) || 0); const open = Math.max(0, effectiveTotal - Number(order.paid_amount || 0)); return <tr key={order.id} className="border-b border-border/70"><td className="py-4 pr-4">{order.delivery_date}</td><td className="py-4 pr-4">{order.supplier_name}</td><td className="py-4 pr-4">CHF {Number(order.total_amount).toFixed(2)}</td><td className="py-4 pr-4">CHF {Number(order.paid_amount).toFixed(2)}</td><td className="py-4 pr-4">CHF {open.toFixed(2)}</td><td className="py-4"><div className="flex gap-2"><input type="number" min="0" step="0.01" value={paymentInputs[order.id] ?? ""} onChange={e => setPaymentInputs(c => ({ ...c, [order.id]: e.target.value }))} className="w-32 border border-border bg-background px-3 py-2" /><button type="button" disabled={savingPayment === order.id} onClick={() => savePayment(order)} className="border border-border px-3 py-2 text-xs font-bold uppercase">{savingPayment === order.id ? "..." : "Speichern"}</button></div></td></tr> })}</tbody></table></div>
        <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground"><span>Bar bezahlt: CHF {supplierPaidTotal.toFixed(2)}</span><span>Historisch verrechnet: CHF {supplierCreditTotal.toFixed(2)}</span><span>Aktuell verfügbar: CHF {availableCredit.toFixed(2)}</span></div>
      </section>
    </section>
  </main>
}
