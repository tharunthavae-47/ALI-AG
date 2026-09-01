import { NextResponse } from "next/server"
import { createClient } from "@supabase/ssr"

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.headers.get("cookie")?.split("; ").map((part) => { const i = part.indexOf("="); return { name: i >= 0 ? part.slice(0, i) : part, value: i >= 0 ? part.slice(i + 1) : "" } }) ?? [] },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })

  const body = await request.json()
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Ungültige Push-Subscription" }, { status: 400 })
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: request.headers.get("user-agent"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return response
}
