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

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0"><p className="font-display text-[10px] uppercase tracking-[0.35em] text-muted-foreground sm:text-xs">MB-Performance</p><h1 className="mt-1 truncate font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">Verwaltungsbereich</h1><p className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">{user.email}</p></div>
          <div className="flex shrink-0 items-center gap-2"><Link href="/lieferant" className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary">Lieferanten</Link><Link href="/" className="hidden border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary sm:inline-flex">Website</Link><form action={signOut}><button type="submit" className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary">Abmelden</button></form></div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Verwaltung</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Terminanfragen</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Hier sehen Sie alle eingegangenen Terminanfragen. Sie können Termine bestätigen oder ablehnen.</p></div>
          <div className="w-full shrink-0 lg:w-[360px]"><OwnerTodo /></div>
        </div>
        {bookings.length === 0 ? <div className="border border-border bg-card px-6 py-16 text-center"><p className="font-display text-lg font-bold uppercase tracking-wide">Keine Buchungen</p><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Aktuell sind keine Terminanfragen vorhanden.</p><Link href="/" className="mt-6 inline-flex border border-border px-5 py-3 text-xs font-medium uppercase tracking-widest transition-colors hover:bg-secondary">Zur Website</Link></div> : <BookingsManager initialBookings={bookings} />}
        <div className="mt-16 border-t border-border pt-12"><OccasionManager /></div>
        <div className="mt-16 border-t border-border pt-12"><div className="mb-7"><p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Lieferanten</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">Lieferaufträge</h2><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Hier sehen Sie alle Lieferaufträge, Zahlungen und den gesamten offenen Betrag.</p></div><SupplierOrdersManager /></div>
      </section>
    </main>
  )
}
