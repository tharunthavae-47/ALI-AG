"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Car, Clock3, Edit3, Eye, Mail, MapPin, Phone, Plus, Search, Trash2, UsersRound, Wrench, X } from "lucide-react"
import {
  createCustomer,
  createCustomerVehicle,
  deleteCustomer,
  deleteCustomerVehicle,
  getCustomerDetail,
  updateCustomer,
  updateCustomerJob,
  updateCustomerVehicle,
  type Customer,
  type CustomerJob,
  type CustomerVehicle,
} from "@/app/besitzer/kunden/actions"

type Props = { initialCustomers: Customer[]; initialVehicles: CustomerVehicle[]; initialJobs: CustomerJob[] }
type CustomerForm = { first_name:string; last_name:string; company:string; phone:string; email:string; street:string; zip:string; city:string; notes:string }
type VehicleForm = { make:string; model:string; license_plate:string; model_year:string; mileage:string; vin:string; notes:string }
type JobForm = { work_done:string; mileage:string; labor_hours:string; parts:string; mechanic:string; status:string }

const emptyCustomer: CustomerForm = { first_name:"", last_name:"", company:"", phone:"", email:"", street:"", zip:"", city:"", notes:"" }
const emptyVehicle: VehicleForm = { make:"", model:"", license_plate:"", model_year:"", mileage:"", vin:"", notes:"" }
const emptyJob: JobForm = { work_done:"", mileage:"", labor_hours:"", parts:"", mechanic:"", status:"pending" }
const fullName = (c: Customer) => `${c.first_name} ${c.last_name}`.trim()
const initials = (c: Customer) => `${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase()
const formatDate = (v?: string | null) => v ? new Intl.DateTimeFormat("de-CH", { day:"2-digit", month:"2-digit", year:"numeric" }).format(new Date(v)) : "—"
const statusLabel = (s:string) => s === "confirmed" ? "Bestätigt" : s === "pending" ? "Offen" : s === "rejected" ? "Abgelehnt" : s
const statusClass = (s:string) => s === "confirmed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : s === "pending" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-slate-700 bg-slate-800/50 text-slate-400"

function Field({ label, value, onChange, required=false, type="text", placeholder }: { label:string; value:string; onChange:(v:string)=>void; required?:boolean; type?:string; placeholder?:string }) {
  return <label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}{required && <span className="text-sky-400"> *</span>}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30" /></label>
}
function Area({ label, value, onChange, rows=4, placeholder }: { label:string; value:string; onChange:(v:string)=>void; rows?:number; placeholder?:string }) {
  return <label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span><textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30" /></label>
}
function Modal({ title, onClose, children, wide=false }: { title:string; onClose:()=>void; children:React.ReactNode; wide?:boolean }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className={`${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-[#0a1929] p-5 shadow-2xl`}><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-white">{title}</h2><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-white"><X className="h-4 w-4" /></button></div>{children}</div></div>
}

export function CustomerErp({ initialCustomers, initialVehicles, initialJobs }: Props) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [selected, setSelected] = useState<Customer | null>(initialCustomers[0] ?? null)
  const [detailVehicles, setDetailVehicles] = useState<CustomerVehicle[]>(initialCustomers[0] ? initialVehicles.filter(v=>v.customer_id===initialCustomers[0].id) : [])
  const [jobs, setJobs] = useState<CustomerJob[]>(initialCustomers[0] ? initialJobs.filter(j=>j.customer_id===initialCustomers[0].id) : [])
  const [search, setSearch] = useState("")
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [jobForm, setJobForm] = useState(emptyJob)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<CustomerVehicle | null>(null)
  const [editingJob, setEditingJob] = useState<CustomerJob | null>(null)
  const [customerModal, setCustomerModal] = useState(false)
  const [vehicleModal, setVehicleModal] = useState(false)
  const [jobModal, setJobModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => !q || [c.first_name,c.last_name,c.company,c.phone,c.email,c.city,...vehicles.filter(v=>v.customer_id===c.id).map(v=>v.license_plate)].filter(Boolean).join(" ").toLowerCase().includes(q))
  }, [customers, search, vehicles])

  const totalVehicles = vehicles.length
  const openJobs = initialJobs.filter(j => j.status === "pending" || String(j.status).toLowerCase() === "offen").length

  const openCustomer = async (customer: Customer) => {
    setError(""); setSelected(customer); setDetailVehicles(vehicles.filter(v=>v.customer_id===customer.id)); setJobs([])
    const result = await getCustomerDetail(customer.id)
    if (result.ok) { setDetailVehicles(result.vehicles); setJobs(result.jobs) } else setError(result.error ?? "Kundendaten konnten nicht geladen werden.")
  }
  const newCustomer = () => { setEditingCustomer(null); setCustomerForm({...emptyCustomer}); setError(""); setCustomerModal(true) }
  const editCustomer = (c: Customer) => { setEditingCustomer(c); setCustomerForm({first_name:c.first_name,last_name:c.last_name,company:c.company??"",phone:c.phone,email:c.email??"",street:c.street??"",zip:c.zip??"",city:c.city??"",notes:c.notes??""}); setError(""); setCustomerModal(true) }
  const saveCustomer = async () => {
    setSaving(true); setError("")
    const result = editingCustomer ? await updateCustomer(editingCustomer.id, customerForm) : await createCustomer(customerForm)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? "Kunde konnte nicht gespeichert werden.")
    const c = result.customer as Customer
    setCustomers(current => editingCustomer ? current.map(x=>x.id===c.id?c:x) : [c,...current])
    setSelected(current => current?.id === c.id ? c : current)
    setCustomerModal(false); router.refresh()
    if (!editingCustomer) openCustomer(c)
  }
  const removeCustomer = async () => {
    if (!selected || !window.confirm(`Kunde „${fullName(selected)}“ wirklich löschen?`)) return
    setDeleting(true); setError(""); const result = await deleteCustomer(selected.id); setDeleting(false)
    if (!result.ok) return setError(result.error ?? "Kunde konnte nicht gelöscht werden.")
    const id = selected.id; const next = customers.filter(c=>c.id!==id)
    setCustomers(next); setVehicles(v=>v.filter(x=>x.customer_id!==id)); setSelected(next[0] ?? null); setDetailVehicles([]); setJobs([]); router.refresh()
    if (next[0]) openCustomer(next[0])
  }
  const newVehicle = () => { if (!selected) return; setEditingVehicle(null); setVehicleForm({...emptyVehicle}); setError(""); setVehicleModal(true) }
  const editVehicle = (v: CustomerVehicle) => { setEditingVehicle(v); setVehicleForm({make:v.make,model:v.model,license_plate:v.license_plate,model_year:v.model_year?.toString()??"",mileage:v.mileage?.toString()??"",vin:v.vin??"",notes:v.notes??""}); setError(""); setVehicleModal(true) }
  const saveVehicle = async () => {
    if (!selected) return; setSaving(true); setError("")
    const payload = {make:vehicleForm.make,model:vehicleForm.model,license_plate:vehicleForm.license_plate,model_year:vehicleForm.model_year?Number(vehicleForm.model_year):null,mileage:vehicleForm.mileage?Number(vehicleForm.mileage):null,vin:vehicleForm.vin,notes:vehicleForm.notes}
    const result = editingVehicle ? await updateCustomerVehicle(editingVehicle.id,payload) : await createCustomerVehicle({...payload,customer_id:selected.id})
    setSaving(false)
    if (!result.ok) return setError(result.error ?? "Fahrzeug konnte nicht gespeichert werden.")
    const v = result.vehicle as CustomerVehicle
    setVehicles(current=>editingVehicle?current.map(x=>x.id===v.id?v:x):[v,...current]); setDetailVehicles(current=>editingVehicle?current.map(x=>x.id===v.id?v:x):[v,...current]); setVehicleModal(false); router.refresh()
  }
  const removeVehicle = async (v:CustomerVehicle) => {
    if (!window.confirm(`Fahrzeug „${v.make} ${v.model} · ${v.license_plate}“ wirklich löschen?`)) return
    setDeleting(true); setError(""); const result = await deleteCustomerVehicle(v.id); setDeleting(false)
    if (!result.ok) return setError(result.error ?? "Fahrzeug konnte nicht gelöscht werden.")
    setVehicles(current=>current.filter(x=>x.id!==v.id)); setDetailVehicles(current=>current.filter(x=>x.id!==v.id)); router.refresh()
  }
  const editJob = (j:CustomerJob) => { setEditingJob(j); setJobForm({work_done:j.work_done??"",mileage:j.mileage?.toString()??"",labor_hours:j.labor_hours?.toString()??"",parts:j.parts??"",mechanic:j.mechanic??"",status:j.status??"pending"}); setError(""); setJobModal(true) }
  const saveJob = async () => {
    if (!editingJob) return; setSaving(true); setError("")
    const result = await updateCustomerJob(editingJob.id,{work_done:jobForm.work_done||null,mileage:jobForm.mileage?Number(jobForm.mileage):null,labor_hours:jobForm.labor_hours?Number(jobForm.labor_hours):null,parts:jobForm.parts||null,mechanic:jobForm.mechanic||null,status:jobForm.status})
    setSaving(false)
    if (!result.ok) return setError(result.error ?? "Auftrag konnte nicht gespeichert werden.")
    const updated = result.job as CustomerJob; setJobs(current=>current.map(j=>j.id===updated.id?updated:j)); setJobModal(false); router.refresh()
  }

  return <div className="min-h-screen bg-[#071321] text-slate-100">
    <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-3 text-sky-300"><UsersRound className="h-7 w-7"/><h1 className="text-2xl font-bold sm:text-3xl">Kunden ERP</h1></div><p className="mt-2 text-sm text-slate-400">Kunden, Fahrzeuge und komplette Werkstatt-Historie zentral verwalten.</p></div>
        <button type="button" onClick={newCustomer} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 text-sm font-semibold text-slate-950 hover:bg-sky-400"><Plus className="h-4 w-4"/> Neuer Kunde</button>
      </div>
      {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Kunden",customers.length,UsersRound],["Fahrzeuge",totalVehicles,Car],["Werkstattaufträge",initialJobs.length,Wrench],["Offene Aufträge",openJobs,Clock3]].map(([label,value,Icon])=><div key={String(label)} className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value as number}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><Icon className="h-5 w-5"/></span></div></div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[310px_minmax(360px,0.85fr)_minmax(480px,1.25fr)]">
        <section className="min-w-0 rounded-xl border border-slate-800 bg-[#0b1a2b] shadow-xl">
          <div className="border-b border-slate-800 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kunde oder Kennzeichen suchen..." className="h-10 w-full rounded-lg border border-slate-700 bg-[#101f31] pl-9 pr-3 text-sm outline-none focus:border-sky-500"/></div></div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {filtered.map(c=>{const active=selected?.id===c.id; const count=vehicles.filter(v=>v.customer_id===c.id).length; return <button key={c.id} type="button" onClick={()=>openCustomer(c)} className={`mb-2 w-full rounded-xl border p-3 text-left transition ${active?"border-sky-400/50 bg-sky-400/10":"border-transparent bg-[#0e2034] hover:border-slate-700"}`}><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-xs font-bold text-sky-300">{initials(c)||"K"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{c.last_name}, {c.first_name}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{c.phone} · {count} Fahrzeug{count===1?"":"e"}</span></span><Eye className="h-4 w-4 shrink-0 text-sky-400"/></div></button>})}
            {filtered.length===0 && <p className="p-8 text-center text-sm text-slate-500">Keine Kunden gefunden.</p>}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-800 bg-[#0b1a2b] p-5 shadow-xl">
          {!selected ? <div className="flex min-h-[500px] items-center justify-center text-center text-sm text-slate-500">Noch keinen Kunden ausgewählt.</div> : <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Kundenprofil</p><h2 className="mt-1 text-xl font-bold text-white">{fullName(selected)}</h2>{selected.company&&<p className="mt-1 text-xs text-slate-400">{selected.company}</p>}</div><div className="flex gap-2"><button type="button" onClick={()=>editCustomer(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:border-sky-500"><Edit3 className="h-3.5 w-3.5"/> Bearbeiten</button><button type="button" onClick={removeCustomer} disabled={deleting} className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 disabled:opacity-50" title="Kunde löschen"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><div className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4"/><span className="text-[10px] uppercase tracking-[0.15em]">Telefon</span></div><p className="mt-2 text-sm">{selected.phone||"—"}</p></div><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><div className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4"/><span className="text-[10px] uppercase tracking-[0.15em]">E-Mail</span></div><p className="mt-2 break-all text-sm">{selected.email||"—"}</p></div><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3 sm:col-span-2"><div className="flex items-center gap-2 text-slate-400"><MapPin className="h-4 w-4"/><span className="text-[10px] uppercase tracking-[0.15em]">Adresse</span></div><p className="mt-2 text-sm">{[selected.street,selected.zip,selected.city].filter(Boolean).join(", ")||"—"}</p></div></div>
            <div className="mt-6 flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Fahrzeuge</p><h3 className="mt-1 text-base font-semibold">Fuhrpark des Kunden</h3></div><button type="button" onClick={newVehicle} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"><Plus className="h-3.5 w-3.5"/> Fahrzeug</button></div>
            <div className="mt-3 space-y-2">{detailVehicles.length===0?<div className="rounded-lg border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">Noch kein Fahrzeug hinterlegt.</div>:detailVehicles.map(v=><div key={v.id} className="rounded-lg border border-slate-800 bg-[#0e2034] p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{v.make} {v.model}</p><p className="mt-1 text-xs text-slate-400">{v.license_plate} · {v.model_year??"—"} · {v.mileage!=null?`${v.mileage.toLocaleString("de-CH")} km`:"—"}</p></div><div className="flex gap-1"><button type="button" onClick={()=>editVehicle(v)} className="grid h-8 w-8 place-items-center rounded-md text-sky-400 hover:bg-sky-400/10" title="Fahrzeug bearbeiten"><Edit3 className="h-3.5 w-3.5"/></button><button type="button" onClick={()=>removeVehicle(v)} disabled={deleting} className="grid h-8 w-8 place-items-center rounded-md text-red-300 hover:bg-red-500/10 disabled:opacity-50" title="Fahrzeug löschen"><Trash2 className="h-3.5 w-3.5"/></button></div></div></div>)}</div>
          </>}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-800 bg-[#0b1a2b] shadow-xl"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Werkstatt</p><h2 className="mt-1 text-base font-semibold">Komplette Historie</h2></div><Wrench className="h-5 w-5 text-sky-300"/></div><div className="max-h-[760px] overflow-y-auto p-4">{!selected?<div className="p-10 text-center text-sm text-slate-500">Kunden auswählen, um die Historie zu sehen.</div>:jobs.length===0?<div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">Noch keine verknüpften Werkstattaufträge.</div>:<div className="space-y-3">{jobs.map(j=><article key={j.id} className="rounded-xl border border-slate-800 bg-[#0e2034] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{j.car||"Werkstattauftrag"}</p><p className="mt-1 text-xs text-slate-400">{formatDate(j.booking_date)} · {j.booking_time||"—"} Uhr</p></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(j.status)}`}>{statusLabel(j.status)}</span><button type="button" onClick={()=>editJob(j)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-sky-300 hover:border-sky-500" title="Auftrag bearbeiten"><Edit3 className="h-3.5 w-3.5"/></button></div></div><div className="mt-3 rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Problem / Auftrag</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-300">{j.problem||"Keine Beschreibung hinterlegt."}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Durchgeführte Arbeiten</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-300">{j.work_done||"Noch nicht eingetragen"}</p></div><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Kilometerstand</p><p className="mt-1 text-[11px] text-slate-300">{j.mileage!=null?`${j.mileage.toLocaleString("de-CH")} km`:"—"}</p></div><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Arbeitszeit</p><p className="mt-1 text-[11px] text-slate-300">{j.labor_hours!=null?`${j.labor_hours} h`:"—"}</p></div><div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Mechaniker</p><p className="mt-1 text-[11px] text-slate-300">{j.mechanic||"—"}</p></div></div><div className="mt-2 rounded-lg border border-slate-800 bg-[#0a1929] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Verwendete Teile</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-300">{j.parts||"—"}</p></div></article>)}</div>}</div></section>
      </div>
    </div>

    {customerModal && <Modal title={editingCustomer?"Kunde bearbeiten":"Neuer Kunde"} onClose={()=>setCustomerModal(false)}><div className="grid gap-4 sm:grid-cols-2"><Field label="Vorname" required value={customerForm.first_name} onChange={v=>setCustomerForm({...customerForm,first_name:v})}/><Field label="Nachname" required value={customerForm.last_name} onChange={v=>setCustomerForm({...customerForm,last_name:v})}/><Field label="Firma" value={customerForm.company} onChange={v=>setCustomerForm({...customerForm,company:v})}/><Field label="Telefon" required value={customerForm.phone} onChange={v=>setCustomerForm({...customerForm,phone:v})}/><div className="sm:col-span-2"><Field label="E-Mail" type="email" value={customerForm.email} onChange={v=>setCustomerForm({...customerForm,email:v})}/></div><Field label="Strasse" value={customerForm.street} onChange={v=>setCustomerForm({...customerForm,street:v})}/><Field label="PLZ" value={customerForm.zip} onChange={v=>setCustomerForm({...customerForm,zip:v})}/><Field label="Ort" value={customerForm.city} onChange={v=>setCustomerForm({...customerForm,city:v})}/><div className="sm:col-span-2"><Area label="Notizen" value={customerForm.notes} onChange={v=>setCustomerForm({...customerForm,notes:v})}/></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setCustomerModal(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs">Abbrechen</button><button type="button" disabled={saving} onClick={saveCustomer} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{saving?"Speichern...":"Speichern"}</button></div></Modal>}
    {vehicleModal && selected && <Modal title={editingVehicle?"Fahrzeug bearbeiten":"Fahrzeug hinzufügen"} onClose={()=>setVehicleModal(false)}><div className="grid gap-4 sm:grid-cols-2"><Field label="Marke" required value={vehicleForm.make} onChange={v=>setVehicleForm({...vehicleForm,make:v})}/><Field label="Modell" required value={vehicleForm.model} onChange={v=>setVehicleForm({...vehicleForm,model:v})}/><Field label="Kennzeichen" required value={vehicleForm.license_plate} onChange={v=>setVehicleForm({...vehicleForm,license_plate:v})}/><Field label="Jahrgang" type="number" value={vehicleForm.model_year} onChange={v=>setVehicleForm({...vehicleForm,model_year:v})}/><Field label="Kilometerstand" type="number" value={vehicleForm.mileage} onChange={v=>setVehicleForm({...vehicleForm,mileage:v})}/><Field label="VIN / Fahrgestellnummer" value={vehicleForm.vin} onChange={v=>setVehicleForm({...vehicleForm,vin:v})}/><div className="sm:col-span-2"><Area label="Fahrzeug-Notizen" rows={3} value={vehicleForm.notes} onChange={v=>setVehicleForm({...vehicleForm,notes:v})}/></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setVehicleModal(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs">Abbrechen</button><button type="button" disabled={saving} onClick={saveVehicle} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{saving?"Speichern...":"Speichern"}</button></div></Modal>}
    {jobModal && editingJob && <Modal title="Werkstattauftrag bearbeiten" wide onClose={()=>setJobModal(false)}><div className="mb-4 rounded-xl border border-slate-800 bg-[#0e2034] p-4"><p className="text-sm font-semibold">{editingJob.car||"Werkstattauftrag"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(editingJob.booking_date)} · {editingJob.booking_time||"—"} Uhr</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Area label="Durchgeführte Arbeiten" rows={5} value={jobForm.work_done} onChange={v=>setJobForm({...jobForm,work_done:v})}/></div><Field label="Kilometerstand" type="number" value={jobForm.mileage} onChange={v=>setJobForm({...jobForm,mileage:v})}/><Field label="Arbeitszeit (Stunden)" type="number" value={jobForm.labor_hours} onChange={v=>setJobForm({...jobForm,labor_hours:v})}/><Field label="Mechaniker" value={jobForm.mechanic} onChange={v=>setJobForm({...jobForm,mechanic:v})}/><label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</span><select value={jobForm.status} onChange={e=>setJobForm({...jobForm,status:e.target.value})} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100"><option value="pending">Offen</option><option value="confirmed">Bestätigt</option><option value="rejected">Abgelehnt</option></select></label><div className="sm:col-span-2"><Area label="Verwendete Teile / Material" rows={4} value={jobForm.parts} onChange={v=>setJobForm({...jobForm,parts:v})}/></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setJobModal(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs">Abbrechen</button><button type="button" disabled={saving} onClick={saveJob} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{saving?"Speichern...":"Auftrag speichern"}</button></div></Modal>}
  </div>
}
