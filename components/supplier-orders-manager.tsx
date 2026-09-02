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

type SupplierSummary = {
  supplierName: string
  totalAmount: number
  paidAmount: number
  openAmount: number
}

export function SupplierOrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [ordersResult, itemsResult, imagesResult] = await Promise.all([
      supabase.from("supplier_orders").select("id,supplier_name,delivery_date,total_amount,paid_amount,notes").order("delivery_date", { ascending: false }),
      supabase.from("supplier_order_items").select("order_id,item_name,quantity,unit_price"),
      supabase.from("supplier_order_images").select("order_id,image_path,image_position").order("image_position"),
    ])

    const nextOrders = (ordersResult.data as Order[]) ?? []
    const nextItems = (itemsResult.data as Item[]) ?? []
    const nextImages = (imagesResult.data as Image[]) ?? []

    setOrders(nextOrders)
    setItems(nextItems)
    setImages(nextImages)

    const urlMap: Record<string, string[]> = {}
    const paths = nextImages.map((image) => image.image_path).filter(Boolean)

    if (paths.length > 0) {
      const { data: signedData } = await supabase.storage
        .from("supplier-order-images")
        .createSignedUrls(paths, 3600)

      ;(signedData ?? []).forEach((signed, index) => {
        const image = nextImages[index]
        const url = signed.signedUrl
        if (!image || !url) return
        if (!urlMap[image.order_id]) urlMap[image.order_id] = []
        urlMap[image.order_id].push(url)
      })
    }

    setImageUrls(urlMap)
    setLoading(false)
  }

  const orderTotal = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total_amount), 0), [orders])
  const paidTotal = useMemo(() => orders.reduce((sum, order) => sum + Number(order.paid_amount), 0), [orders])
  const openTotal = useMemo(() => orders.reduce((sum, order) => sum + Math.max(0, Number(order.total_amount) - Number(order.paid_amount)), 0), [orders])

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    const grouped = new Map<string, SupplierSummary>()

    for (const order of orders) {
      const supplierName = order.supplier_name?.trim() || "Unbekannter Lieferant"
      const totalAmount = Number(order.total_amount) || 0
      const paidAmount = Number(order.paid_amount) || 0
      const current = grouped.get(supplierName) ?? {
        supplierName,
        totalAmount: 0,
        paidAmount: 0,
        openAmount: 0,
      }

      current.totalAmount += totalAmount
      current.paidAmount += paidAmount
      current.openAmount += Math.max(0, totalAmount - paidAmount)
      grouped.set(supplierName, current)
    }

    return Array.from(grouped.values()).sort((a, b) => b.openAmount - a.openAmount)
  }, [orders])

  function openOrder(order: Order) {
    setSelected(order)
    setSelectedImage(null)
  }

  function closeOrder() {
    setSelected(null)
    setSelectedImage(null)
  }

  if (loading) return <div className="border border-border p-6 text-sm text-muted-foreground">Lieferanten-Aufträge werden geladen...</div>

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Gesamt Aufträge</p>
          <p className="mt-2 text-2xl font-bold">CHF {orderTotal.toFixed(2)}</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Bereits bar bezahlt</p>
          <p className="mt-2 text-2xl font-bold">CHF {paidTotal.toFixed(2)}</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Noch offen gesamt</p>
          <p className="mt-2 text-2xl font-bold">CHF {openTotal.toFixed(2)}</p>
        </div>
      </div>

      {supplierSummaries.length > 0 && (
        <section className="mb-10 border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Zahlungsübersicht</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold uppercase tracking-wide">Offene Lieferantenschulden</h3>
                <p className="mt-1 text-sm text-muted-foreground">Alle Besitzer-Logins sehen dieselbe Unternehmensübersicht.</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Gesamt offen</p>
                <p className="text-2xl font-bold">CHF {openTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-4 font-medium sm:px-6">Lieferant</th>
                  <th className="px-5 py-4 text-right font-medium sm:px-6">Gesamt</th>
                  <th className="px-5 py-4 text-right font-medium sm:px-6">Bezahlt</th>
                  <th className="px-5 py-4 text-right font-medium sm:px-6">Noch offen</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummaries.map((supplier) => (
                  <tr key={supplier.supplierName} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-4 font-semibold sm:px-6">{supplier.supplierName}</td>
                    <td className="px-5 py-4 text-right sm:px-6">CHF {supplier.totalAmount.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right sm:px-6">CHF {supplier.paidAmount.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right font-bold sm:px-6">CHF {supplier.openAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/40 font-bold">
                  <td className="px-5 py-4 sm:px-6">Total</td>
                  <td className="px-5 py-4 text-right sm:px-6">CHF {orderTotal.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right sm:px-6">CHF {paidTotal.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right sm:px-6">CHF {openTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {orders.length === 0 ? (
        <div className="border border-border bg-card p-8 text-sm text-muted-foreground">Noch keine Lieferanten-Aufträge vorhanden.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const open = Math.max(0, Number(order.total_amount) - Number(order.paid_amount))
            const orderItems = items.filter((item) => item.order_id === order.id)
            const orderImages = images.filter((image) => image.order_id === order.id)
            const thumbnails = imageUrls[order.id] ?? []

            return (
              <button key={order.id} type="button" onClick={() => openOrder(order)} className="w-full border border-border bg-card p-5 text-left transition-colors hover:bg-secondary/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold uppercase tracking-wide">{order.supplier_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(order.delivery_date).toLocaleDateString("de-CH")} · {orderItems.length} Position(en) · {orderImages.length} Bild(er)</p>
                  </div>

                  <div className="flex items-center gap-4">
                    {thumbnails.length > 0 && (
                      <div className="flex shrink-0 gap-2">
                        {thumbnails.slice(0, 3).map((url, index) => (
                          <img key={url} src={url} alt={`Lieferauftrag Bild ${index + 1}`} className="h-16 w-16 rounded-sm border border-border object-cover" />
                        ))}
                      </div>
                    )}
                    <div className="shrink-0 text-right">
                      <p className="font-bold">CHF {Number(order.total_amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Bezahlt: CHF {Number(order.paid_amount).toFixed(2)}</p>
                      <p className="mt-1 font-semibold">Offen: CHF {open.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={closeOrder}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-background p-6 sm:p-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Lieferauftrag</p>
                <h3 className="mt-1 font-display text-2xl font-bold uppercase">{selected.supplier_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{new Date(selected.delivery_date).toLocaleDateString("de-CH")}</p>
              </div>
              <button type="button" onClick={closeOrder} className="border border-border px-3 py-2">×</button>
            </div>

            <div className="mt-7 space-y-3">
              {items.filter((item) => item.order_id === selected.id).map((item) => (
                <div key={item.item_name + item.quantity} className="flex justify-between gap-4 border-b border-border pb-3 text-sm">
                  <span>{item.item_name} × {item.quantity}</span>
                  <span>CHF {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Gesamt</p><p className="font-bold">CHF {Number(selected.total_amount).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Bar bezahlt</p><p className="font-bold">CHF {Number(selected.paid_amount).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Offen</p><p className="font-bold">CHF {Math.max(0, Number(selected.total_amount) - Number(selected.paid_amount)).toFixed(2)}</p></div>
            </div>

            {selected.notes && <p className="mt-6 border border-border p-4 text-sm">{selected.notes}</p>}

            {(imageUrls[selected.id] ?? []).length > 0 && (
              <div className="mt-7">
                <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Bilder</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {(imageUrls[selected.id] ?? []).map((url, index) => (
                    <button key={url} type="button" onClick={() => setSelectedImage(url)} className="group overflow-hidden border border-border bg-card text-left">
                      <img src={url} alt={`Lieferauftrag Bild ${index + 1}`} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedImage(null)}>
          <button type="button" onClick={() => setSelectedImage(null)} className="absolute right-5 top-5 border border-white/30 bg-black/40 px-4 py-2 text-2xl text-white">×</button>
          <img src={selectedImage} alt="Lieferauftrag Bild gross" className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
