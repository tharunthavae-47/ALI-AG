import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--warn)]" strokeWidth={1.5} />
        <h1 className="mt-6 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Anmeldung fehlgeschlagen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Beim Anmelden ist ein Fehler aufgetreten. Der Link ist möglicherweise abgelaufen. Bitte versuchen Sie es
          erneut.
        </p>
        <Link
          href="/auth/login"
          className="mt-8 inline-block bg-primary px-6 py-3 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
        >
          Zurück zum Login
        </Link>
      </div>
    </main>
  )
}
