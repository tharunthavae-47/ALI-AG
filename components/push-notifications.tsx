"use client"

import { useEffect, useState } from "react"

export function PushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const isSupported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
    setSupported(isSupported)
    if (isSupported) setPermission(Notification.permission)
  }, [])

  async function enable() {
    if (!supported || busy) return
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") return

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt")

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) throw new Error("Push-Subscription konnte nicht gespeichert werden")
    } catch (error) {
      console.error("ALI AG Push-Setup fehlgeschlagen:", error)
    } finally {
      setBusy(false)
    }
  }

  if (!supported || permission === "granted") return null

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy || permission === "denied"}
      className="fixed bottom-5 right-5 z-[60] rounded-full border border-white/20 bg-black px-5 py-3 text-sm font-semibold text-white shadow-2xl transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="ALI AG Benachrichtigungen aktivieren"
    >
      {permission === "denied" ? "Benachrichtigungen blockiert" : busy ? "Wird aktiviert…" : "🔔 Benachrichtigungen aktivieren"}
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
