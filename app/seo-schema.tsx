import Script from "next/script"

const baseUrl = "https://www.mb-performance.ch"

export function MbPerformanceStructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AutoRepair",
        "@id": `${baseUrl}/#business`,
        name: "MB Performance",
        url: baseUrl,
        description:
          "Persönlicher, zuverlässiger und professioneller Service rund um Ihr Fahrzeug.",
        founder: {
          "@type": "Person",
          name: "Mohamedali Brahim",
          jobTitle: "Mechaniker",
        },
        areaServed: {
          "@type": "Country",
          name: "Schweiz",
        },
        knowsAbout: [
          "Autoreparatur",
          "Fahrzeugdiagnose",
          "Inspektion und Wartung",
          "MFK",
          "Ölwechsel",
          "Reifenservice",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "MB Performance",
        publisher: { "@id": `${baseUrl}/#business` },
        inLanguage: "de-CH",
      },
    ],
  }

  return (
    <Script
      id="mb-performance-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
