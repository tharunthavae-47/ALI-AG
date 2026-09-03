import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { listBookings, signOut } from "@/app/actions"
import { BookingsManager } from "@/components/bookings-manager"
import { OccasionManager } from "@/components/occasion-manager"
import { SupplierOrdersManager } from "@/components/supplier-orders-manager"
import { OwnerTodo } from "@/components/owner-todo"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function OwnerPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md border border-border bg-card p-8 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">MB-Performance</p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Anmeldung erforderlich</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Bitte melden Sie sich an, um den Verwaltungsbereich zu öffnen.</p>
          <Link href="/auth/login" className="mt-7 flex w-full items-center justify-center bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground">Anmelden</Link>
          <Link href="/" className="mt-3 flex w-full items-center justify-center border border-border px-6 py-4 text-sm">Zur Startseite</Link>
        </div>
      </main>
    )
  }

  const bookings = await listBookings()
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.display_name ||
    user.email ||
    "Angemeldeter Benutzer"

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-3 py-3 sm:py-4">
            {/* Branding + angemeldeter Benutzer */}
            <div className="min-w-0 flex-1">
              <p className="font-display text-[10px] uppercase tracking-[0.35em] text-muted-foreground sm:text-xs">MB-Performance</p>
              <h1 className="mt-1 truncate font-display text-lg font-bold uppercase tracking-wide sm:text-2xl">Verwaltungsbereich</h1>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="truncate">{userName}</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden shrink-0 items-center gap-2 sm:flex" aria-label="Hauptnavigation">
              <Link href="/lieferant" className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary">Lieferanten</Link>
              <Link href="/" className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary">Website</Link>
              <form action={signOut}>
                <button type="submit" className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary">Abmelden</button>
              </form>
            </nav>

            {/* Mobile Menü */}
            <details className="relative shrink-0 sm:hidden">
              <summary className="flex h-11 cursor-pointer list-none items-center gap-2 border border-border px-3 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden">
                <span className="text-base leading-none" aria-hidden="true">☰</span>
                <span>Menü</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 border border-border bg-background p-2 shadow-xl">
                <div className="border-b border-border px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Angemeldet als</p>
                  <p className="mt-1 truncate text-sm font-semibold">{userName}</p>
                  {user.email && user.email !== userName && <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>}
                </div>
                <nav className="mt-2 grid gap-1" aria-label="Mobile Navigation">
                  <Link href="/besitzer" className="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <span aria-hidden="true">⌂</span>
                    Dashboard
                  </Link>
                  <Link href="/" className="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <span aria-hidden="true">↗</span>
                    Webseite
                  </Link>
                  <Link href="/lieferant" className="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <span aria-hidden="true">▣</span>
                    Lieferanten
                  </Link>
                  <Link href="#aufgaben" className="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <span aria-hidden="true">✓</span>
                    Aufgaben
                  </Link>
                  <Link href="#konto" className="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <span aria-hidden="true">○</span>
                    Konto
                  </Link>
                  <form action={signOut} className="mt-1 border-t border-border pt-1">
                    <button type="submit" className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary">
                      <span aria-hidden="true">↪</span>
                      Abmelden
                    </button>
                  </form>
                </nav>
              </div>
            </details>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div id="aufgaben" className="mb-8 flex scroll-mt-24 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Verwaltung</p>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Terminanfragen</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Hier sehen Sie alle eingegangenen Terminanfragen. Sie können Termine bestätigen oder ablehnen.</p>
          </div>
          <div className="w-full shrink-0 lg:w-[360px]"><OwnerTodo /></div>
        </div>
        {bookings.length === 0 ? <div className="border border-border bg-card px-6 py-16 text-center"><p className="font-display text-lg font-bold uppercase tracking-wide">Keine Buchungen</p><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Aktuell sind keine Terminanfragen vorhanden.</p><Link href="/" className="mt-6 inline-flex border border-border px-5 py-3 text-xs font-medium uppercase tracking-widest transition-colors hover:bg-secondary">Zur Website</Link></div> : <BookingsManager initialBookings={bookings} />}
        <div className="mt-16 border-t border-border pt-12"><OccasionManager /></div>
        <div id="konto" className="mt-16 scroll-mt-24 border-t border-border pt-12"><div className="mb-7"><p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Lieferanten</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Lieferaufträge</h2><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Hier sehen Sie alle Lieferaufträge, Zahlungen und den gesamten offenen Betrag.</p></div><SupplierOrdersManager /></div>
      </section>
    </main>
  )
}
