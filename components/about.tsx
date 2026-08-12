const stats = [
  { value: "5+", label: "Erfahrung" },
  { value: "😊", label: "Zufriedene Kunden" },
  { value: "❤️", label: "Alles mit Liebe" },
]

export function About() {
  return (
    <section id="ueber" className="border-t border-border px-[6%] py-24">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Über ALI-AG
          </p>

          <h2 className="mt-4 text-balance font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
            Handwerk mit Handschlag-Qualität
          </h2>

          <p className="mt-6 text-pretty leading-relaxed text-muted-foreground">
            ALI-AG ist eine inhabergeführte Werkstatt, die für ehrliche Beratung
            und saubere Arbeit steht. Wir nehmen uns Zeit für Ihr Anliegen,
            erklären verständlich, was zu tun ist, und arbeiten transparent zu
            fairen Preisen.
          </p>

          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Ob Kleinwagen, Familienauto, Sportwagen oder Transporter – bei uns
            ist Ihr Fahrzeug in erfahrenen Händen.
          </p>
        </div>

        <div>
          {/* Statistik */}
          <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
            {stats.map((s) => (
              <div key={s.label} className="bg-card p-6 text-center">
                <div className="font-display text-3xl font-bold text-foreground md:text-4xl">
                  {s.value}
                </div>

                <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Inhaber */}
          <div className="mt-6 border border-border bg-card p-6 text-center">
            <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Inhaber
            </p>

            <h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-foreground">
              Mohamedali Brahim
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Mechaniker
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
