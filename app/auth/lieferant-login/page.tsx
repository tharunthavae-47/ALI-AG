"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function LieferantLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError || !data.session) {
        setError("E-Mail oder Passwort ist ungültig.")
        return
      }

      const { data: access } = await supabase
        .from("supplier_access")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle()

      if (!access) {
        await supabase.auth.signOut()
        setError("Dieses Konto ist nicht als Lieferantenkonto freigeschaltet.")
        return
      }

      router.replace("/lieferant")
      router.refresh()
    } catch {
      setError("Beim Anmelden ist ein Fehler aufgetreten.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl font-bold tracking-[0.2em] text-foreground">
          MB Performance
        </Link>
        <h1 className="mt-8 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Lieferanten-Login
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Separater Zugang für Lieferanten. Lieferanten sehen nur ihre eigenen Lieferungen.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block">
            <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">E-Mail</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={loading} className="mt-2 w-full border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-ring disabled:opacity-50" />
          </label>
          <label className="block">
            <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Passwort</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={loading} className="mt-2 w-full border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-ring disabled:opacity-50" />
          </label>
          {error && <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
          <button type="submit" disabled={loading || !email.trim() || !password} className="w-full bg-primary px-6 py-3 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Anmelden..." : "Anmelden"}
          </button>
        </form>

        <Link href="/auth/login" className="mt-6 block text-sm text-muted-foreground hover:text-foreground">
          → Zum Besitzer-Login
        </Link>
        <Link href="/" className="mt-4 block text-sm text-muted-foreground hover:text-foreground">
          ← Zurück zur Website
        </Link>
      </div>
    </main>
  )
}
