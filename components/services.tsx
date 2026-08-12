import { Gauge, Wrench, Car, Cog, ShieldCheck, Droplets } from "lucide-react"

const services = [
  { icon: Wrench, title: "Reparaturen", desc: "Von der kleinen Reparatur bis zur großen Instandsetzung – schnell und zuverlässig." },
  { icon: Gauge, title: "Diagnose", desc: "Moderne Fehlerdiagnose für alle gängigen Marken und Modelle." },
  { icon: Cog, title: "Inspektion & Wartung", desc: "Regelmäßige Wartung nach Herstellervorgaben für ein langes Fahrzeugleben." },
  { icon: ShieldCheck, title: "MFK", desc: "Wir vorbereiten ihr Fahrzeug für ein Problemlose Vorführung." },
  { icon: Droplets, title: "Ölwechsel", desc: "Fachgerechter Öl- und Filterwechsel mit hochwertigen Materialien." },
  { icon: Car, title: "Reifenservice", desc: "Reifenwechsel, Einlagerung und Auswuchten – alles aus einer Hand." },
]

export function Services() {
  return (
    <section id="leistungen" className="border-t border-border px-[6%] py-24">
      <div className="mx-auto max-w-6xl">
        <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">Was wir tun</p>
        <h2 className="mt-4 max-w-2xl text-balance font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
          Leistungen rund um Ihr Fahrzeug
        </h2>
        <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.title} className="group bg-card p-8 transition-colors hover:bg-secondary">
              <s.icon className="h-7 w-7 text-foreground" strokeWidth={1.5} />
              <h3 className="mt-6 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
