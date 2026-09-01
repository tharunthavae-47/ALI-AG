import { createClient } from "@supabase/supabase-js"
import "react-native-url-polyfill/auto"

// The mobile app uses the same Supabase project as the existing ALI AG website.
// Only the public anon key is used here. Never put a service-role key in the app.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://cfiumzbuavfbahctzknr.supabase.co"
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt. Setze die Variable vor dem App-Build.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export type SupabaseClient = typeof supabase
