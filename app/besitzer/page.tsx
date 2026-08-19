import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { listBookings, signOut } from "@/app/actions"
import { BookingsManager } from "@/components/bookings-manager"

export const dynamic = "force-dynamic"

export default async function OwnerPage() {
  const supabase = await createClient()

  // Prüfen, ob der Besitzer eingeloggt ist
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Wenn nicht eingeloggt → Login
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md border border-border bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Besitzerbereich
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Sie müssen angemeldet sein, um diesen Bereich zu öffnen.
          </p>

          <Link
            href="/auth/login"
            className="mt-6 inline-flex w-full items-center justify-center bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground"
          >
            Zum Login
          </Link>

          <Link
            href="/"
            className="mt-3 inline-flex w-full items-center justify-center border border-border px-6 py-4 text-sm hover:bg-secondary"
          >
            Zur Startseite
          </Link>
        </div>
      </main>
    )
  }

  // Buchungen laden
  const bookings = await listBookings()

  return (
    <main className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              MB-Performance
            </p>

            <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">
              Besitzerbereich
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Angemeldet als {user.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden border border-border px-4 py-2 text-sm hover:bg-secondary sm:inline-flex"
            >
              Website
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Verwaltung
          </p>

          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">
            Termine
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Hier können Sie eingehende Terminanfragen ansehen,
            bestätigen, stornieren oder löschen.
          </p>
        </div>

        {/* BUCHUNGEN */}
        <BookingsManager initialBookings={bookings} />
      </section>
    </main>
  )
}
