import { NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

function configurePush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID environment variables are missing")
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export async function POST(request: Request) {
  try {
    configurePush()
    const secret = request.headers.get("x-push-secret")
    if (!process.env.PUSH_SEND_SECRET || secret !== process.env.PUSH_SEND_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, title, body, url, tag } = await request.json()
    if (!userId || !title || !body) return NextResponse.json({ error: "userId, title and body are required" }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: subscriptions, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "ali-ag" })
    const results = await Promise.all((subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload)
        return { id: subscription.id, ok: true }
      } catch (pushError: any) {
        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", subscription.id)
        return { id: subscription.id, ok: false, status: pushError?.statusCode ?? 500 }
      }
    }))

    return NextResponse.json({ ok: true, results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Push failed" }, { status: 500 })
  }
}
