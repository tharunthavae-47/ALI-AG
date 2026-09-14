"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type Credit = {
  supplier_name: string | null
  remaining_amount: number | null
  status: string | null
}

export function SupplierCreditBalance() {
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase
        .from("supplier_credits")
        .select("supplier_name,remaining_amount,status")
        .eq("status", "offen")

      if (active) {
        setCredits((data as Credit[]) ?? [])
        setLoading(false)
      }
    }

    void load()

    const channel = supabase
      .channel("owner-supplier-credit-balance")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplier_credits" },
        () => { void load() },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  const balances = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const credit of credits) {
      const name = credit.supplier_name?.trim() || "Unbekannter Lieferant"
      grouped.set(name, (grouped.get(name) ?? 0) + Math.max(0, Number(credit.remaining_amount) || 0))
    }
    return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])
  }, [credits])

  const total = balances.reduce((sum, [, amount]) => sum + amount, 0)

  return (
    <section className="mb-10 border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Unternehmens-Guthaben</p>
          <h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">Aktuelles verfügbares Guthaben</h3>
          <p className="mt-2 text-sm text-muted-foreground">Synchronisiert direkt mit den noch verfügbaren Guthaben aus der Lieferantenansicht.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Gesamt verfügbar</p>
          <p className="mt-1 text-3xl font-bold">CHF {total.toFixed(2)}</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Guthaben wird geladen...</p>
      ) : balances.length === 0 ? (
        <p className="mt-6 border border-border p-4 text-sm text-muted-foreground">Aktuell ist kein verfügbares Lieferanten-Guthaben vorhanden.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map(([name, amount]) => (
            <div key={name} className="border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{name}</p>
              <p className="mt-2 text-xl font-bold">CHF {amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
