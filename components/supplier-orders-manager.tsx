"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type Order = {
  id: string
  supplier_name: string
  delivery_date: string
  total_amount: number
  paid_amount: number
  notes: string | null
}

type Item = { order_id: string; item_name: string; quantity: number; unit_price: number }
type Image = { order_id: string; image_path: string; image_position: number }

export function SupplierOrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [ordersResult, itemsResult, imagesResult] = await Promise.all([
      supabase.from("supplier_orders").select("id,supplier_name,delivery_date,total_amount,paid_amount,notes").order("delivery_date", { ascending: false }),
      supabase.from("supplier_order_items").select("order_id,item_name,quantity,unit_price"),
      supabase.from("supplier_order_images").select("order_id,image_path,image_position").order("image_position"),
    ])
    setOrders((ordersResult.data as Order[]) ?? [])
    setItems((itemsResult.data as Item[]) ?? [])
    setImages((imagesResult.data as Image[]) ?? [])
    setLoading(false)
  }

  const openTotal = useMemo(() => orders.reduce((sum, order) => sum + Math.max(0, Number(order.total_amount) - Number(order.paid_amount)), 0), [orders])
  const paidTotal = useMemo(() => orders.reduce((sum, order) => sum + Number(order.paid_amount), 0), [orders])
  const orderTotal = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total_amount), 0), [orders])

  async function openOrder(order: Order) {
    setSelected(order)
    const orderImages = images.filter((image) => image.order_id === order.id)
    const urls = await Promise.all(orderImages.map(async (image) => {
      const { data } = await supabase.storage.from("supplier-order-images").createSignedUrl(image.image_path, 3600)
      return data?.signedUrl ?? ""
    }))
    setImageUrls(urls.filter(Boolean))
  }

  if (loading) return <div className="border border-border p-6 text-sm text-muted-foreground">Lieferanten-Aufträge werden geladen...</div>

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Gesamt Aufträge</p><p className="mt-2 text-2xl font-bold">CHF {orderTotal.toFixed(2)}</p></div>
        <div className="border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Bereits bar bezahlt</p><p className="mt-2 text-2xl font-bold">CHF {paidTotal.toFixed(2)}</p></div>
        <div className="border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Noch offen gesamt</p><p className="mt-2 text-2xl font-bold">CHF {openTotal.toFixed(2)}</p></div>
      </div>

      {orders.length === 0 ? <div className="border border-border bg-card p-8 text-sm text-muted-foreground">Noch keine Lieferanten-Aufträge vorhanden.</div> : <div className="space-y-3">
        {orders.map((order) => {
          const open = Math.max(0, Number(order.total_amount) - Number(order.paid_amount))
          const orderItems = items.filter((item) => item.order_id === order.id)
          const orderImages = images.filter((image) => image.order_id === order.id)
          return <button key={order.id} type="button" onClick={() => openOrder(order)} className="w-full border border-border bg-card p-5 text-left transition-colors hover:bg-secondary/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="font-display text-lg font-bold uppercase tracking-wide">{order.supplier_name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.delivery_date).toLocaleDateString("de-CH")} · {orderItems.length} Position(en) · {orderImages.length} Bild(er)</p></div>
              <div className="text-right"><p className="font-bold">CHF {Number(order.total_amount).toFixed(2)}</p><p className="text-xs text-muted-foreground">Bezahlt: CHF {Number(order.paid_amount).toFixed(2)}</p><p className="mt-1 font-semibold">Offen: CHF {open.toFixed(2)}</p></div>
            </div>
          </button>
        })}
      </div>}

      {selected && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-background p-6 sm:p-8" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Lieferauftrag</p><h3 className="mt-1 font-display text-2xl font-bold uppercase">{selected.supplier_name}</h3><p className="mt-1 text-sm text-muted-foreground">{new Date(selected.delivery_date).toLocaleDateString("de-CH")}</p></div><button type="button" onClick={() => setSelected(null)} className="border border-border px-3 py-2">×</button></div>
          <div className="mt-7 space-y-3">{items.filter((item) => item.order_id === selected.id).map((item) => <div key={item.item_name + item.quantity} className="flex justify-between gap-4 border-b border-border pb-3 text-sm"><span>{item.item_name} × {item.quantity}</span><span>CHF {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span></div>)}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Gesamt</p><p className="font-bold">CHF {Number(selected.total_amount).toFixed(2)}</p></div><div><p className="text-xs text-muted-foreground">Bar bezahlt</p><p className="font-bold">CHF {Number(selected.paid_amount).toFixed(2)}</p></div><div><p className="text-xs text-muted-foreground">Offen</p><p className="font-bold">CHF {Math.max(0, Number(selected.total_amount) - Number(selected.paid_amount)).toFixed(2)}</p></div></div>
          {selected.notes && <p className="mt-6 border border-border p-4 text-sm">{selected.notes}</p>}
          {imageUrls.length > 0 && <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">{imageUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Lieferauftrag Bild ${index + 1}`} className="aspect-square w-full object-cover" /></a>)}</div>}
        </div>
      </div>}
    </div>
  )
}
