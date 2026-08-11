import Link from "next/link"
import { MailCheck } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <MailCheck className="mx-auto h-12 w-12 text-[var(--ok)]" strokeWidth={1.5} />
        <h1 className="mt-6 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Fast geschafft
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Wir haben Ihnen eine Bestätigungs-E-Mail gesendet. Bitte bestätigen Sie Ihre Adresse, bevor Sie sich anmelden.
        </p>
        <Link
          href="/auth/login"
          className="mt-8 inline-block bg-primary px-6 py-3 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
        >
          Zum Login
        </Link>
      </div>
    </main>
  )
}
