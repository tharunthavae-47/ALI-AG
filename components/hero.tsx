import Image from "next/image"

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden">
      <Image
        src="/AliAuto.jpg"
        alt="Mechaniker bei der Arbeit an einem Motor in der Werkstatt"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="relative z-10 w-full px-[6%]">
        <div className="max-w-2xl">
          <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Auto Reparatur &amp; Service
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Ihre Werkstatt,
            <br />
            <span className="text-muted-foreground">der Sie vertrauen.</span>
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Persönlich, zuverlässig und professionell. Bei ALI-AG kümmern wir uns um Ihr Fahrzeug, als wäre es unser
            eigenes. Vereinbaren Sie Ihren Termin bequem online.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#termin"
              className="bg-primary px-8 py-4 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
            >
              Termin buchen
            </a>
            <a
              href="#leistungen"
              className="border border-border px-8 py-4 font-display text-sm font-semibold uppercase tracking-widest text-foreground transition-colors hover:bg-secondary"
            >
              Leistungen
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
