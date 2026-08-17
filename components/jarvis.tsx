"use client"

import { useState } from "react"

export function Jarvis() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)

  async function askJarvis() {
    if (!message.trim() || loading) return

    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "JARVIS konnte nicht antworten.")
      }

      setAnswer(data.answer)
      setMessage("")
    } catch (error: any) {
      setAnswer(
        error?.message || "JARVIS konnte nicht erreicht werden."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-black text-2xl text-white shadow-2xl transition hover:scale-110"
        >
          🤖
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] overflow-hidden rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-black p-4 text-white">
            <div>
              <div className="font-bold">JARVIS</div>
              <div className="text-xs text-green-400">
                ● ONLINE
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="text-xl"
            >
              ×
            </button>
          </div>

          <div className="h-[350px] overflow-y-auto p-4">
            <div className="rounded-xl bg-gray-100 p-3 text-sm">
              Hallo! Ich bin JARVIS. Wie kann ich dir helfen?
            </div>

            {answer && (
              <div className="mt-4 rounded-xl bg-black p-3 text-sm text-white">
                {answer}
              </div>
            )}

            {loading && (
              <div className="mt-4 text-sm text-gray-500">
                JARVIS denkt...
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t p-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  askJarvis()
                }
              }}
              placeholder="JARVIS fragen..."
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            />

            <button
              onClick={askJarvis}
              disabled={loading}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
