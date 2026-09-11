import type { MetadataRoute } from "next"

const baseUrl = "https://www.mb-performance.ch"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/besitzer", "/lieferant", "/api/", "/wp-admin/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
