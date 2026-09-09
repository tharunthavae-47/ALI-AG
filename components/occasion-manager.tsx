"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Status = "offen" | "in_pruefung" | "angebot" | "verkauft" | "abgelehnt"

type OccasionRequest = {
  id: string
  created_at: string
  vorname: string
  nachname: string
  email: string
  telefon: string
  privat_oder_firma: string
  marke: string
  modell: string
  jahrgang: number
  kilometer: number
  treibstoff: string
  getriebe: string
  leistung: string
  antrieb: string
  tueren: string
  fahrzeugfarbe: string
  zustand: string
  unfallschaden: string
  letzter_service: string | null
  mfk: string | null
  beschreibung: string
  preisvorstellung: number
  status: Status
}

type OccasionImage = {
  id: string
  occasion_request_id: string
  image_url: string
  image_name: string | null
  image_position: number
  signedUrl?: string
}

type OccasionWithImages = OccasionRequest & { images: OccasionImage[] }

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "offen", label: "Offen" },
  { value: "in_pruefung", label: "In Prüfung" },
  { value: "angebot", label: "Angebot" },
  { value: "verkauft", label: "Verkauft" },
  { value: "abgelehnt", label: "Abgelehnt" },
]

const EDIT_FIELDS: { key: keyof OccasionRequest; label: string; type?: string }[] = [
  { key: "marke", label: "Marke" },
  { key: "modell", label: "Modell" },
  { key: "jahrgang", label: "Jahrgang", type: "number" },
  { key: "kilometer", label: "Kilometer", type: "number" },
  { key: "treibstoff", label: "Treibstoff" },
  { key: "getriebe", label: "Getriebe" },
  { key: "leistung", label: "Leistung" },
  { key: "antrieb", label: "Antrieb" },
  { key: "tueren", label: "Türen" },
  { key: "fahrzeugfarbe", label: "Fahrzeugfarbe" },
  { key: "zustand", label: "Zustand" },
  { key: "unfallschaden", label: "Unfallschaden" },
  { key: "letzter_service", label: "Letzter Service" },
  { key: "mfk", label: "MFK" },
  { key: "preisvorstellung", label: "Preisvorstellung CHF", type: "number" },
]

export function OccasionManager() {
  const supabase = createClient()
  const [requests, setRequests] = useState<OccasionWithImages[]>([])
  const [selected, setSelected] = useState<OccasionWithImages | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [draft, setDraft] = useState<OccasionRequest | null>(null)

  useEffect(() => { loadOccasions() }, [])

  async function loadOccasions() {
    setLoading(true)
    setError("")
    try {
      const [{ data: occasionData, error: occasionError }, { data: imageData, error: imageError }] = await Promise.all([
        supabase.from("occasion_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("occasion_images").select("*").order("image_position", { ascending: true }),
      ])
      if (occasionError) throw new Error(occasionError.message)
      if (imageError) throw new Error(imageError.message)

      const imagesWithUrls = await Promise.all((imageData || []).map(async (image) => {
        const { data } = await supabase.storage.from("occasion-images").createSignedUrl(image.image_url, 60 * 60)
        return { ...image, signedUrl: data?.signedUrl } as OccasionImage
      }))

      const combined = (occasionData || []).map((request) => ({
        ...request,
        images: imagesWithUrls.filter((image) => image.occasion_request_id === request.id),
      })) as OccasionWithImages[]

      setRequests(combined)
      if (selected) {
        const fresh = combined.find((item) => item.id === selected.id)
        if (fresh) {
          setSelected(fresh)
          setDraft({ ...fresh })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Occasion-Daten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  function openDetails(request: OccasionWithImages) {
    setSelected(request)
    setDraft({ ...request })
    setMessage("")
    setError("")
  }

  function closeDetails() {
    setSelected(null)
    setDraft(null)
    setMessage("")
  }

  function updateDraft(key: keyof OccasionRequest, value: string) {
    setDraft((current) => {
      if (!current) return current
      const numeric = key === "jahrgang" || key === "kilometer" || key === "preisvorstellung"
      return { ...current, [key]: numeric ? (value === "" ? 0 : Number(value)) : value }
    })
  }

  async function saveChanges() {
    if (!draft || !selected) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const payload = {
        vorname: draft.vorname,
        nachname: draft.nachname,
        email: draft.email,
        telefon: draft.telefon,
        privat_oder_firma: draft.privat_oder_firma,
        marke: draft.marke,
        modell: draft.modell,
        jahrgang: Number(draft.jahrgang),
        kilometer: Number(draft.kilometer),
        treibstoff: draft.treibstoff,
        getriebe: draft.getriebe,
        leistung: draft.leistung,
        antrieb: draft.antrieb,
        tueren: draft.tueren,
        fahrzeugfarbe: draft.fahrzeugfarbe,
        zustand: draft.zustand,
        unfallschaden: draft.unfallschaden,
        letzter_service: draft.letzter_service || null,
        mfk: draft.mfk || null,
        beschreibung: draft.beschreibung,
        preisvorstellung: Number(draft.preisvorstellung),
        status: draft.status,
      }
      const { error: updateError } = await supabase.from("occasion_requests").update(payload).eq("id", selected.id)
      if (updateError) throw new Error(updateError.message)
      await loadOccasions()
      setMessage("Fahrzeugdaten wurden gespeichert.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Änderungen konnten nicht gespeichert werden.")
    } finally {
      setSaving(false)
    }
  }

  async function addImages(files: FileList | null) {
    if (!selected || !files?.length) return
    const available = 10 - selected.images.length
    const selectedFiles = Array.from(files).slice(0, available)
    if (!selectedFiles.length) {
      setError("Maximal 10 Fotos pro Fahrzeug sind möglich.")
      return
    }

    setUploading(true)
    setError("")
    setMessage("")
    try {
      let position = Math.max(0, ...selected.images.map((image) => image.image_position)) + 1
      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) continue
        if (file.size > 10 * 1024 * 1024) throw new Error(`Das Bild ${file.name} ist grösser als 10 MB.`)
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `${selected.id}/${position}-${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from("occasion-images").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })
        if (uploadError) throw new Error(uploadError.message)
        const { error: insertError } = await supabase.from("occasion_images").insert({
          occasion_request_id: selected.id,
          image_url: path,
          image_name: file.name,
          image_position: position,
        })
        if (insertError) {
          await supabase.storage.from("occasion-images").remove([path])
          throw new Error(insertError.message)
        }
        position += 1
      }
      await loadOccasions()
      setMessage("Neue Fotos wurden hinzugefügt.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fotos konnten nicht hinzugefügt werden.")
    } finally {
      setUploading(false)
    }
  }

  async function deleteImage(image: OccasionImage) {
    if (!selected) return
    if (!window.confirm("Dieses Fahrzeugfoto wirklich löschen?")) return
    setDeletingImageId(image.id)
    setError("")
    setMessage("")
    try {
      const { error: storageError } = await supabase.storage.from("occasion-images").remove([image.image_url])
      if (storageError) throw new Error(storageError.message)
      const { error: dbError } = await supabase.from("occasion_images").delete().eq("id", image.id)
      if (dbError) throw new Error(dbError.message)
      await loadOccasions()
      setMessage("Foto wurde gelöscht.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto konnte nicht gelöscht werden.")
    } finally {
      setDeletingImageId(null)
    }
  }

  async function deleteOccasion(request: OccasionWithImages) {
    if (!window.confirm(`Möchtest du die Occasion-Anfrage von ${request.vorname} ${request.nachname} wirklich löschen?`)) return
    setDeletingId(request.id)
    setError("")
    try {
      const paths = request.images.map((image) => image.image_url).filter(Boolean)
      if (paths.length) await supabase.storage.from("occasion-images").remove(paths)
      const { error: deleteError } = await supabase.from("occasion_requests").delete().eq("id", request.id)
      if (deleteError) throw new Error(deleteError.message)
      closeDetails()
      await loadOccasions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage konnte nicht gelöscht werden.")
    } finally {
      setDeletingId(null)
    }
  }

  const selectedImages = useMemo(() => selected?.images || [], [selected])

  if (loading) return <section className="mt-10 rounded-3xl border border-white/10 bg-zinc-950 p-8 text-sm text-zinc-400">Occasion-Anfragen werden geladen...</section>

  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Occasion</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Fahrzeuganfragen</h2>
          <p className="mt-2 text-sm text-zinc-500">Eingereichte Fahrzeuge zum Ankauf bearbeiten und verwalten.</p>
        </div>
        <button onClick={loadOccasions} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white hover:text-black">Aktualisieren</button>
      </div>

      {error && <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>}

      {requests.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-12 text-center text-zinc-500">Noch keine Occasion-Anfragen.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {requests.map((request) => (
            <div key={request.id} className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
              <div className="relative aspect-[16/9] bg-black">
                {request.images[0]?.signedUrl ? <img src={request.images[0].signedUrl} alt={`${request.marke} ${request.modell}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">🚗</div>}
                <span className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-xs text-white">{statusLabel(request.status)}</span>
                <span className="absolute bottom-4 right-4 rounded-full bg-black/80 px-3 py-1 text-xs text-white">{request.images.length}/10 Fotos</span>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{request.jahrgang}</p><h3 className="mt-1 text-2xl font-bold text-white">{request.marke} {request.modell}</h3></div>
                  <p className="font-semibold text-white">CHF {Number(request.preisvorstellung).toLocaleString("de-CH")}</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-zinc-400">
                  <Info label="Kilometer" value={`${Number(request.kilometer).toLocaleString("de-CH")} km`} />
                  <Info label="Leistung" value={request.leistung} />
                  <Info label="Treibstoff" value={request.treibstoff} />
                  <Info label="Getriebe" value={request.getriebe} />
                </div>
                <button onClick={() => openDetails(request)} className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200">Anfrage bearbeiten</button>
                <button onClick={() => deleteOccasion(request)} disabled={deletingId === request.id} className="mt-3 w-full rounded-xl border border-red-500/20 px-4 py-3 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">{deletingId === request.id ? "Wird gelöscht..." : "Anfrage löschen"}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && draft && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 p-4 backdrop-blur-md md:p-8">
          <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-6 py-5 backdrop-blur md:px-10">
              <div><p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Occasion Anfrage bearbeiten</p><h2 className="mt-1 text-xl font-bold text-white md:text-2xl">{draft.marke} {draft.modell}</h2></div>
              <button onClick={closeDetails} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white hover:bg-white hover:text-black">×</button>
            </div>

            <div className="p-6 md:p-10">
              {message && <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">{message}</div>}
              {error && <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>}

              <div className="rounded-2xl border border-white/10 bg-black p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div><h3 className="text-lg font-semibold text-white">Fahrzeugfotos</h3><p className="mt-1 text-xs text-zinc-500">Fotos löschen oder neue hinzufügen · maximal 10</p></div>
                  <label className="cursor-pointer rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black hover:bg-zinc-200">
                    {uploading ? "Wird hochgeladen..." : "+ Fotos hinzufügen"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploading || selectedImages.length >= 10} onChange={(e) => { addImages(e.target.files); e.currentTarget.value = "" }} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {selectedImages.map((image, index) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                      {image.signedUrl ? <img src={image.signedUrl} alt={image.image_name || `Fahrzeugfoto ${index + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-zinc-600">Bild nicht verfügbar</div>}
                      <span className="absolute left-2 top-2 rounded-full bg-black/80 px-2 py-1 text-[10px] text-white">{index + 1}</span>
                      <button onClick={() => deleteImage(image)} disabled={deletingImageId === image.id} className="absolute right-2 top-2 rounded-full bg-red-600/90 px-2.5 py-1.5 text-[10px] font-semibold text-white opacity-100 hover:bg-red-500 disabled:opacity-50">{deletingImageId === image.id ? "…" : "Löschen"}</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black p-6">
                  <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">Kundendaten</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Vorname" value={draft.vorname} onChange={(v) => updateDraft("vorname", v)} />
                    <Input label="Nachname" value={draft.nachname} onChange={(v) => updateDraft("nachname", v)} />
                    <Input label="E-Mail" value={draft.email} onChange={(v) => updateDraft("email", v)} />
                    <Input label="Telefon" value={draft.telefon} onChange={(v) => updateDraft("telefon", v)} />
                    <Input label="Privat / Firma" value={draft.privat_oder_firma} onChange={(v) => updateDraft("privat_oder_firma", v)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black p-6">
                  <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">Fahrzeugdaten</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {EDIT_FIELDS.map((field) => <Input key={String(field.key)} label={field.label} type={field.type} value={draft[field.key] == null ? "" : String(draft[field.key])} onChange={(v) => updateDraft(field.key, v)} />)}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">Beschreibung</h3>
                <textarea value={draft.beschreibung} onChange={(e) => updateDraft("beschreibung", e.target.value)} rows={6} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-white/30" />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">Status</h3>
                <select value={draft.status} onChange={(e) => updateDraft("status", e.target.value)} className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none">
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:justify-end">
                <button onClick={closeDetails} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-300 hover:bg-white hover:text-black">Abbrechen</button>
                <button onClick={saveChanges} disabled={saving} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">{saving ? "Wird gespeichert..." : "Änderungen speichern"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-2 block text-xs text-zinc-500">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-white/30" /></label>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/5 bg-black p-3"><p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-300">{value || "—"}</p></div>
}

function statusLabel(status: Status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status
}
