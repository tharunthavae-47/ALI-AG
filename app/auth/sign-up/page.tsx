"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes("password")) {
        setError("Das Passwort ist zu schwach. Bitte mindestens 6 Zeichen verwenden.")
      } else if (error.message.toLowerCase().includes("rate")) {
        setError("Zu viele Versuche. Bitte versuchen Sie es später erneut.")
      } else {
        setError("Registrierung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.")
      }
      return
    }
    router.push("/auth/sign-up-success")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl font-bold tracking-[0.2em] text-foreground">
          ALI-AG
        </Link>
        <h1 className="mt-8 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Besitzer-Konto erstellen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Registrieren Sie das Konto für die Terminverwaltung.</p>

        <form onSubmit={handleSignUp} className="mt-8 space-y-5">
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
              autoComplete="new-password"
              minLength={6}
              className="mt-2 w-full border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-ring"
            />
          </label>

          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary px-6 py-3 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Wird erstellt…" : "Registrieren"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Bereits registriert?{" "}
          <Link href="/auth/login" className="text-foreground underline underline-offset-4">
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  )
}
