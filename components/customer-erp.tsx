"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Car,
  Clock3,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UsersRound,
  Wrench,
  X,
} from "lucide-react"
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

type JobForm = {
  work_done: string
  mileage: string
  labor_hours: string
  parts: string
  mechanic: string
  status: string
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

const emptyJob: JobForm = {
  work_done: "",
  mileage: "",
  labor_hours: "",
  parts: "",
  mechanic: "",
  status: "pending",
}

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "—"

const initials = (customer: Customer) =>
  `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase()

const fullName = (customer: Customer) =>
  `${customer.first_name} ${customer.last_name}`.trim()

function Input({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
        {required && <span className="text-sky-400"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
      />
    </label>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-[#0a1929] p-5 shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-700 text-slate-300 transition hover:border-sky-500 hover:text-white"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CustomerErp({
  initialCustomers,
  initialVehicles,
  initialJobs,
}: Props) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Customer | null>(null)
  const [detailVehicles, setDetailVehicles] = useState<CustomerVehicle[]>([])
  const [jobs, setJobs] = useState<CustomerJob[]>(initialJobs)

  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomer)
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicle)
  const [jobForm, setJobForm] = useState<JobForm>(emptyJob)
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
    const query = search.trim().toLowerCase()
    return customers.filter((customer) => {
      if (!query) return true
      const customerVehicles = vehicles
        .filter((vehicle) => vehicle.customer_id === customer.id)
        .map((vehicle) => vehicle.license_plate)
      return [
        customer.first_name,
        customer.last_name,
        customer.company,
        customer.phone,
        customer.email,
        customer.city,
        ...customerVehicles,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [customers, search, vehicles])

  const totalVehicles = vehicles.length
  const activeCustomers = customers.filter(
    (customer) => customer.active !== false,
  ).length
  const openJobs = initialJobs.filter(
    (job) => job.status === "pending" || String(job.status).toLowerCase() === "offen",
  ).length

  const openCustomer = async (customer: Customer) => {
    setError("")
    setSelected(customer)
    setDetailVehicles(
      vehicles.filter((vehicle) => vehicle.customer_id === customer.id),
    )
    setJobs([])
    const result = await getCustomerDetail(customer.id)
    if (result.ok) {
      setDetailVehicles(result.vehicles)
      setJobs(result.jobs)
    } else {
      setError(result.error ?? "Kundendaten konnten nicht geladen werden.")
    }
  }

  const newCustomer = () => {
    setEditingCustomer(null)
    setCustomerForm({ ...emptyCustomer })
    setError("")
    setCustomerModal(true)
  }

  const editCustomer = (customer: Customer) => {
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
    setError("")
    setCustomerModal(true)
  }

  const saveCustomer = async () => {
    setSaving(true)
    setError("")
    const result = editingCustomer
      ? await updateCustomer(editingCustomer.id, customerForm)
      : await createCustomer(customerForm)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "Speichern fehlgeschlagen.")
      return
    }

    const customer = result.customer as Customer
    setCustomers((current) =>
      editingCustomer
        ? current.map((item) => (item.id === customer.id ? customer : item))
        : [customer, ...current],
    )
    setCustomerModal(false)
    if (selected?.id === customer.id) setSelected(customer)
    router.refresh()
  }

  const removeCustomer = async () => {
    if (!selected) return
    if (
      !confirm(
        `Kunde „${fullName(selected)}“ wirklich löschen? Dieser Schritt kann Fahrzeuge und Verknüpfungen betreffen.`,
      )
    ) {
      return
    }

    setDeleting(true)
    const result = await deleteCustomer(selected.id)
    setDeleting(false)

    if (!result.ok) {
      setError(result.error ?? "Kunde konnte nicht gelöscht werden.")
      return
    }

    const customerId = selected.id
    setCustomers((current) => current.filter((customer) => customer.id !== customerId))
    setVehicles((current) =>
      current.filter((vehicle) => vehicle.customer_id !== customerId),
    )
    setSelected(null)
    setDetailVehicles([])
    setJobs([])
    router.refresh()
  }

  const newVehicle = () => {
    if (!selected) return
    setEditingVehicle(null)
    setVehicleForm({ ...emptyVehicle })
    setError("")
    setVehicleModal(true)
  }

  const editVehicle = (vehicle: CustomerVehicle) => {
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
    setVehicleModal(true)
  }

  const saveVehicle = async () => {
    if (!selected) return

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
      : await createCustomerVehicle({ ...payload, customer_id: selected.id })

    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "Fahrzeug konnte nicht gespeichert werden.")
      return
    }

    const vehicle = result.vehicle as CustomerVehicle
    setVehicles((current) =>
      editingVehicle
        ? current.map((item) => (item.id === vehicle.id ? vehicle : item))
        : [vehicle, ...current],
    )
    setDetailVehicles((current) =>
      editingVehicle
        ? current.map((item) => (item.id === vehicle.id ? vehicle : item))
        : [vehicle, ...current],
    )
    setVehicleModal(false)
    router.refresh()
  }

  const removeVehicle = async (vehicle: CustomerVehicle) => {
    if (
      !confirm(
        `Fahrzeug „${vehicle.make} ${vehicle.model} · ${vehicle.license_plate}“ wirklich löschen?`,
      )
    ) {
      return
    }

    setDeleting(true)
    const result = await deleteCustomerVehicle(vehicle.id)
    setDeleting(false)

    if (!result.ok) {
      setError(result.error ?? "Fahrzeug konnte nicht gelöscht werden.")
      return
    }

    setVehicles((current) => current.filter((item) => item.id !== vehicle.id))
    setDetailVehicles((current) =>
      current.filter((item) => item.id !== vehicle.id),
    )
    router.refresh()
  }

  const editJob = (job: CustomerJob) => {
    setEditingJob(job)
    setJobForm({
      work_done: job.work_done ?? "",
      mileage: job.mileage?.toString() ?? "",
      labor_hours: job.labor_hours?.toString() ?? "",
      parts: job.parts ?? "",
      mechanic: job.mechanic ?? "",
      status: job.status ?? "pending",
    })
    setError("")
    setJobModal(true)
  }

  const saveJob = async () => {
    if (!editingJob) return

    setSaving(true)
    setError("")
    const result = await updateCustomerJob(editingJob.id, {
      work_done: jobForm.work_done || null,
      mileage: jobForm.mileage ? Number(jobForm.mileage) : null,
      labor_hours: jobForm.labor_hours ? Number(jobForm.labor_hours) : null,
      parts: jobForm.parts || null,
      mechanic: jobForm.mechanic || null,
      status: jobForm.status,
    })

    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "Auftrag konnte nicht gespeichert werden.")
      return
    }

    const updatedJob = result.job as CustomerJob
    setJobs((current) =>
      current.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
    )
    setJobModal(false)
    router.refresh()
  }

  const statusLabel = (status: string) =>
    status === "confirmed"
      ? "Bestätigt"
      : status === "pending"
        ? "Offen"
        : status === "rejected"
          ? "Abgelehnt"
          : status

  const statusClass = (status: string) =>
    status === "confirmed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "pending"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-slate-700 bg-slate-800/50 text-slate-400"

  return (
    <div className="min-h-screen bg-[#071321] text-slate-100">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sky-300">
              <UsersRound className="h-7 w-7" />
              <h1 className="text-3xl font-bold tracking-tight">Kunden</h1>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Kundenakte, Fahrzeuge und Werkstatt-Historie auf einen Blick.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[390px]">
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-[#10283d] to-[#0b1a2b] p-4 shadow-xl shadow-black/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Kunden
                  </p>
                  <p className="mt-2 text-3xl font-bold text-white">{customers.length}</p>
                  <p className="mt-1 text-xs text-slate-500">{activeCustomers} aktiv</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                  <UsersRound className="h-5 w-5" />
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-[#10283d] to-[#0b1a2b] p-4 shadow-xl shadow-black/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fahrzeuge
                  </p>
                  <p className="mt-2 text-3xl font-bold text-white">{totalVehicles}</p>
                  <p className="mt-1 text-xs text-slate-500">im Kundenstamm</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                  <Car className="h-5 w-5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Werkstattaufträge
            </p>
            <p className="mt-2 text-2xl font-bold">{initialJobs.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Offene Aufträge
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-300">{openJobs}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Aktiver Kunde
            </p>
            <p className="mt-2 truncate text-base font-bold">
              {selected ? fullName(selected) : "Noch keiner"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b1a2b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Historie
            </p>
            <p className="mt-2 text-2xl font-bold text-sky-300">{jobs.length}</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid min-h-[700px] overflow-hidden rounded-2xl border border-slate-800 bg-[#0a1726] shadow-2xl xl:grid-cols-[310px_minmax(400px,0.9fr)_minmax(520px,1.45fr)]">
          <aside className="border-b border-slate-800 bg-[#0b1a2b] xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Kundenstamm
                </p>
                <h2 className="mt-1 text-base font-semibold">Kunden</h2>
              </div>
              <button
                onClick={newCustomer}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                <Plus className="h-4 w-4" />
                Neu
              </button>
            </div>

            <div className="border-b border-slate-800 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kunde oder Kennzeichen suchen..."
                  className="h-10 w-full rounded-lg border border-slate-700 bg-[#101f31] pl-9 pr-3 text-sm outline-none transition focus:border-sky-500"
                />
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto p-2">
              {filtered.map((customer) => {
                const customerVehicles = vehicles.filter(
                  (vehicle) => vehicle.customer_id === customer.id,
                )
                const isSelected = selected?.id === customer.id
                return (
                  <button
                    key={customer.id}
                    onClick={() => openCustomer(customer)}
                    className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-sky-400/60 bg-sky-400/10 shadow-lg shadow-sky-950/20"
                        : "border-transparent bg-[#0e2034] hover:border-slate-700 hover:bg-[#12263b]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                          isSelected
                            ? "bg-sky-400 text-slate-950"
                            : "bg-sky-500/10 text-sky-300"
                        }`}
                      >
                        {initials(customer) || "K"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {fullName(customer)}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {customer.company || customer.email || customer.phone}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
                        {customerVehicles.length} {customerVehicles.length === 1 ? "Auto" : "Autos"}
                      </span>
                    </div>
                  </button>
                )
              })}

              {filtered.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-slate-500">
                  Keine passenden Kunden gefunden.
                </div>
              )}
            </div>
          </aside>

          <section className="border-b border-slate-800 xl:border-b-0 xl:border-r">
            {!selected ? (
              <div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sky-500/10 text-sky-300">
                    <Eye className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold">Kunde auswählen</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Wähle links einen Kunden aus. Danach werden hier seine Kontaktdaten und Fahrzeuge angezeigt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-800 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-500/15 font-bold text-sky-300">
                        {initials(selected) || "K"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Kundenprofil
                        </p>
                        <h2 className="truncate text-xl font-bold text-white">{fullName(selected)}</h2>
                        {selected.company && (
                          <p className="mt-1 truncate text-xs text-slate-400">{selected.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => editCustomer(selected)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500 hover:text-white"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Bearbeiten
                      </button>
                      <button
                        disabled={deleting}
                        onClick={removeCustomer}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Löschen
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-[#0e2034] p-3">
                      <p className="flex items-center gap-2 text-xs text-slate-300">
                        <Phone className="h-3.5 w-3.5 text-sky-300" />
                        {selected.phone || "Keine Telefonnummer"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#0e2034] p-3">
                      <p className="flex items-center gap-2 truncate text-xs text-slate-300">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                        <span className="truncate">{selected.email || "Keine E-Mail"}</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#0e2034] p-3 sm:col-span-2">
                      <p className="flex items-start gap-2 text-xs text-slate-300">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                        <span>
                          {[selected.street, selected.zip, selected.city].filter(Boolean).join(", ") ||
                            "Keine Adresse hinterlegt"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Fuhrpark
                      </p>
                      <h3 className="mt-1 text-base font-semibold">Fahrzeuge</h3>
                    </div>
                    <button
                      onClick={newVehicle}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Fahrzeug hinzufügen
                    </button>
                  </div>

                  <div className="space-y-3">
                    {detailVehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="rounded-xl border border-slate-800 bg-[#0e2034] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
                              <Car className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {vehicle.make} {vehicle.model}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {vehicle.license_plate || "Kein Kennzeichen"}
                                {vehicle.model_year ? ` · ${vehicle.model_year}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editVehicle(vehicle)}
                              className="grid h-8 w-8 place-items-center rounded-md text-sky-300 transition hover:bg-sky-400/10"
                              title="Fahrzeug bearbeiten"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              disabled={deleting}
                              onClick={() => removeVehicle(vehicle)}
                              className="grid h-8 w-8 place-items-center rounded-md text-red-300 transition hover:bg-red-400/10"
                              title="Fahrzeug löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-slate-800 bg-[#0a1929] px-3 py-2">
                            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Kilometerstand</p>
                            <p className="mt-1 text-xs font-medium text-slate-300">
                              {vehicle.mileage != null
                                ? `${vehicle.mileage.toLocaleString("de-CH")} km`
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-800 bg-[#0a1929] px-3 py-2">
                            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">VIN</p>
                            <p className="mt-1 truncate text-xs font-medium text-slate-300">
                              {vehicle.vin || "—"}
                            </p>
                          </div>
                        </div>

                        {vehicle.notes && (
                          <p className="mt-3 rounded-lg border border-slate-800 bg-[#0a1929] px-3 py-2 text-[11px] leading-5 text-slate-500">
                            {vehicle.notes}
                          </p>
                        )}
                      </div>
                    ))}

                    {detailVehicles.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-700 bg-[#0a1929] p-8 text-center">
                        <Car className="mx-auto h-7 w-7 text-slate-600" />
                        <p className="mt-3 text-sm text-slate-500">Noch kein Fahrzeug hinterlegt.</p>
                        <button
                          onClick={newVehicle}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Erstes Fahrzeug hinzufügen
                        </button>
                      </div>
                    )}
                  </div>

                  {selected.notes && (
                    <div className="mt-5 rounded-xl border border-slate-800 bg-[#0e2034] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Notizen</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">{selected.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="min-w-0 bg-[#081522]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Werkstatt
                </p>
                <h2 className="mt-1 text-base font-semibold">Kunden-Historie</h2>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                {selected ? jobs.length : 0} Aufträge
              </span>
            </div>

            {!selected ? (
              <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <Wrench className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-500">
                    Nach der Auswahl eines Kunden wird hier die komplette Werkstatt-Historie angezeigt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-[760px] overflow-y-auto p-4">
                {jobs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-[#0a1929] p-10 text-center">
                    <Clock3 className="mx-auto h-7 w-7 text-slate-600" />
                    <p className="mt-3 text-sm text-slate-500">
                      Für diesen Kunden gibt es noch keine verknüpften Werkstattaufträge.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {jobs.map((job, index) => (
                    <article
                      key={job.id}
                      className="rounded-xl border border-slate-800 bg-[#0e2034] p-4 shadow-lg shadow-black/5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-xs font-bold text-sky-300">
                            {jobs.length - index}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {job.car || "Werkstattauftrag"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {date(job.booking_date)} · {job.booking_time || "—"} Uhr
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(job.status)}`}
                          >
                            {statusLabel(job.status)}
                          </span>
                          <button
                            onClick={() => editJob(job)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-sky-300 transition hover:border-sky-500 hover:bg-sky-400/10"
                            title="Auftrag bearbeiten"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          Problem / Auftrag
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-300">
                          {job.problem || "Keine Beschreibung hinterlegt."}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Durchgeführte Arbeiten</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-300">
                            {job.work_done || "Noch nicht eingetragen"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Kilometerstand</p>
                          <p className="mt-1 text-[11px] text-slate-300">
                            {job.mileage != null ? `${job.mileage.toLocaleString("de-CH")} km` : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Arbeitszeit</p>
                          <p className="mt-1 text-[11px] text-slate-300">
                            {job.labor_hours != null ? `${job.labor_hours} h` : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Mechaniker</p>
                          <p className="mt-1 text-[11px] text-slate-300">{job.mechanic || "—"}</p>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Verwendete Teile</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-300">
                            {job.parts || "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-[#0a1929] p-3">
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">Bilder</p>
                          <p className="mt-1 text-[11px] text-slate-300">
                            {job.image_urls?.length ? `${job.image_urls.length} hinterlegt` : "Keine"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </section>
      </div>

      {customerModal && (
        <Modal
          title={editingCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}
          onClose={() => setCustomerModal(false)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Vorname"
              required
              value={customerForm.first_name}
              onChange={(value) => setCustomerForm({ ...customerForm, first_name: value })}
            />
            <Input
              label="Nachname"
              required
              value={customerForm.last_name}
              onChange={(value) => setCustomerForm({ ...customerForm, last_name: value })}
            />
            <Input
              label="Firma"
              value={customerForm.company}
              onChange={(value) => setCustomerForm({ ...customerForm, company: value })}
            />
            <Input
              label="Telefon"
              required
              value={customerForm.phone}
              onChange={(value) => setCustomerForm({ ...customerForm, phone: value })}
            />
            <div className="sm:col-span-2">
              <Input
                label="E-Mail"
                value={customerForm.email}
                onChange={(value) => setCustomerForm({ ...customerForm, email: value })}
                type="email"
              />
            </div>
            <Input
              label="Strasse"
              value={customerForm.street}
              onChange={(value) => setCustomerForm({ ...customerForm, street: value })}
            />
            <Input
              label="PLZ"
              value={customerForm.zip}
              onChange={(value) => setCustomerForm({ ...customerForm, zip: value })}
            />
            <Input
              label="Ort"
              value={customerForm.city}
              onChange={(value) => setCustomerForm({ ...customerForm, city: value })}
            />
            <div className="sm:col-span-2">
              <TextArea
                label="Notizen"
                value={customerForm.notes}
                onChange={(value) => setCustomerForm({ ...customerForm, notes: value })}
                placeholder="Bemerkungen zum Kunden..."
              />
            </div>
          </div>

          {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setCustomerModal(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            >
              Abbrechen
            </button>
            <button
              disabled={saving}
              onClick={saveCustomer}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </Modal>
      )}

      {vehicleModal && selected && (
        <Modal
          title={editingVehicle ? "Fahrzeug bearbeiten" : "Fahrzeug hinzufügen"}
          onClose={() => setVehicleModal(false)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Marke"
              required
              value={vehicleForm.make}
              onChange={(value) => setVehicleForm({ ...vehicleForm, make: value })}
              placeholder="BMW"
            />
            <Input
              label="Modell"
              required
              value={vehicleForm.model}
              onChange={(value) => setVehicleForm({ ...vehicleForm, model: value })}
              placeholder="335i"
            />
            <Input
              label="Kennzeichen"
              required
              value={vehicleForm.license_plate}
              onChange={(value) => setVehicleForm({ ...vehicleForm, license_plate: value })}
              placeholder="LU 123456"
            />
            <Input
              label="Jahrgang"
              value={vehicleForm.model_year}
              onChange={(value) => setVehicleForm({ ...vehicleForm, model_year: value })}
              type="number"
            />
            <Input
              label="Kilometerstand"
              value={vehicleForm.mileage}
              onChange={(value) => setVehicleForm({ ...vehicleForm, mileage: value })}
              type="number"
            />
            <Input
              label="VIN / Fahrgestellnummer"
              value={vehicleForm.vin}
              onChange={(value) => setVehicleForm({ ...vehicleForm, vin: value })}
            />
            <div className="sm:col-span-2">
              <TextArea
                label="Fahrzeug-Notizen"
                value={vehicleForm.notes}
                onChange={(value) => setVehicleForm({ ...vehicleForm, notes: value })}
                placeholder="z. B. Sommerreifen, bekannte Mängel..."
                rows={3}
              />
            </div>
          </div>

          {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setVehicleModal(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            >
              Abbrechen
            </button>
            <button
              disabled={saving}
              onClick={saveVehicle}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </Modal>
      )}

      {jobModal && editingJob && (
        <Modal
          title="Werkstattauftrag bearbeiten"
          onClose={() => setJobModal(false)}
          wide
        >
          <div className="mb-4 rounded-xl border border-slate-800 bg-[#0e2034] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Auftrag</p>
                <p className="mt-1 text-sm font-semibold">
                  {editingJob.car || "Werkstattauftrag"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {date(editingJob.booking_date)} · {editingJob.booking_time || "—"} Uhr
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${statusClass(jobForm.status)}`}
              >
                {statusLabel(jobForm.status)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextArea
                label="Durchgeführte Arbeiten"
                value={jobForm.work_done}
                onChange={(value) => setJobForm({ ...jobForm, work_done: value })}
                placeholder="Was wurde am Fahrzeug gemacht?"
                rows={5}
              />
            </div>
            <Input
              label="Kilometerstand"
              value={jobForm.mileage}
              onChange={(value) => setJobForm({ ...jobForm, mileage: value })}
              type="number"
              placeholder="125430"
            />
            <Input
              label="Arbeitszeit (Stunden)"
              value={jobForm.labor_hours}
              onChange={(value) => setJobForm({ ...jobForm, labor_hours: value })}
              type="number"
              placeholder="2.5"
            />
            <Input
              label="Mechaniker"
              value={jobForm.mechanic}
              onChange={(value) => setJobForm({ ...jobForm, mechanic: value })}
              placeholder="Mohamedali Brahim"
            />
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Status
              </span>
              <select
                value={jobForm.status}
                onChange={(event) =>
                  setJobForm({ ...jobForm, status: event.target.value })
                }
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="pending">Offen</option>
                <option value="confirmed">Bestätigt</option>
                <option value="rejected">Abgelehnt</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <TextArea
                label="Verwendete Teile / Material"
                value={jobForm.parts}
                onChange={(value) => setJobForm({ ...jobForm, parts: value })}
                placeholder="z. B. Ölfilter, 5W-30, Bremsbeläge..."
                rows={4}
              />
            </div>
          </div>

          {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setJobModal(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            >
              Abbrechen
            </button>
            <button
              disabled={saving}
              onClick={saveJob}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {saving ? "Speichern..." : "Auftrag speichern"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
