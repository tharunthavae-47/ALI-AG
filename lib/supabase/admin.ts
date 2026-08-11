import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client for server-side use ONLY.
 * Bypasses RLS, so it must never be imported into client components.
 * Used by server actions to read/write the RLS-locked `bookings` table
 * without exposing customer PII through the public anon key.
 */
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
