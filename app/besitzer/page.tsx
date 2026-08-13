import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { listBookings, signOut } from "@/app/actions"
import { BookingsManager } from "@/components/bookings-manager"

export default async function OwnerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const bookings = await listBookings()

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-[6%] py-5">
        <Link href="/" className="font-display text-xl font-bold tracking-[0.2em] text-foreground">
          MB Performance
        </Link>
        <div className="flex items-center gap-5">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="border border-border px-4 py-2 font-display text-xs uppercase tracking-widest text-foreground transition-colors hover:bg-secondary"
            >
              Abmelden
            </button>
          </form>
        </div>
      </header>

      <div className="px-[6%] py-12">
        <div className="mx-auto max-w-5xl">
          <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">Besitzerbereich</p>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
            Terminanfragen
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Verwalten Sie eingehende Terminanfragen. Bestätigte Termine werden im Online-Kalender als belegt angezeigt.
          </p>

          <div className="mt-10">
            <BookingsManager initialBookings={bookings} />
          </div>
        </div>
      </div>
    </main>
  )
}
