"use client"

import {
  Gauge,
  Wrench,
  Cog,
  ShieldCheck,
  Droplets,
} from "lucide-react"

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
    icon: null,
    title: "Reifenservice",
    desc: "Reifenwechsel, Einlagerung und Auswuchten – alles aus einer Hand.",
    animation: "tires",
  },
]

/* Eigenes Reifen-Symbol */
function TireIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-8 w-8 text-foreground transition-transform duration-700 group-hover:rotate-180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Reifen */}
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="currentColor"
        strokeWidth="4"
      />

      {/* Felge */}
      <circle
        cx="24"
        cy="24"
        r="8"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      {/* Felgenmitte */}
      <circle
        cx="24"
        cy="24"
        r="2.5"
        fill="currentColor"
      />

      {/* Speichen */}
      <path
        d="M24 13V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M24 27V35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M13 24H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M27 24H35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M16.2 16.2L21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M27 27L31.8 31.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M31.8 16.2L27 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M21 27L16.2 31.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

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
                className="
                  group
                  relative
                  overflow-hidden
                  bg-card
                  p-8
                  opacity-0
                  animate-service-card
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:bg-secondary
                "
                style={{
                  animationDelay: `${index * 120}ms`,
                  animationFillMode: "forwards",
                }}
              >

                {/* Hover-Hintergrund */}
                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-white/[0.03]
                    opacity-0
                    transition-opacity
                    duration-300
                    group-hover:opacity-100
                  "
                />

                <div className="relative z-10">

                  {/* ICON */}
                  <div className="flex h-8 items-center">

                    {s.animation === "tires" ? (
                      <TireIcon />
                    ) : (
                      Icon && (
                        <Icon
                          className={`
                            h-7
                            w-7
                            text-foreground
                            transition-all
                            duration-500

                            ${
                              s.animation === "repair"
                                ? "group-hover:rotate-12 group-hover:scale-110"
                                : ""
                            }

                            ${
                              s.animation === "diagnose"
                                ? "group-hover:scale-125"
                                : ""
                            }

                            ${
                              s.animation === "maintenance"
                                ? "group-hover:rotate-180"
                                : ""
                            }

                            ${
                              s.animation === "mfk"
                                ? "group-hover:-translate-y-1 group-hover:scale-110"
                                : ""
                            }

                            ${
                              s.animation === "oil"
                                ? "group-hover:translate-y-1"
                                : ""
                            }
                          `}
                          strokeWidth={1.5}
                        />
                      )
                    )}

                  </div>

                  {/* TITEL */}
                  <h3
                    className="
                      mt-6
                      font-display
                      text-xl
                      font-semibold
                      uppercase
                      tracking-wide
                      text-foreground
                      transition-transform
                      duration-300
                      group-hover:translate-x-1
                    "
                  >
                    {s.title}
                  </h3>

                  {/* BESCHREIBUNG */}
                  <p
                    className="
                      mt-3
                      text-sm
                      leading-relaxed
                      text-muted-foreground
                    "
                  >
                    {s.desc}
                  </p>

                  {/* MEHR ERFAHREN */}
                  <div
                    className="
                      mt-6
                      translate-x-[-8px]
                      text-sm
                      font-medium
                      text-foreground
                      opacity-0
                      transition-all
                      duration-300
                      group-hover:translate-x-0
                      group-hover:opacity-100
                    "
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
