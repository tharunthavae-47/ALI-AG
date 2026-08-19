import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore =
    await cookies()

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL fehlt.",
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt.",
    )
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },

        setAll(
          cookiesToSet,
        ) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                )
              },
            )
          } catch {
            // Server Components können
            // Cookies nicht immer setzen.
            // Die Session wird durch proxy.ts
            // aktualisiert.
          }
        },
      },

      cookieOptions: {
        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/",
      },
    },
  )
}
