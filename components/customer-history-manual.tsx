"use client"

import { useEffect, useState } from "react"
import { ClipboardList, Plus, Trash2 } from "lucide-react"
import { createCustomerHistory, deleteCustomerHistory, getCustomerHistory, type Customer, type CustomerHistoryEntry, type CustomerVehicle } from "@/app/besitzer/kunden/actions"

type Props = { customers: Customer[]; vehicles: CustomerVehicle[] }

const today = () => new Date().toISOString().slice(0, 10)
const empty = { entry_date: today(), title: "", description: "", mileage: "", mechanic: "", parts: "", vehicle_id: "" }

export function CustomerHistoryManual({ customers, vehicles }: Props) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [history, setHistory] = useState<CustomerHistoryEntry[]>([])
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const customerVehicles = vehicles.filter(v => v.customer_id === customerId)

  const load = async (id: string) => {
    if (!id) { setHistory([]); return }
    const r = await getCustomerHistory(id)
    if (r.ok) { setHistory(r.history); setError("") }
    else setError(r.error ?? "Historie konnte nicht geladen werden.")
  }

  useEffect(() => { void load(customerId) }, [customerId])

  const save = async () => {
    if (!customerId) return
    setSaving(true); setError("")
    const r = await createCustomerHistory({ customer_id: customerId, vehicle_id: form.vehicle_id || null, entry_date: form.entry_date, title: form.title, description: form.description, mileage: form.mileage ? Number(form.mileage) : null, mechanic: form.mechanic || null, parts: form.parts || null })
    setSaving(false)
    if (!r.ok) { setError(r.error ?? "Historie konnte nicht gespeichert werden."); return }
    setHistory(cur => [r.history as CustomerHistoryEntry, ...cur])
    setForm({ ...empty, entry_date: today() })
    setOpen(false)
  }

  const remove = async (id: string) => {
    if (!window.confirm("Diesen Historieneintrag wirklich löschen?")) return
    const r = await deleteCustomerHistory(id)
    if (!r.ok) { setError(r.error ?? "Historieneintrag konnte nicht gelöscht werden."); return }
    setHistory(cur => cur.filter(x => x.id !== id))
  }

  return <section className="mt-6 rounded-2xl border border-slate-800 bg-[#0a1726] shadow-2xl">
    <div className="flex flex-col gap-4 border-b border-slate-800 bg-[#0b1a2b] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><ClipboardList className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-white">Manuelle Kunden-Historie</h2><p className="text-xs text-slate-400">Zusätzliche Werkstattarbeiten direkt beim Kunden dokumentieren.</p></div></div>
      <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-[#101f31] px-3 text-sm text-slate-100 outline-none focus:border-sky-500">{customers.map(c => <option key={c.id} value={c.id}>{c.last_name}, {c.first_name}</option>)}</select>
    </div>
    <div className="p-4">
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <button type="button" onClick={() => { setForm({ ...empty, entry_date: today() }); setOpen(true); setError("") }} disabled={!customerId} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"><Plus className="h-4 w-4" /> Historie hinzufügen</button>
      <div className="mt-4 space-y-3">
        {history.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">Noch keine manuellen Historieneinträge vorhanden.</div> : history.map(entry => { const vehicle = vehicles.find(v => v.id === entry.vehicle_id); return <article key={entry.id} className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{entry.title}</h3><span className="text-xs text-slate-500">{new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(entry.entry_date))}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{entry.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">{vehicle && <span className="rounded-md border border-slate-700 px-2 py-1">{vehicle.make} {vehicle.model} · {vehicle.license_plate}</span>}{entry.mileage != null && <span className="rounded-md border border-slate-700 px-2 py-1">{entry.mileage.toLocaleString("de-CH")} km</span>}{entry.mechanic && <span className="rounded-md border border-slate-700 px-2 py-1">Mechaniker: {entry.mechanic}</span>}{entry.parts && <span className="rounded-md border border-slate-700 px-2 py-1">Teile: {entry.parts}</span>}</div></div><button type="button" onClick={() => remove(entry.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div></article> })}
      </div>
    </div>
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0a1929] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-white">Historie für {customers.find(c => c.id === customerId)?.first_name} {customers.find(c => c.id === customerId)?.last_name}</h2><p className="mt-1 text-xs text-slate-400">Was wurde beim Kunden gemacht?</p></div><button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">Schliessen</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Datum</span><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" /></label><label className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Fahrzeug</span><select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100"><option value="">Kein Fahrzeug</option>{customerVehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.license_plate}</option>)}</select></label></div><div className="mt-4 space-y-4"><label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Titel *</span><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z. B. Bremsen ersetzt" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" /></label><label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Durchgeführte Arbeiten / Notiz *</span><textarea rows={6} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Was wurde gemacht? Was wurde festgestellt?" className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100" /></label><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Kilometerstand</span><input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" /></label><label className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mechaniker</span><input value={form.mechanic} onChange={e => setForm(f => ({ ...f, mechanic: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" /></label><label className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Verwendete Teile</span><input value={form.parts} onChange={e => setForm(f => ({ ...f, parts: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100" /></label></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300">Abbrechen</button><button type="button" onClick={save} disabled={saving || !form.title.trim() || !form.description.trim()} className="h-10 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Speichert…" : "Historie speichern"}</button></div></div></div>}
  </section>
}
