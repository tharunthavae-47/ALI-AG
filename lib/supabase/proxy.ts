import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },

      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet) {
          /*
           * Cookies zuerst im Request aktualisieren.
           * Dadurch kann Supabase die neue Session
           * innerhalb derselben Request-Kette verwenden.
           */
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(
                name,
                value,
              )
            },
          )

          /*
           * Neue Response erzeugen.
           */
          supabaseResponse =
            NextResponse.next({
              request,
            })

          /*
           * Supabase-Cookies an den Browser weitergeben.
           */
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options,
              )
            },
          )
        },
      },
    },
  )

  /*
   * WICHTIG:
   * Keine Logik zwischen createServerClient()
   * und getUser().
   */
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  /*
   * Besitzerbereich schützen.
   */
  if (
    request.nextUrl.pathname.startsWith(
      "/besitzer",
    ) &&
    (!user || error)
  ) {
    const url =
      request.nextUrl.clone()

    url.pathname = "/auth/login"

    /*
     * Alte Query-Parameter entfernen.
     */
    url.search = ""

    return NextResponse.redirect(
      url,
    )
  }

  /*
   * Supabase-Response unverändert zurückgeben.
   */
  return supabaseResponse
}
