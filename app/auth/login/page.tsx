"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      // Genericize the credential signal to avoid account enumeration.
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setError("Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.")
      } else {
        setError("E-Mail oder Passwort ist ungültig.")
      }
      return
    }
    router.push("/besitzer")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-[0.2em] text-foreground"
        >
          ALI-AG
        </Link>
        <h1 className="mt-8 font-display text-2xl font-bold uppercase tracking-wide text-foreground">Besitzer-Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">Melden Sie sich an, um Terminanfragen zu verwalten.</p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block">
            <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">E-Mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-2 w-full border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-2 w-full border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-ring"
            />
          </label>

          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary px-6 py-3 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link href="/auth/sign-up" className="text-foreground underline underline-offset-4">
            Registrieren
          </Link>
        </p>
      </div>
    </main>
  )
}
