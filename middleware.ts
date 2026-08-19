import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(
  request: NextRequest
) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Alle Seiten verarbeiten,
     * außer statische Next.js-Dateien,
     * Bilder und Favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
