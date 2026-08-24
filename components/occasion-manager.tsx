"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

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

  status:
    | "offen"
    | "in_pruefung"
    | "angebot"
    | "verkauft"
    | "abgelehnt"
}

type OccasionImage = {
  id: string
  occasion_request_id: string
  image_url: string
  image_name: string | null
  image_position: number
  signedUrl?: string
}

type OccasionWithImages = OccasionRequest & {
  images: OccasionImage[]
}

const STATUS_OPTIONS = [
  {
    value: "offen",
    label: "Offen",
  },
  {
    value: "in_pruefung",
    label: "In Prüfung",
  },
  {
    value: "angebot",
    label: "Angebot",
  },
  {
    value: "verkauft",
    label: "Verkauft",
  },
  {
    value: "abgelehnt",
    label: "Abgelehnt",
  },
]

export function OccasionManager() {
  const supabase = createClient()

  const [requests, setRequests] = useState<
    OccasionWithImages[]
  >([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [selected, setSelected] =
    useState<OccasionWithImages | null>(null)

  const [updatingId, setUpdatingId] =
    useState<string | null>(null)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  useEffect(() => {
    loadOccasions()
  }, [])

  async function loadOccasions() {
    setLoading(true)
    setError("")

    try {
      /*
       * ============================================
       * OCCASION-ANFRAGEN LADEN
       * ============================================
       */

      const {
        data: occasionData,
        error: occasionError,
      } = await supabase
        .from("occasion_requests")
        .select("*")
        .order("created_at", {
          ascending: false,
        })

      if (occasionError) {
        throw new Error(
          `Occasion-Anfragen konnten nicht geladen werden: ${occasionError.message}`
        )
      }

      /*
       * ============================================
       * FOTOS LADEN
       * ============================================
       */

      const {
        data: imageData,
        error: imageError,
      } = await supabase
        .from("occasion_images")
        .select("*")
        .order("image_position", {
          ascending: true,
        })

      if (imageError) {
        throw new Error(
          `Occasion-Fotos konnten nicht geladen werden: ${imageError.message}`
        )
      }

      /*
       * ============================================
       * SIGNED URLS ERSTELLEN
       * ============================================
       */

      const imagesWithUrls: OccasionImage[] = []

      for (const image of imageData || []) {
        const {
          data: signedData,
          error: signedError,
        } = await supabase.storage
          .from("occasion-images")
          .createSignedUrl(
            image.image_url,
            60 * 60
          )

        if (signedError) {
          console.error(
            "Signed URL Fehler:",
            signedError
          )

          imagesWithUrls.push({
            ...image,
          })
        } else {
          imagesWithUrls.push({
            ...image,
            signedUrl:
              signedData?.signedUrl,
          })
        }
      }

      /*
       * ============================================
       * ANFRAGEN + FOTOS VERBINDEN
       * ============================================
       */

      const combined: OccasionWithImages[] =
        (occasionData || []).map((request) => ({
          ...request,
          images: imagesWithUrls
            .filter(
              (image) =>
                image.occasion_request_id ===
                request.id
            )
            .sort(
              (a, b) =>
                a.image_position -
                b.image_position
            ),
        }))

      setRequests(combined)

      /*
       * Falls gerade ein Datensatz geöffnet ist,
       * diesen ebenfalls aktualisieren.
       */

      if (selected) {
        const updatedSelected =
          combined.find(
            (item) => item.id === selected.id
          )

        if (updatedSelected) {
          setSelected(updatedSelected)
        }
      }
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : "Occasion-Daten konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * ============================================
   * STATUS ÄNDERN
   * ============================================
   */

  async function updateStatus(
    id: string,
    status: OccasionRequest["status"]
  ) {
    setUpdatingId(id)
    setError("")

    try {
      const {
        error: updateError,
      } = await supabase
        .from("occasion_requests")
        .update({
          status,
        })
        .eq("id", id)

      if (updateError) {
        throw new Error(
          `Status konnte nicht geändert werden: ${updateError.message}`
        )
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
              }
            : item
        )
      )

      if (selected?.id === id) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                status,
              }
            : null
        )
      }
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : "Status konnte nicht geändert werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  /*
   * ============================================
   * ANFRAGE LÖSCHEN
   * ============================================
   */

  async function deleteOccasion(
    request: OccasionWithImages
  ) {
    const confirmed = window.confirm(
      `Möchtest du die Occasion-Anfrage von ${request.vorname} ${request.nachname} wirklich löschen?`
    )

    if (!confirmed) return

    setDeletingId(request.id)
    setError("")

    try {
      /*
       * Zuerst Storage-Dateien löschen
       */

      const paths = request.images
        .map((image) => image.image_url)
        .filter(Boolean)

      if (paths.length > 0) {
        const {
          error: storageError,
        } = await supabase.storage
          .from("occasion-images")
          .remove(paths)

        if (storageError) {
          console.error(
            "Storage-Löschung:",
            storageError
          )
        }
      }

      /*
       * Danach Datenbankeintrag löschen.
       *
       * occasion_images wird durch
       * ON DELETE CASCADE automatisch gelöscht.
       */

      const {
        error: deleteError,
      } = await supabase
        .from("occasion_requests")
        .delete()
        .eq("id", request.id)

      if (deleteError) {
        throw new Error(
          `Anfrage konnte nicht gelöscht werden: ${deleteError.message}`
        )
      }

      setRequests((prev) =>
        prev.filter(
          (item) => item.id !== request.id
        )
      )

      if (selected?.id === request.id) {
        setSelected(null)
      }
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : "Anfrage konnte nicht gelöscht werden."
      )
    } finally {
      setDeletingId(null)
    }
  }

  /*
   * ============================================
   * LOADING
   * ============================================
   */

  if (loading) {
    return (
      <section className="mt-10 rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <div className="flex items-center gap-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="text-sm text-zinc-400">
            Occasion-Anfragen werden geladen...
          </p>
        </div>
      </section>
    )
  }

  /*
   * ============================================
   * HAUPTANSICHT
   * ============================================
   */

  return (
    <section className="mt-10">
      {/* Header */}

      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Occasion
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Fahrzeuganfragen
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Eingereichte Fahrzeuge zum Ankauf
          </p>
        </div>

        <button
          type="button"
          onClick={loadOccasions}
          className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white hover:text-black"
        >
          Aktualisieren
        </button>
      </div>

      {/* Fehler */}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Keine Anfragen */}

      {requests.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-12 text-center">
          <div className="text-4xl">
            🚗
          </div>

          <h3 className="mt-5 text-xl font-semibold text-white">
            Noch keine Occasion-Anfragen
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Sobald ein Kunde ein Fahrzeug anbietet,
            erscheint es hier.
          </p>
        </div>
      ) : (
        <>
          {/* Karten */}

          <div className="grid gap-5 lg:grid-cols-2">
            {requests.map((request) => (
              <OccasionCard
                key={request.id}
                request={request}
                onOpen={() =>
                  setSelected(request)
                }
                onStatusChange={updateStatus}
                onDelete={deleteOccasion}
                updating={
                  updatingId === request.id
                }
                deleting={
                  deletingId === request.id
                }
              />
            ))}
          </div>

          {/* Details */}

          {selected && (
            <OccasionDetails
              request={selected}
              onClose={() =>
                setSelected(null)
              }
              onStatusChange={updateStatus}
              onDelete={deleteOccasion}
              updating={
                updatingId === selected.id
              }
              deleting={
                deletingId === selected.id
              }
            />
          )}
        </>
      )}
    </section>
  )
}

/*
 * ============================================
 * OCCASION CARD
 * ============================================
 */

function OccasionCard({
  request,
  onOpen,
  onStatusChange,
  onDelete,
  updating,
  deleting,
}: {
  request: OccasionWithImages
  onOpen: () => void
  onStatusChange: (
    id: string,
    status: OccasionRequest["status"]
  ) => void
  onDelete: (
    request: OccasionWithImages
  ) => void
  updating: boolean
  deleting: boolean
}) {
  const firstImage =
    request.images[0]?.signedUrl

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
      {/* Bild */}

      <div className="relative aspect-[16/9] bg-black">
        {firstImage ? (
          <img
            src={firstImage}
            alt={`${request.marke} ${request.modell}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">
            🚗
          </div>
        )}

        <div className="absolute left-4 top-4">
          <StatusBadge status={request.status} />
        </div>

        <div className="absolute bottom-4 right-4 rounded-full bg-black/80 px-3 py-1 text-xs text-white backdrop-blur">
          {request.images.length}/10 Fotos
        </div>
      </div>

      {/* Inhalt */}

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {request.jahrgang}
            </p>

            <h3 className="mt-1 text-2xl font-bold text-white">
              {request.marke} {request.modell}
            </h3>
          </div>

          <div className="text-right">
            <p className="text-xs text-zinc-600">
              Preisvorstellung
            </p>

            <p className="mt-1 font-semibold text-white">
              CHF{" "}
              {Number(
                request.preisvorstellung
              ).toLocaleString("de-CH")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info
            label="Kilometer"
            value={`${Number(
              request.kilometer
            ).toLocaleString("de-CH")} km`}
          />

          <Info
            label="Leistung"
            value={request.leistung}
          />

          <Info
            label="Treibstoff"
            value={request.treibstoff}
          />

          <Info
            label="Getriebe"
            value={request.getriebe}
          />
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-sm font-medium text-white">
            {request.vorname}{" "}
            {request.nachname}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {request.email}
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {request.telefon}
          </p>
        </div>

        {/* Buttons */}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Details ansehen
          </button>

          <select
            value={request.status}
            disabled={updating}
            onChange={(e) =>
              onStatusChange(
                request.id,
                e.target.value as OccasionRequest["status"]
              )
            }
            className="rounded-xl border border-white/10 bg-black px-3 text-xs text-white outline-none"
          >
            {STATUS_OPTIONS.map(
              (status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            onDelete(request)
          }
          disabled={deleting}
          className="mt-3 w-full rounded-xl border border-red-500/20 px-4 py-3 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          {deleting
            ? "Wird gelöscht..."
            : "Anfrage löschen"}
        </button>
      </div>
    </div>
  )
}

/*
 * ============================================
 * DETAILS
 * ============================================
 */

function OccasionDetails({
  request,
  onClose,
  onStatusChange,
  onDelete,
  updating,
  deleting,
}: {
  request: OccasionWithImages
  onClose: () => void
  onStatusChange: (
    id: string,
    status: OccasionRequest["status"]
  ) => void
  onDelete: (
    request: OccasionWithImages
  ) => void
  updating: boolean
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 p-4 backdrop-blur-md md:p-10">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Header */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-6 py-5 backdrop-blur md:px-10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Occasion Anfrage
            </p>

            <h2 className="mt-1 text-xl font-bold text-white md:text-2xl">
              {request.marke}{" "}
              {request.modell}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white hover:text-black"
          >
            ×
          </button>
        </div>

        <div className="p-6 md:p-10">
          {/* Fotos */}

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Fahrzeugfotos
              </h3>

              <span className="text-xs text-zinc-500">
                {request.images.length}/10
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {request.images.map(
                (image, index) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black"
                  >
                    {image.signedUrl ? (
                      <a
                        href={image.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={image.signedUrl}
                          alt={
                            image.image_name ||
                            `Fahrzeugfoto ${
                              index + 1
                            }`
                          }
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      </a>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                        Bild nicht verfügbar
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-1 text-[10px] text-white">
                      {index + 1}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Daten */}

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Kundendaten */}

            <DetailBox title="Kundendaten">
              <DetailRow
                label="Name"
                value={`${request.vorname} ${request.nachname}`}
              />

              <DetailRow
                label="E-Mail"
                value={request.email}
              />

              <DetailRow
                label="Telefon"
                value={request.telefon}
              />

              <DetailRow
                label="Typ"
                value={
                  request.privat_oder_firma
                }
              />
            </DetailBox>

            {/* Fahrzeug */}

            <DetailBox title="Fahrzeug">
              <DetailRow
                label="Marke"
                value={request.marke}
              />

              <DetailRow
                label="Modell"
                value={request.modell}
              />

              <DetailRow
                label="Jahrgang"
                value={String(
                  request.jahrgang
                )}
              />

              <DetailRow
                label="Kilometer"
                value={`${Number(
                  request.kilometer
                ).toLocaleString("de-CH")} km`}
              />

              <DetailRow
                label="Treibstoff"
                value={request.treibstoff}
              />

              <DetailRow
                label="Getriebe"
                value={request.getriebe}
              />

              <DetailRow
                label="Leistung"
                value={request.leistung}
              />

              <DetailRow
                label="Antrieb"
                value={request.antrieb}
              />

              <DetailRow
                label="Türen"
                value={request.tueren}
              />

              <DetailRow
                label="Farbe"
                value={request.fahrzeugfarbe}
              />
            </DetailBox>

            {/* Zustand */}

            <DetailBox title="Zustand & Historie">
              <DetailRow
                label="Zustand"
                value={request.zustand}
              />

              <DetailRow
                label="Unfall"
                value={
                  request.unfallschaden
                }
              />

              <DetailRow
                label="Letzter Service"
                value={
                  request.letzter_service ||
                  "Keine Angabe"
                }
              />

              <DetailRow
                label="MFK"
                value={
                  request.mfk ||
                  "Keine Angabe"
                }
              />
            </DetailBox>

            {/* Preis */}

            <DetailBox title="Preis">
              <DetailRow
                label="Preisvorstellung"
                value={`CHF ${Number(
                  request.preisvorstellung
                ).toLocaleString("de-CH")}`}
              />

              <DetailRow
                label="Status"
                value={
                  getStatusLabel(
                    request.status
                  )
                }
              />

              <DetailRow
                label="Eingereicht"
                value={new Date(
                  request.created_at
                ).toLocaleString("de-CH")}
              />
            </DetailBox>
          </div>

          {/* Beschreibung */}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Beschreibung
            </h3>

            <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
              {request.beschreibung}
            </p>
          </div>

          {/* Aktionen */}

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row">
            <select
              value={request.status}
              disabled={updating}
              onChange={(e) =>
                onStatusChange(
                  request.id,
                  e.target.value as OccasionRequest["status"]
                )
              }
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none"
            >
              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={() =>
                onDelete(request)
              }
              disabled={deleting}
              className="rounded-xl border border-red-500/20 px-5 py-3 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleting
                ? "Wird gelöscht..."
                : "Anfrage löschen"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-300 transition hover:bg-white hover:text-black"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * ============================================
 * INFO
 * ============================================
 */

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black p-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-sm text-zinc-300">
        {value}
      </p>
    </div>
  )
}

/*
 * ============================================
 * DETAIL BOX
 * ============================================
 */

function DetailBox({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-6">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </h3>

      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

/*
 * ============================================
 * DETAIL ROW
 * ============================================
 */

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-zinc-600">
        {label}
      </span>

      <span className="text-right text-zinc-300">
        {value}
      </span>
    </div>
  )
}

/*
 * ============================================
 * STATUS BADGE
 * ============================================
 */

function StatusBadge({
  status,
}: {
  status: OccasionRequest["status"]
}) {
  return (
    <span className="rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
      {getStatusLabel(status)}
    </span>
  )
}

/*
 * ============================================
 * STATUS LABEL
 * ============================================
 */

function getStatusLabel(
  status: OccasionRequest["status"]
) {
  switch (status) {
    case "offen":
      return "Offen"

    case "in_pruefung":
      return "In Prüfung"

    case "angebot":
      return "Angebot"

    case "verkauft":
      return "Verkauft"

    case "abgelehnt":
      return "Abgelehnt"

    default:
      return status
  }
}
