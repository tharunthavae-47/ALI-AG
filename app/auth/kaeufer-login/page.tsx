"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function BuyerLoginPage() {
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
      window.location.replace("/occasion/kaufen")
    } catch {
      setError("Beim Anmelden ist ein Fehler aufgetreten.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <Link href="/occasion/kaufen" className="font-bold tracking-[0.2em]">MB PERFORMANCE</Link>
        <h1 className="mt-8 text-3xl font-bold">Käufer-Login</h1>
        <p className="mt-2 text-sm text-zinc-400">Melde dich an, um Verkäufer über den Live-Chat zu kontaktieren.</p>
        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block"><span className="text-xs uppercase tracking-widest text-zinc-500">E-Mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none focus:border-white/30 disabled:opacity-50" /></label>
          <label className="block"><span className="text-xs uppercase tracking-widest text-zinc-500">Passwort</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={loading} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none focus:border-white/30 disabled:opacity-50" /></label>
          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          <button type="submit" disabled={loading || !email.trim() || !password} className="w-full rounded-xl bg-white px-5 py-4 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-50">{loading ? "Anmelden..." : "Anmelden und Chat öffnen"}</button>
        </form>
        <Link href="/occasion/kaufen" className="mt-6 block text-sm text-zinc-500 hover:text-white">← Zurück zu Occasion kaufen</Link>
      </div>
    </main>
  )
}
