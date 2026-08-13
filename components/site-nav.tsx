import Link from "next/link"

const links = [
  { href: "#home", label: "Startseite" },
  { href: "#termin", label: "Termin" },
  { href: "#ueber", label: "MB Performance" },
]

export function SiteNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-white/10 bg-background/80 px-[6%] py-5 backdrop-blur-md">
      <Link href="#home" className="font-display text-xl font-bold tracking-[0.2em] text-foreground">
        MB Performance
      </Link>
      <div className="hidden items-center gap-7 md:flex">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {l.label}
          </a>
        ))}
        <Link
          href="/besitzer"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Besitzer
        </Link>
      </div>
      <Link
        href="/besitzer"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        Besitzer
      </Link>
    </nav>
  )
}
