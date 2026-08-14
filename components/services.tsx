"use client"

import { useState } from "react"
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
    short:
      "Von der kleinen Reparatur bis zur großen Instandsetzung – schnell und zuverlässig.",
    details:
      "Wir übernehmen Reparaturen aller Art – von kleineren Arbeiten bis hin zu umfangreichen Instandsetzungen. Dabei prüfen wir die Ursache des Problems sorgfältig und führen die notwendigen Arbeiten fachgerecht und zuverlässig durch.",
    animation: "repair",
  },
  {
    icon: Gauge,
    title: "Diagnose",
    short:
      "Moderne Fehlerdiagnose für alle gängigen Marken und Modelle.",
    details:
      "Mit moderner Fahrzeugdiagnose überprüfen wir elektronische Systeme und Fehlermeldungen Ihres Fahrzeugs. Wir suchen gezielt nach der Ursache und informieren Sie verständlich über den festgestellten Fehler und die notwendigen Reparaturen.",
    animation: "diagnose",
  },
  {
    icon: Cog,
    title: "Inspektion & Wartung",
    short:
      "Regelmäßige Wartung nach Herstellervorgaben für ein langes Fahrzeugleben.",
    details:
      "Wir führen regelmäßige Wartungs- und Inspektionsarbeiten nach den Vorgaben des Fahrzeugherstellers durch. Dazu gehören unter anderem Kontrollen wichtiger Fahrzeugkomponenten sowie der Austausch von Verschleißteilen und Betriebsstoffen.",
    animation: "maintenance",
  },
  {
    icon: ShieldCheck,
    title: "MFK",
    short:
      "Wir bereiten Ihr Fahrzeug für eine problemlose Vorführung vor.",
    details:
      "Wir bereiten Ihr Fahrzeug sorgfältig auf die MFK vor. Dabei kontrollieren wir wichtige sicherheitsrelevante Bereiche und weisen Sie auf mögliche Mängel hin, damit Ihr Fahrzeug möglichst problemlos zur Vorführung kann.",
    animation: "mfk",
  },
  {
    icon: Droplets,
    title: "Ölwechsel",
    short:
      "Fachgerechter Öl- und Filterwechsel mit hochwertigen Materialien.",
    details:
      "Wir führen fachgerechte Öl- und Filterwechsel mit passenden, hochwertigen Materialien durch. Dabei achten wir auf die vom Fahrzeughersteller vorgeschriebenen Spezifikationen, damit Motor und Schmierung optimal funktionieren.",
    animation: "oil",
  },
  {
    icon: null,
    title: "Reifenservice",
    short:
      "Reifenwechsel, Einlagerung und Auswuchten – alles aus einer Hand.",
    details:
      "Wir kümmern uns um den kompletten Reifenservice – vom saisonalen Reifenwechsel über das Auswuchten bis zur fachgerechten Einlagerung. Dabei kontrollieren wir Zustand, Profil und Luftdruck der Reifen und sorgen für einen sicheren und sauberen Wechsel.",
    animation: "tires",
  },
]

function TireIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-8 w-8 text-foreground transition-transform duration-700 group-hover:rotate-180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="currentColor"
        strokeWidth="4"
      />

      <circle
        cx="24"
        cy="24"
        r="8"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      <circle
        cx="24"
        cy="24"
        r="2.5"
        fill="currentColor"
      />

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
  const [openService, setOpenService] = useState<string | null>(null)

  const toggleService = (title: string) => {
    setOpenService((current) =>
      current === title ? null : title
    )
  }

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

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Von Reparaturen und Diagnose bis hin zu Wartung, MFK,
            Ölwechsel und Reifenservice – wir kümmern uns zuverlässig
            um Ihr Fahrzeug.
          </p>
        </div>

        {/* Leistungen */}
        <div className="mt-14 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">

          {services.map((service, index) => {
            const Icon = service.icon
            const isOpen = openService === service.title

            return (
              <div
                key={service.title}
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

                    {service.animation === "tires" ? (
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
                              service.animation === "repair"
                                ? "group-hover:rotate-12 group-hover:scale-110"
                                : ""
                            }

                            ${
                              service.animation === "diagnose"
                                ? "group-hover:scale-125"
                                : ""
                            }

                            ${
                              service.animation === "maintenance"
                                ? "group-hover:rotate-180"
                                : ""
                            }

                            ${
                              service.animation === "mfk"
                                ? "group-hover:-translate-y-1 group-hover:scale-110"
                                : ""
                            }

                            ${
                              service.animation === "oil"
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
                    {service.title}
                  </h3>

                  {/* KURZER TEXT */}
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {service.short}
                  </p>

                  {/* AUSFÜHRLICHER TEXT */}
                  <div
                    className={`
                      grid transition-all duration-500 ease-in-out
                      ${
                        isOpen
                          ? "mt-5 grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }
                    `}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-border pt-5">
                        <p className="text-sm leading-7 text-muted-foreground">
                          {service.details}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BUTTON */}
                  <button
                    type="button"
                    onClick={() => toggleService(service.title)}
                    aria-expanded={isOpen}
                    className="
                      mt-6
                      inline-flex
                      items-center
                      gap-2
                      text-sm
                      font-medium
                      text-foreground
                      transition-all
                      duration-300
                      hover:gap-3
                    "
                  >
                    {isOpen ? "Weniger anzeigen" : "Mehr erfahren"}

                    <span
                      className={`
                        transition-transform
                        duration-300
                        ${isOpen ? "rotate-180" : ""}
                      `}
                    >
                      ↓
                    </span>
                  </button>

                </div>
              </div>
            )
          })}

        </div>

        {/* Termin Button */}
        <div className="mt-12 text-center animate-fade-up">
          <a
            href="/termin"
            className="
              inline-flex
              items-center
              justify-center
              rounded-xl
              bg-foreground
              px-7
              py-3.5
              text-sm
              font-medium
              text-background
              transition-all
              duration-300
              hover:scale-105
              hover:shadow-lg
              active:scale-95
            "
          >
            Termin vereinbaren
          </a>
        </div>

      </div>
    </section>
  )
}
