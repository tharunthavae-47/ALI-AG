"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import {
  createCustomer,
  createCustomerVehicle,
  getCustomerDetail,
  updateCustomer,
  updateCustomerVehicle,
  type Customer,
  type CustomerJob,
  type CustomerVehicle,
} from "@/app/besitzer/kunden/actions"

type Props = {
  initialCustomers: Customer[]
  initialVehicles: CustomerVehicle[]
  initialJobs: CustomerJob[]
}

type CustomerForm = {
  first_name: string
  last_name: string
  company: string
  phone: string
  email: string
  street: string
  zip: string
  city: string
  notes: string
}

type VehicleForm = {
  make: string
  model: string
  license_plate: string
  model_year: string
  mileage: string
  vin: string
  notes: string
}

const emptyCustomer: CustomerForm = {
  first_name: "",
  last_name: "",
  company: "",
  phone: "",
  email: "",
  street: "",
  zip: "",
  city: "",
  notes: "",
}

const emptyVehicle: VehicleForm = {
  make: "",
  model: "",
  license_plate: "",
  model_year: "",
  mileage: "",
  vin: "",
  notes: "",
}

function initials(customer: Customer) {
  return `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase()
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function Input({ label, value, onChange, required = false, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}{required && <span className="text-sky-400"> *</span>}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15" />
    </label>
  )
}

export function CustomerErp({ initialCustomers, initialVehicles, initialJobs }: Props) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [jobs] = useState(initialJobs)
  const [search, setSearch] = useState("")
  const [vehicleFilter, setVehicleFilter] = useState("Alle Fahrzeuge")
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailVehicles, setDetailVehicles] = useState<CustomerVehicle[]>([])
  const [detailJobs, setDetailJobs] = useState<CustomerJob[]>([])
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<CustomerVehicle | null>(null)
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomer)
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((customer) => {
      const count = vehicles.filter((v) => v.customer_id === customer.id).length
      const matchesVehicle = vehicleFilter === "Alle Fahrzeuge" || (vehicleFilter === "Mit Fahrzeug" ? count > 0 : count === 0)
      if (!matchesVehicle) return false
      if (!q) return true
      return [customer.first_name, customer.last_name, customer.company, customer.phone, customer.email, customer.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [customers, search, vehicleFilter, vehicles])

  const openNewCustomer = () => {
    setError("")
    setEditingCustomer(null)
    setCustomerForm(emptyCustomer)
    setShowCustomerForm(true)
  }

  const openEditCustomer = (customer: Customer) => {
    setError("")
    setEditingCustomer(customer)
    setCustomerForm({
      first_name: customer.first_name,
      last_name: customer.last_name,
      company: customer.company ?? "",
      phone: customer.phone,
      email: customer.email ?? "",
      street: customer.street ?? "",
      zip: customer.zip ?? "",
      city: customer.city ?? "",
      notes: customer.notes ?? "",
    })
    setShowCustomerForm(true)
  }

  const saveCustomer = async () => {
    setSaving(true)
    setError("")
    const result = editingCustomer
      ? await updateCustomer(editingCustomer.id, customerForm)
      : await createCustomer(customerForm)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? "Speichern fehlgeschlagen.")
    const customer = result.customer as Customer
    setCustomers((current) => editingCustomer ? current.map((item) => item.id === customer.id ? customer : item) : [customer, ...current])
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(customer)
    setShowCustomerForm(false)
    router.refresh()
  }

  const openDetails = async (customer: Customer) => {
    setError("")
    setSelectedCustomer(customer)
    setDetailVehicles(vehicles.filter((v) => v.customer_id === customer.id))
    setDetailJobs(jobs.filter(() => false))
    const result = await getCustomerDetail(customer.id)
    if (result.ok) {
      setDetailVehicles(result.vehicles)
      setDetailJobs(result.jobs)
      setVehicles((current) => {
        const others = current.filter((v) => v.customer_id !== customer.id)
        return [...others, ...result.vehicles]
      })
    } else {
      setError(result.error ?? "Kundendaten konnten nicht geladen werden.")
    }
  }

  const openNewVehicle = () => {
    if (!selectedCustomer) return
    setEditingVehicle(null)
    setVehicleForm(emptyVehicle)
    setError("")
    setShowVehicleForm(true)
  }

  const openEditVehicle = (vehicle: CustomerVehicle) => {
    setEditingVehicle(vehicle)
    setVehicleForm({
      make: vehicle.make,
      model: vehicle.model,
      license_plate: vehicle.license_plate,
      model_year: vehicle.model_year?.toString() ?? "",
      mileage: vehicle.mileage?.toString() ?? "",
      vin: vehicle.vin ?? "",
      notes: vehicle.notes ?? "",
    })
    setError("")
    setShowVehicleForm(true)
  }

  const saveVehicle = async () => {
    if (!selectedCustomer) return
    setSaving(true)
    setError("")
    const payload = {
      make: vehicleForm.make,
      model: vehicleForm.model,
      license_plate: vehicleForm.license_plate,
      model_year: vehicleForm.model_year ? Number(vehicleForm.model_year) : null,
      mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
      vin: vehicleForm.vin,
      notes: vehicleForm.notes,
    }
    const result = editingVehicle
      ? await updateCustomerVehicle(editingVehicle.id, payload)
      : await createCustomerVehicle({ ...payload, customer_id: selectedCustomer.id })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? "Fahrzeug konnte nicht gespeichert werden.")
    const vehicle = result.vehicle as CustomerVehicle
    setVehicles((current) => editingVehicle ? current.map((item) => item.id === vehicle.id ? vehicle : item) : [vehicle, ...current])
    setDetailVehicles((current) => editingVehicle ? current.map((item) => item.id === vehicle.id ? vehicle : item) : [vehicle, ...current])
    setShowVehicleForm(false)
    router.refresh()
  }

  const totalVehicles = vehicles.length
  const activeCustomers = customers.filter((customer) => customer.active).length
  const repeatCustomers = customers.filter((customer) => vehicles.filter((v) => v.customer_id === customer.id).length > 1).length
  const newThisMonth = customers.filter((customer) => {
    const date = new Date(customer.created_at)
    const now = new Date()
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="min-h-screen bg-[#071321] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sky-300"><UsersRound className="h-7 w-7" /><span className="text-3xl font-bold tracking-tight">Kunden</span></div>
            <p className="text-sm text-slate-400">Kunden verwalten, neue erfassen und bestehende Kunden schnell wiederfinden.</p>
          </div>
          <button onClick={openNewCustomer} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400"><Plus className="h-4 w-4" /> Neuer Kunde</button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1a2b] shadow-2xl shadow-black/10">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nach Name, Telefon, E-Mail oder Kennzeichen suchen..." className="h-10 w-full rounded-lg border border-slate-700 bg-[#101f31] pl-10 pr-3 text-sm outline-none focus:border-sky-500" /></div>
              <div className="relative"><select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-700 bg-[#101f31] px-3 pr-9 text-xs font-medium outline-none"><option>Alle Fahrzeuge</option><option>Mit Fahrzeug</option><option>Ohne Fahrzeug</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></div>
              <button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-700 bg-[#101f31] text-slate-400 hover:text-white" title="Filter"><Filter className="h-4 w-4" /></button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="bg-[#0e2034] text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-4 py-3">Nr.</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Telefon</th><th className="px-3 py-3">E-Mail</th><th className="px-3 py-3">Ort</th><th className="px-3 py-3">Fahrzeuge</th><th className="px-3 py-3">Letzter Auftrag</th><th className="px-3 py-3 text-right">Aktionen</th></tr></thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCustomers.map((customer, index) => {
                    const count = vehicles.filter((vehicle) => vehicle.customer_id === customer.id).length
                    const latest = jobs.filter(() => false)[0]?.booking_date
                    return <tr key={customer.id} className="transition hover:bg-sky-500/[0.04]">
                      <td className="px-4 py-4 text-xs text-slate-500">{index + 1}</td>
                      <td className="px-3 py-4"><button onClick={() => openDetails(customer)} className="flex items-center gap-3 text-left"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/20 text-[11px] font-bold text-sky-300">{initials(customer)}</span><span><span className="block text-sm font-semibold text-slate-100">{customer.last_name}, {customer.first_name}</span>{customer.company && <span className="block text-[10px] text-slate-500">{customer.company}</span>}</span></button></td>
                      <td className="px-3 py-4 text-xs text-slate-300">{customer.phone}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{customer.email || "—"}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{customer.city || "—"}</td>
                      <td className="px-3 py-4 text-xs text-slate-300">{count}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{latest ? formatDate(latest) : "—"}</td>
                      <td className="px-3 py-4"><div className="flex justify-end gap-1"><button onClick={() => openDetails(customer)} className="grid h-8 w-8 place-items-center rounded-md text-sky-400 hover:bg-sky-400/10" title="Kunde ansehen"><Eye className="h-4 w-4" /></button><button onClick={() => openEditCustomer(customer)} className="grid h-8 w-8 place-items-center rounded-md text-sky-400 hover:bg-sky-400/10" title="Bearbeiten"><Edit3 className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-700/50 hover:text-white" title="Mehr"><MoreHorizontal className="h-4 w-4" /></button></div></td>
                    </tr>
                  })}
                  {filteredCustomers.length === 0 && <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">Keine Kunden gefunden.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-500"><span>{filteredCustomers.length} Kunden angezeigt</span><div className="flex gap-1"><button className="grid h-8 w-8 place-items-center rounded border border-slate-800"><ChevronLeft className="h-4 w-4" /></button><button className="grid h-8 w-8 place-items-center rounded border border-slate-800 bg-sky-500/10 text-sky-300">1</button><button className="grid h-8 w-8 place-items-center rounded border border-slate-800"><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4"><h3 className="mb-4 text-sm font-semibold text-sky-300">Kunden auf einen Blick</h3><div className="grid grid-cols-2 gap-3">
              <Stat icon={<UsersRound />} label="Gesamt Kunden" value={customers.length} />
              <Stat icon={<UserRound />} label="Aktive Kunden" value={activeCustomers} />
              <Stat icon={<UserRound />} label="Neue Kunden (Monat)" value={newThisMonth} />
              <Stat icon={<Car />} label="Wiederkehrende Kunden" value={repeatCustomers} />
            </div></section>
            <section className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4"><h3 className="mb-3 text-sm font-semibold text-sky-300">Schnellzugriff</h3><div className="space-y-2"><button onClick={openNewCustomer} className="flex h-10 w-full items-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-semibold text-white hover:bg-sky-400"><Plus className="h-4 w-4" /> Neuer Kunde erfassen</button><button onClick={() => { setSearch(""); setVehicleFilter("Alle Fahrzeuge") }} className="flex h-10 w-full items-center gap-2 rounded-lg bg-[#12253a] px-3 text-xs text-slate-200 hover:bg-[#18304a]"><ClipboardList className="h-4 w-4 text-slate-400" /> Alle Kunden anzeigen</button><button onClick={() => document.querySelector<HTMLInputElement>("input[placeholder^='Nach Name']")?.focus()} className="flex h-10 w-full items-center gap-2 rounded-lg bg-[#12253a] px-3 text-xs text-slate-200 hover:bg-[#18304a]"><Search className="h-4 w-4 text-slate-400" /> Kunden suchen</button></div></section>
          </aside>
        </div>
      </div>

      {selectedCustomer && <div className="fixed inset-0 z-50 bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedCustomer(null) }}><div className="mx-auto flex h-full max-w-4xl items-center justify-center"><section className="max-h-[92vh] w-full overflow-hidden rounded-2xl border border-slate-700 bg-[#0a1929] shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 p-4"><button onClick={() => setSelectedCustomer(null)} className="inline-flex items-center gap-2 text-xs text-sky-300"><ChevronLeft className="h-4 w-4" /> Zurück zur Übersicht</button><div className="flex gap-2"><button onClick={() => openEditCustomer(selectedCustomer)} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs"><Edit3 className="h-3.5 w-3.5" /> Bearbeiten</button><button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-700"><X className="h-4 w-4" /></button></div></div>
          <div className="max-h-[calc(92vh-65px)] overflow-y-auto p-5">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-[#0e2034] p-4 sm:flex-row sm:items-center"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-lg font-bold text-sky-300">{initials(selectedCustomer)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{selectedCustomer.first_name} {selectedCustomer.last_name}</h2><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">{selectedCustomer.active ? "Aktiver Kunde" : "Inaktiv"}</span></div><div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2"><span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {selectedCustomer.phone}</span><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {selectedCustomer.email || "Keine E-Mail"}</span><span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {[selectedCustomer.street, selectedCustomer.zip, selectedCustomer.city].filter(Boolean).join(", ") || "Keine Adresse"}</span></div></div></div>
            <div className="mt-5 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Fahrzeuge des Kunden</h3><p className="mt-1 text-xs text-slate-500">{detailVehicles.length} Fahrzeug{detailVehicles.length === 1 ? "" : "e"} hinterlegt</p></div><button onClick={openNewVehicle} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold hover:bg-sky-400"><Plus className="h-3.5 w-3.5" /> Fahrzeug hinzufügen</button></div>
            <div className="mt-3 space-y-2">{detailVehicles.map((vehicle) => <div key={vehicle.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0c1d30] p-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-slate-800"><Car className="h-6 w-6 text-sky-300" /></span><div><p className="text-sm font-semibold">{vehicle.make} {vehicle.model}</p><p className="mt-1 text-[11px] text-slate-500">{vehicle.license_plate} · {vehicle.model_year || "—"} · {vehicle.mileage ? `${vehicle.mileage.toLocaleString("de-CH")} km` : "Kilometer —"}</p></div></div><button onClick={() => openEditVehicle(vehicle)} className="grid h-8 w-8 place-items-center rounded-md text-sky-400 hover:bg-sky-400/10"><Edit3 className="h-4 w-4" /></button></div>)}{detailVehicles.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">Noch kein Fahrzeug hinterlegt.</div>}</div>
            <div className="mt-6"><div className="mb-3 flex items-end justify-between"><div><h3 className="text-sm font-semibold">Letzte Aufträge</h3><p className="mt-1 text-xs text-slate-500">Termine und Werkstattaufträge dieses Kunden</p></div></div><div className="overflow-hidden rounded-xl border border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-[#0e2034] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Datum</th><th className="px-3 py-2">Leistung / Fahrzeug</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-slate-800">{detailJobs.map((job) => <tr key={job.id}><td className="px-3 py-3 text-slate-400">{formatDate(job.booking_date)}</td><td className="px-3 py-3"><span className="block font-medium">{job.car || "Werkstattauftrag"}</span><span className="mt-1 block text-[11px] text-slate-500">{job.problem}</span></td><td className="px-3 py-3"><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{job.status}</span></td></tr>)}{detailJobs.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Noch keine verknüpften Aufträge.</td></tr>}</tbody></table></div></div>
            {selectedCustomer.notes && <div className="mt-5 rounded-xl border border-slate-800 bg-[#0c1d30] p-4"><h3 className="text-xs font-semibold text-slate-300">Notizen</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{selectedCustomer.notes}</p></div>}
          </div>
        </section></div></div>}

      {showCustomerForm && <Modal title={editingCustomer ? "Kunde bearbeiten" : "Neuer Kunde erfassen"} onClose={() => setShowCustomerForm(false)}><div className="grid gap-4 sm:grid-cols-2"><Input label="Vorname" required value={customerForm.first_name} onChange={(value) => setCustomerForm({ ...customerForm, first_name: value })} placeholder="z.B. Stefan" /><Input label="Nachname" required value={customerForm.last_name} onChange={(value) => setCustomerForm({ ...customerForm, last_name: value })} placeholder="z.B. Meier" /><Input label="Firma" value={customerForm.company} onChange={(value) => setCustomerForm({ ...customerForm, company: value })} placeholder="Optional" /><Input label="Telefon" required value={customerForm.phone} onChange={(value) => setCustomerForm({ ...customerForm, phone: value })} placeholder="z.B. +41 76 123 45 67" /><div className="sm:col-span-2"><Input label="E-Mail" type="email" value={customerForm.email} onChange={(value) => setCustomerForm({ ...customerForm, email: value })} placeholder="z.B. kunde@email.ch" /></div><Input label="Strasse" value={customerForm.street} onChange={(value) => setCustomerForm({ ...customerForm, street: value })} placeholder="z.B. Musterstrasse 12" /><Input label="PLZ" value={customerForm.zip} onChange={(value) => setCustomerForm({ ...customerForm, zip: value })} placeholder="6102" /><Input label="Ort" value={customerForm.city} onChange={(value) => setCustomerForm({ ...customerForm, city: value })} placeholder="Luzern" /><label className="sm:col-span-2 block space-y-1.5"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Bemerkungen</span><textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={4} placeholder="Wichtige Hinweise, Vorlieben etc." className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm outline-none focus:border-sky-500" /></label></div>{error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowCustomerForm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs">Abbrechen</button><button disabled={saving} onClick={saveCustomer} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold disabled:opacity-50">{saving ? "Speichern..." : "Kunde speichern"}</button></div></Modal>}

      {showVehicleForm && selectedCustomer && <Modal title={editingVehicle ? "Fahrzeug bearbeiten" : "Fahrzeug hinzufügen"} onClose={() => setShowVehicleForm(false)}><div className="grid gap-4 sm:grid-cols-2"><Input label="Marke" required value={vehicleForm.make} onChange={(value) => setVehicleForm({ ...vehicleForm, make: value })} placeholder="z.B. BMW" /><Input label="Modell" required value={vehicleForm.model} onChange={(value) => setVehicleForm({ ...vehicleForm, model: value })} placeholder="z.B. 320d" /><Input label="Kennzeichen" required value={vehicleForm.license_plate} onChange={(value) => setVehicleForm({ ...vehicleForm, license_plate: value })} placeholder="z.B. ZH 123 456" /><Input label="Jahrgang" value={vehicleForm.model_year} onChange={(value) => setVehicleForm({ ...vehicleForm, model_year: value })} placeholder="z.B. 2018" type="number" /><Input label="Kilometerstand" value={vehicleForm.mileage} onChange={(value) => setVehicleForm({ ...vehicleForm, mileage: value })} placeholder="z.B. 120000" type="number" /><Input label="VIN / Fahrgestellnummer" value={vehicleForm.vin} onChange={(value) => setVehicleForm({ ...vehicleForm, vin: value })} placeholder="Optional" /><label className="sm:col-span-2 block space-y-1.5"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Bemerkungen</span><textarea value={vehicleForm.notes} onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm outline-none focus:border-sky-500" /></label></div>{error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowVehicleForm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs">Abbrechen</button><button disabled={saving} onClick={saveVehicle} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold disabled:opacity-50">{saving ? "Speichern..." : "Fahrzeug speichern"}</button></div></Modal>}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border border-slate-800 bg-[#102238] p-3"><div className="mb-2 flex items-center gap-2 text-sky-300">{icon && <span className="h-4 w-4">{icon}</span>}<span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span></div><p className="text-2xl font-bold">{value}</p></div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0a1929] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div>{children}</div></div>
}
