import Link from "next/link"
import { MapPin, Phone, Clock } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-[6%] py-16">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="font-display text-xl font-bold tracking-[0.2em] text-foreground">ALI-AG</span>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Ihre Werkstatt für ehrlichen Service und saubere Arbeit.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div className="text-sm text-muted-foreground">
            Ihgend wo i Blatte
            <br />
            6102 Blatten
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div className="text-sm text-muted-foreground">
            079 hät sie gseiht
            <br />
            Kenn dini Mail nit
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div className="text-sm text-muted-foreground">
            Mo – Fr: 15:00 – 22:00
            <br />
            Sa: nach Vereinbarung
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} MB Performance. Alle Rechte vorbehalten.</span>
        <Link href="/besitzer" className="transition-colors hover:text-foreground">
          Besitzer-Login
        </Link>
      </div>
    </footer>
  )
}
