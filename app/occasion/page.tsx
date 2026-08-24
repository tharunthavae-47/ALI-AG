import Link from "next/link"

export default function OccasionPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="flex min-h-screen flex-col md:flex-row">

        {/* KAUFEN */}
        <Link
          href="/occasion/kaufen"
          className="group relative flex min-h-[50vh] w-full flex-1 items-center justify-center overflow-hidden border-b border-white/10 transition-all duration-500 hover:flex-[1.05] md:min-h-screen md:w-1/2 md:border-b-0 md:border-r"
        >
          {/* Hintergrund */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />

          {/* Hover-Effekt */}
          <div className="absolute inset-0 bg-white/[0.02] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Inhalt */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.4em] text-zinc-400">
              MB Performance
            </p>

            <h1 className="text-5xl font-bold tracking-[0.15em] sm:text-6xl md:text-7xl">
              KAUFEN
            </h1>

            <p className="mt-6 max-w-md text-sm leading-7 text-zinc-400 sm:text-base">
              Finde dein nächstes Fahrzeug aus unserem aktuellen
              Occasion-Angebot.
            </p>

            <div className="mt-10 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Fahrzeuge ansehen
              <span className="text-xl transition-transform duration-300 group-hover:translate-x-2">
                →
              </span>
            </div>
          </div>
        </Link>

        {/* VERKAUFEN */}
        <Link
          href="/occasion/verkaufen"
          className="group relative flex min-h-[50vh] w-full flex-1 items-center justify-center overflow-hidden transition-all duration-500 hover:flex-[1.05] md:min-h-screen md:w-1/2"
        >
          {/* Hintergrund */}
          <div className="absolute inset-0 bg-gradient-to-bl from-zinc-900 via-zinc-950 to-black" />

          {/* Hover-Effekt */}
          <div className="absolute inset-0 bg-white/[0.02] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Inhalt */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.4em] text-zinc-400">
              MB Performance
            </p>

            <h1 className="text-5xl font-bold tracking-[0.15em] sm:text-6xl md:text-7xl">
              VERKAUFEN
            </h1>

            <p className="mt-6 max-w-md text-sm leading-7 text-zinc-400 sm:text-base">
              Du möchtest dein Fahrzeug verkaufen? Sende uns deine
              Fahrzeugdaten und wir melden uns bei dir.
            </p>

            <div className="mt-10 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Fahrzeug anbieten
              <span className="text-xl transition-transform duration-300 group-hover:translate-x-2">
                →
              </span>
            </div>
          </div>
        </Link>

      </section>
    </main>
  )
}
