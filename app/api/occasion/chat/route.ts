import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function adminClient() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Server-Konfiguration fehlt.")
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getGuestId(request: NextRequest) {
  return request.cookies.get("occasion_guest_id")?.value || crypto.randomUUID()
}

function withGuestCookie(response: NextResponse, guestId: string) {
  if (!response.cookies.get("occasion_guest_id")) {
    response.cookies.set("occasion_guest_id", guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
    })
  }
  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const listingId = String(body.listingId || "")
    const name = String(body.name || "").trim().slice(0, 120)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const message = String(body.message || "").trim().slice(0, 4000)
    if (!listingId) return NextResponse.json({ error: "Fahrzeug fehlt." }, { status: 400 })

    const supabase = adminClient()
    const guestId = getGuestId(request)

    const { data: listing, error: listingError } = await supabase
      .from("occasion_listings")
      .select("id, owner_id, published")
      .eq("id", listingId)
      .eq("published", true)
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: "Fahrzeug ist nicht mehr veröffentlicht." }, { status: 404 })

    // Guests are identified by a secure HTTP-only cookie, not by auth.users.
    // customer_id remains available for authenticated customers, while guest_id
    // is used for visitors who are not logged in.
    const { data: existing, error: findError } = await supabase
      .from("occasion_chats")
      .select("id, customer_name, customer_phone")
      .eq("occasion_listing_id", listingId)
      .eq("guest_id", guestId)
      .maybeSingle()
    if (findError) throw findError

    let chat = existing
    if (!chat) {
      const { data: created, error: createError } = await supabase
        .from("occasion_chats")
        .insert({
          occasion_listing_id: listingId,
          customer_id: null,
          guest_id: guestId,
          owner_id: listing.owner_id,
          customer_name: name || null,
          customer_phone: phone || null,
        })
        .select("id, customer_name, customer_phone")
        .single()
      if (createError) throw createError
      chat = created
    } else if (name !== (chat.customer_name || "") || phone !== (chat.customer_phone || "")) {
      const { error: updateError } = await supabase
        .from("occasion_chats")
        .update({ customer_name: name || null, customer_phone: phone || null, updated_at: new Date().toISOString() })
        .eq("id", chat.id)
        .eq("guest_id", guestId)
      if (updateError) throw updateError
    }

    if (message) {
      const { error: messageError } = await supabase.from("occasion_messages").insert({
        chat_id: chat.id,
        sender_id: null,
        message,
      })
      if (messageError) throw messageError
      await supabase.from("occasion_chats").update({ updated_at: new Date().toISOString() }).eq("id", chat.id)
    }

    const { data: messages, error: messagesError } = await supabase
      .from("occasion_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true })
    if (messagesError) throw messagesError

    const response = NextResponse.json({ chatId: chat.id, userId: guestId, messages: messages || [] })
    return withGuestCookie(response, guestId)
  } catch (error) {
    console.error("Occasion chat POST error", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Live-Chat konnte nicht gestartet werden." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const chatId = request.nextUrl.searchParams.get("chatId")
    if (!chatId) return NextResponse.json({ error: "Chat fehlt." }, { status: 400 })
    const guestId = getGuestId(request)
    const supabase = adminClient()

    const { data: chat, error: chatError } = await supabase
      .from("occasion_chats")
      .select("id, customer_id, guest_id")
      .eq("id", chatId)
      .eq("guest_id", guestId)
      .maybeSingle()
    if (chatError) throw chatError
    if (!chat) return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 })

    const { data: messages, error: messagesError } = await supabase
      .from("occasion_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
    if (messagesError) throw messagesError

    const response = NextResponse.json({ chatId, userId: guestId, messages: messages || [] })
    return withGuestCookie(response, guestId)
  } catch (error) {
    console.error("Occasion chat GET error", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat konnte nicht geladen werden." }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const chatId = String(body.chatId || "")
    const message = String(body.message || "").trim().slice(0, 4000)
    if (!chatId || !message) return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 })

    const guestId = getGuestId(request)
    const supabase = adminClient()
    const { data: chat, error: chatError } = await supabase
      .from("occasion_chats")
      .select("id, customer_id, guest_id")
      .eq("id", chatId)
      .eq("guest_id", guestId)
      .maybeSingle()
    if (chatError) throw chatError
    if (!chat) return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 })

    const { error: messageError } = await supabase.from("occasion_messages").insert({ chat_id: chatId, sender_id: null, message })
    if (messageError) throw messageError
    await supabase.from("occasion_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId)

    const response = NextResponse.json({ ok: true, userId: guestId })
    return withGuestCookie(response, guestId)
  } catch (error) {
    console.error("Occasion chat PUT error", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nachricht konnte nicht gesendet werden." }, { status: 500 })
  }
}
