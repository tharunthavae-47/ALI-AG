import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { listBookings, signOut } from "@/app/actions"
import { BookingsManager } from "@/components/bookings-manager"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function OwnerPage() {
  // ============================================================
  // SUPABASE
  // ============================================================

  const supabase = await createClient()

  // ============================================================
  // USER PRÜFEN
  // ============================================================

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // ============================================================
  // NICHT EINGELOGGT
  // ============================================================

  if (userError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md border border-border bg-card p-8 text-center">

          <div className="mb-6">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              MB-Performance
            </p>

            <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">
              Besitzerbereich
            </h1>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Sie sind nicht angemeldet.
            <br />
            Bitte melden Sie sich an, um die
            Terminanfragen zu verwalten.
          </p>

          <Link
            href="/auth/login"
            className="mt-8 flex w-full items-center justify-center bg-primary px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
          >
            Zum Besitzer-Login
          </Link>

          <Link
            href="/"
            className="mt-3 flex w-full items-center justify-center border border-border px-6 py-4 text-sm transition-colors hover:bg-secondary"
          >
            Zur Startseite
          </Link>

        </div>
      </main>
    )
  }

  // ============================================================
  // BUCHUNGEN AUS SUPABASE LADEN
  // ============================================================

  const bookings = await listBookings()

  // ============================================================
  // STATISTIK
  // ============================================================

  const pendingCount = bookings.filter(
    (booking) =>
      booking.status === "pending",
  ).length

  const confirmedCount = bookings.filter(
    (booking) =>
      booking.status === "confirmed",
  ).length

  const rejectedCount = bookings.filter(
    (booking) =>
      booking.status === "rejected",
  ).length

  // ============================================================
  // OWNER PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-background">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

          {/* LOGO / TITEL */}

          <div className="min-w-0">

            <p className="font-display text-[10px] uppercase tracking-[0.35em] text-muted-foreground sm:text-xs">
              MB-Performance
            </p>

            <h1 className="mt-1 truncate font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">
              Besitzerbereich
            </h1>

            <p className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">
              {user.email}
            </p>

          </div>

          {/* NAVIGATION */}

          <div className="flex shrink-0 items-center gap-2">

            <Link
              href="/"
              className="hidden border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary sm:inline-flex"
            >
              Website
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-secondary"
              >
                Abmelden
              </button>
            </form>

          </div>

        </div>

      </header>

      {/* ======================================================
          HAUPTINHALT
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">

        {/* ====================================================
            TITEL
        ==================================================== */}

        <div className="mb-8">

          <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Verwaltung
          </p>

          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Terminanfragen
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Hier sehen Sie alle eingegangenen Terminanfragen.
            Sie können Termine bestätigen, stornieren oder löschen.
          </p>

        </div>

        {/* ====================================================
            STATISTIK
        ==================================================== */}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* OFFEN */}

          <div className="border border-border bg-card p-5">

            <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Offen
            </p>

            <p className="mt-2 font-display text-3xl font-bold">
              {pendingCount}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Neue Terminanfragen
            </p>

          </div>

          {/* BESTÄTIGT */}

          <div className="border border-border bg-card p-5">

            <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Bestätigt
            </p>

            <p className="mt-2 font-display text-3xl font-bold">
              {confirmedCount}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Bestätigte Termine
            </p>

          </div>

          {/* STORNIERT */}

          <div className="border border-border bg-card p-5">

            <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Storniert
            </p>

            <p className="mt-2 font-display text-3xl font-bold">
              {rejectedCount}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Stornierte Termine
            </p>

          </div>

        </div>

        {/* ====================================================
            SUPABASE STATUS
        ==================================================== */}

        <div className="mb-6 border border-border bg-card px-5 py-4">

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="font-display text-xs font-bold uppercase tracking-widest">
                Buchungen geladen
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Die Daten werden direkt aus Supabase geladen.
              </p>

            </div>

            <p className="font-display text-sm font-bold">
              {bookings.length} insgesamt
            </p>

          </div>

        </div>

        {/* ====================================================
            BUCHUNGEN
        ==================================================== */}

        {bookings.length === 0 ? (

          <div className="border border-border bg-card px-6 py-16 text-center">

            <p className="font-display text-lg font-bold uppercase tracking-wide">
              Keine Buchungen
            </p>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Aktuell sind keine Terminanfragen vorhanden.
              Sobald ein Kunde einen Termin anfragt,
              erscheint dieser hier.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex border border-border px-5 py-3 text-xs font-medium uppercase tracking-widest transition-colors hover:bg-secondary"
            >
              Zur Website
            </Link>

          </div>

        ) : (

          /*
           * WICHTIG:
           * bookings statt initialBookings
           */

          <BookingsManager
            bookings={bookings}
          />

        )}

      </section>

    </main>
  )
}
