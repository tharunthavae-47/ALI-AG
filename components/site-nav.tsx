"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"

const links = [
  { href: "#home", label: "Startseite" },
  { href: "#termin", label: "Termin" },
  { href: "/occasion", label: "Occasion" },
  { href: "#ueber", label: "MB Performance" },
]

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/90 backdrop-blur-md">
      <div className="flex min-h-16 items-center justify-between px-5 py-3 sm:px-[6%] sm:py-5">
        <Link href="#home" onClick={closeMenu} className="shrink-0 font-display text-base font-bold tracking-[0.14em] text-foreground sm:text-xl sm:tracking-[0.2em]">MB Performance</Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link>)}
          <Link href="/lieferant" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Lieferant</Link>
          <Link href="/besitzer" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Besitzer</Link>
        </div>

        <button type="button" aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted md:hidden">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && <div className="border-t border-border bg-background px-5 pb-5 pt-3 md:hidden"><div className="flex flex-col gap-1">
        {links.map((l) => <Link key={l.href} href={l.href} onClick={closeMenu} className="rounded-xl px-4 py-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{l.label}</Link>)}
        <Link href="/lieferant" onClick={closeMenu} className="rounded-xl px-4 py-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Lieferant</Link>
        <Link href="/besitzer" onClick={closeMenu} className="mt-1 rounded-xl bg-foreground px-4 py-3 text-center text-base font-medium text-background transition-opacity hover:opacity-90">Besitzer</Link>
      </div></div>}
    </nav>
  )
}
