"use client"

import { Gauge, Wrench, Cog, ShieldCheck, Droplets, CircleDot } from "lucide-react"

const services = [
  {
    icon: Wrench,
    title: "Reparaturen",
    desc: "Von der kleinen Reparatur bis zur großen Instandsetzung – schnell und zuverlässig.",
    animation: "repair",
  },
  {
    icon: Gauge,
    title: "Diagnose",
    desc: "Moderne Fehlerdiagnose für alle gängigen Marken und Modelle.",
    animation: "diagnose",
  },
  {
    icon: Cog,
    title: "Inspektion & Wartung",
    desc: "Regelmäßige Wartung nach Herstellervorgaben für ein langes Fahrzeugleben.",
    animation: "maintenance",
  },
  {
    icon: ShieldCheck,
    title: "MFK",
    desc: "Wir bereiten Ihr Fahrzeug für eine problemlose Vorführung vor.",
    animation: "mfk",
  },
  {
    icon: Droplets,
    title: "Ölwechsel",
    desc: "Fachgerechter Öl- und Filterwechsel mit hochwertigen Materialien.",
    animation: "oil",
  },
  {
    icon: CircleDot,
    title: "Reifenservice",
    desc: "Reifenwechsel, Einlagerung und Auswuchten – alles aus einer Hand.",
    animation: "tires",
  },
]

export function Services() {
  return (
    <section
      id="leistungen"
      className="border-t border-border px-[6%] py-24"
    >
      <div className="mx-auto max-w-6xl">

        {/* Überschrift */}
        <div className="animate-fade-up">
          <p className="font-display text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Was wir tun
          </p>

          <h2 className="mt-4 max-w-2xl text-balance font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">
            Leistungen rund um Ihr Fahrzeug
          </h2>
        </div>

        {/* Leistungen */}
        <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">

          {services.map((s, index) => {
            const Icon = s.icon

            return (
              <div
                key={s.title}
                className="group relative overflow-hidden bg-card p-8
                opacity-0 animate-service-card
                transition-all duration-300
                hover:-translate-y-1 hover:bg-secondary"
                style={{
                  animationDelay: `${index * 120}ms`,
                  animationFillMode: "forwards",
                }}
              >

                {/* Dezenter Hover-Effekt */}
                <div
                  className="pointer-events-none absolute inset-0
                  bg-white/[0.03] opacity-0
                  transition-opacity duration-300
                  group-hover:opacity-100"
                />

                <div className="relative z-10">

                  {/* ICON */}

                  {s.animation === "repair" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-500
                      group-hover:rotate-12 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                  )}

                  {s.animation === "diagnose" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-500
                      group-hover:scale-125"
                      strokeWidth={1.5}
                    />
                  )}

                  {s.animation === "maintenance" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-700
                      group-hover:rotate-180"
                      strokeWidth={1.5}
                    />
                  )}

                  {s.animation === "mfk" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-500
                      group-hover:-translate-y-1 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                  )}

                  {s.animation === "oil" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-500
                      group-hover:translate-y-1"
                      strokeWidth={1.5}
                    />
                  )}

                  {s.animation === "tires" && (
                    <Icon
                      className="h-7 w-7 text-foreground
                      transition-transform duration-700
                      group-hover:rotate-180"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* TITEL */}

                  <h3
                    className="mt-6 font-display text-xl font-semibold
                    uppercase tracking-wide text-foreground
                    transition-transform duration-300
                    group-hover:translate-x-1"
                  >
                    {s.title}
                  </h3>

                  {/* BESCHREIBUNG */}

                  <p
                    className="mt-3 text-sm leading-relaxed
                    text-muted-foreground"
                  >
                    {s.desc}
                  </p>

                  {/* PFEIL */}

                  <div
                    className="mt-6 translate-x-[-8px]
                    text-sm font-medium text-foreground
                    opacity-0 transition-all duration-300
                    group-hover:translate-x-0
                    group-hover:opacity-100"
                  >
                    Mehr erfahren →
                  </div>

                </div>
              </div>
            )
          })}

        </div>

      </div>
    </section>
  )
}
